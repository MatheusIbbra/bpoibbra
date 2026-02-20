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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Missing token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { organization_id, period = "current_month", force_refresh = false } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Rate limiting
    const { data: rateLimitData } = await supabase.rpc("check_rate_limit", {
      p_organization_id: organization_id,
      p_endpoint: "generate-ai-insights",
      p_window_minutes: 60,
      p_max_requests: 20,
    });

    if (rateLimitData && !rateLimitData.allowed) {
      const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabaseAdmin.from("security_events").insert({
        organization_id, user_id: userId,
        event_type: "rate_limit_exceeded", severity: "warning",
        details: { endpoint: "generate-ai-insights", ...rateLimitData },
      });
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again later.", remaining: 0 }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log usage
    const supabaseAdmin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await supabaseAdmin.from("api_usage_logs").insert({
      organization_id, endpoint: "generate-ai-insights", tokens_used: 0,
    });

    // Check cache
    if (!force_refresh) {
      const { data: existingInsight } = await supabase
        .from("ai_strategic_insights")
        .select("*")
        .eq("organization_id", organization_id)
        .eq("period", period)
        .single();

      if (existingInsight) {
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

    // Calculate metrics
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

    if (metrics.total_revenue === 0 && metrics.total_expenses === 0) {
      return new Response(
        JSON.stringify({
          insights: [], metrics,
          message: "Sem dados financeiros suficientes para gerar insights neste período.",
          cached: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um Wealth Advisor para clientes de alta renda.
Com base apenas nas métricas fornecidas, gere até 5 insights estratégicos curtos.

Regras OBRIGATÓRIAS:
- Não inventar números além dos fornecidos
- Não fazer recomendações de investimento específicas
- Usar linguagem executiva, objetiva e profissional
- Focar em observações acionáveis para gestão patrimonial

Retorne APENAS um array JSON válido:
[{"title":"título","description":"descrição executiva","severity":"info|warning"}]`;

    const userPrompt = `Métricas (${metrics.period_start} a ${metrics.period_end}):
- Taxa de poupança: ${metrics.savings_rate}%
- Crescimento receita: ${metrics.revenue_growth}%
- Crescimento despesas: ${metrics.expense_growth}%
- Desvio orçamentário: ${metrics.budget_deviation}%
- Fluxo de caixa em risco: ${metrics.cashflow_risk ? "Sim" : "Não"}
- Principal despesa: "${metrics.top_expense_category}" (${metrics.top_expense_percentage}%)
- Receita: R$ ${metrics.total_revenue.toLocaleString("pt-BR")}
- Despesas: R$ ${metrics.total_expenses.toLocaleString("pt-BR")}`;

    // Call Gemini 2.5 Flash directly
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling Gemini 2.5 Flash for insights...");

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    let aiContent = "[]";
    let tokenUsage = 0;
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const aiResponse = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error("Gemini error:", aiResponse.status, errorText);
          if (attempt < 1) continue;
          if (aiResponse.status === 429) {
            return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
              status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "AI service error" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const aiData = await aiResponse.json();
        aiContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        tokenUsage = aiData.usageMetadata?.totalTokenCount || 0;
        break;
      } catch (err) {
        console.error(`Gemini call failed (attempt ${attempt}):`, err);
        if (attempt < 1) continue;
        return new Response(JSON.stringify({ error: "AI service timeout" }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    let insights: Insight[] = [];
    try {
      const cleanContent = aiContent.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
      insights = JSON.parse(cleanContent);
      if (!Array.isArray(insights)) throw new Error("Not an array");
      insights = insights
        .filter((i: any) => i.title && i.description && ["info", "warning"].includes(i.severity))
        .slice(0, 5);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      insights = [{ title: "Análise em processamento", description: "Tente novamente.", severity: "info" }];
    }

    // Save
    if (force_refresh) {
      await supabase.from("ai_strategic_insights").delete()
        .eq("organization_id", organization_id).eq("period", period);
    }

    await supabase.from("ai_strategic_insights").insert({
      organization_id, period,
      insights_json: insights, metrics_json: metrics,
      model: "gemini-2.5-flash", token_usage: tokenUsage,
    });

    return new Response(
      JSON.stringify({
        insights, metrics,
        model: "gemini-2.5-flash",
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
