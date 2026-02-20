import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, organization_id } = await req.json();

    // Fetch financial context for the organization
    let financialContext = "";
    if (organization_id) {
      const { data: healthData } = await supabase.rpc("generate_financial_health_score", {
        p_organization_id: organization_id,
      });
      if (healthData) {
        financialContext = `\n\nContexto financeiro atual do cliente:
- Score de Saúde: ${healthData.score}/100
- Saldo total: R$ ${healthData.total_balance?.toLocaleString("pt-BR") || "0"}
- Receitas do mês: R$ ${healthData.total_revenue?.toLocaleString("pt-BR") || "0"}
- Despesas do mês: R$ ${healthData.total_expenses?.toLocaleString("pt-BR") || "0"}
- Taxa de poupança: ${healthData.savings_rate || 0}%
- Runway: ${healthData.runway_months || 0} meses
- Burn rate: R$ ${healthData.burn_rate?.toLocaleString("pt-BR") || "0"}/mês`;
      }
    }

    const systemPrompt = `Você é um Wealth Advisor da IBBRA, especializado em gestão patrimonial para clientes de alta renda.

Diretrizes:
- Responda em português brasileiro, com tom executivo e profissional
- Use dados financeiros reais do cliente quando disponíveis
- Nunca recomende investimentos específicos (ações, fundos, criptomoedas)
- Foque em estratégia patrimonial, fluxo de caixa, diversificação e proteção
- Seja conciso e direto, máximo 3 parágrafos por resposta
- Se não souber algo específico sobre o cliente, diga claramente${financialContext}`;

    // Build Gemini conversation from messages
    const userMessages = messages.map((m: any) => m.content).join("\n\n");
    const fullPrompt = `${systemPrompt}\n\nConversa:\n${userMessages}`;

    // Use streaming endpoint
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (content) {
              const openAIChunk = JSON.stringify({
                choices: [{ delta: { content }, index: 0 }],
              });
              controller.enqueue(new TextEncoder().encode(`data: ${openAIChunk}\n\n`));
            }
            if (parsed.candidates?.[0]?.finishReason === "STOP") {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
            }
          } catch { /* skip malformed */ }
        }
      },
    });

    return new Response(response.body!.pipeThrough(transformStream), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ai-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
