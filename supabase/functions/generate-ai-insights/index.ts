import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FinancialMetrics {
  savings_rate: number;
  revenue_growth: number;
  expense_growth: number;
  budget_deviation: number;
  cashflow_risk: boolean;
  top_expense_category: string;
  top_expense_percentage: number;
  period_start: string;
  period_end: string;
  total_revenue: number;
  total_expenses: number;
}

interface Insight {
  title: string;
  description: string;
  severity: "info" | "warning";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validar Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar cliente Supabase com token do usuário
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validar JWT e extrair claims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;
    console.log("Authenticated user:", userId);

    // Parse request body
    const body = await req.json();
    const { organization_id, period = "current_month", force_refresh = false } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating insights for org: ${organization_id}, period: ${period}`);

    // Verificar se já existe insight para este período (cache)
    if (!force_refresh) {
      const { data: existingInsight } = await supabase
        .from("ai_strategic_insights")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("period", period)
        .single();

      if (existingInsight) {
        console.log("Returning cached insight from:", existingInsight.created_at);
        return new Response(
          JSON.stringify({
            insights: existingInsight.insights_json,
            metrics: existingInsight.metrics_json,
            model: existingInsight.model,
            created_at: existingInsight.created_at,
            cached: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Chamar função de métricas determinística
    const { data: metricsData, error: metricsError } = await supabase.rpc(
      "generate_financial_metrics",
      { p_organization_id: organization_id, p_period: period }
    );

    if (metricsError) {
      console.error("Error generating metrics:", metricsError);
      return new Response(
        JSON.stringify({ error: "Failed to generate financial metrics" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metrics = metricsData as FinancialMetrics;
    console.log("Financial metrics calculated:", metrics);

    // Verificar se há dados suficientes
    if (metrics.total_revenue === 0 && metrics.total_expenses === 0) {
      console.log("No financial data available for this period");
      return new Response(
        JSON.stringify({
          insights: [],
          metrics: metrics,
          message: "Sem dados financeiros suficientes para gerar insights neste período.",
          cached: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Montar prompt para IA
    const systemPrompt = `Você é um Wealth Advisor para clientes de alta renda.

Com base apenas nas métricas fornecidas, gere até 5 insights estratégicos curtos.

Regras OBRIGATÓRIAS:
- Não inventar números além dos fornecidos
- Não fazer recomendações de investimento específicas
- Não extrapolar além dos dados apresentados
- Usar linguagem executiva, objetiva e profissional
- Focar em observações acionáveis para gestão patrimonial

Você DEVE retornar APENAS um array JSON válido, sem texto adicional:
[
  {
    "title": "título curto do insight",
    "description": "descrição executiva em 1-2 frases",
    "severity": "info" ou "warning"
  }
]

Use "warning" para situações que requerem atenção (desvios negativos, riscos).
Use "info" para observações neutras ou positivas.`;

    const userPrompt = `Métricas do período (${metrics.period_start} a ${metrics.period_end}):

- Taxa de poupança: ${metrics.savings_rate}%
- Crescimento de receita vs período anterior: ${metrics.revenue_growth}%
- Crescimento de despesas vs período anterior: ${metrics.expense_growth}%
- Desvio orçamentário: ${metrics.budget_deviation}%
- Fluxo de caixa em risco: ${metrics.cashflow_risk ? "Sim" : "Não"}
- Principal categoria de despesa: "${metrics.top_expense_category}"
- Percentual da principal categoria: ${metrics.top_expense_percentage}%
- Receita total: R$ ${metrics.total_revenue.toLocaleString("pt-BR")}
- Despesas totais: R$ ${metrics.total_expenses.toLocaleString("pt-BR")}

Gere os insights estratégicos baseados APENAS nestes dados.`;

    // Chamar Gemini 2.5 Flash diretamente
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Gemini 2.5 Flash...");
    
    const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
    
    const aiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("Gemini response received");

    // Extrair insights do response
    const aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const tokenUsage = aiData.usageMetadata?.totalTokenCount || 0;
    
    let insights: Insight[] = [];
    try {
      // Limpar possíveis caracteres extras e parsear JSON
      const cleanContent = aiContent.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
      insights = JSON.parse(cleanContent);
      
      // Validar estrutura
      if (!Array.isArray(insights)) {
        throw new Error("Response is not an array");
      }
      
      insights = insights.filter(
        (i) => i.title && i.description && ["info", "warning"].includes(i.severity)
      ).slice(0, 5); // Máximo 5 insights
      
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, aiContent);
      insights = [{
        title: "Análise em processamento",
        description: "Não foi possível processar a análise completa. Tente novamente.",
        severity: "info"
      }];
    }

    console.log(`Generated ${insights.length} insights`);

    // Salvar no banco (upsert para evitar duplicatas)
    // Primeiro deletar existente se force_refresh
    if (force_refresh) {
      await supabase
        .from("ai_strategic_insights")
        .delete()
        .eq("organization_id", organization_id)
        .eq("period", period);
    }

    const { error: insertError } = await supabase
      .from("ai_strategic_insights")
      .insert({
        organization_id,
        period,
        insights_json: insights,
        metrics_json: metrics,
        model: "gemini-2.5-flash",
        token_usage: tokenUsage,
      });

    if (insertError) {
      console.error("Failed to save insights:", insertError);
      // Continuar mesmo se falhar o save - retornar os insights gerados
    }

    return new Response(
      JSON.stringify({
        insights,
        metrics,
        model: "google/gemini-2.5-flash",
        token_usage: tokenUsage,
        created_at: new Date().toISOString(),
        cached: false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
