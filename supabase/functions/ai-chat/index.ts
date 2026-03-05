import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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

    // Rate limit: max 30 requests per hour per organization
    if (organization_id) {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const { count } = await adminClient
        .from("api_usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization_id)
        .eq("endpoint", "ai")
        .gte("created_at", oneHourAgo);
      if ((count ?? 0) >= 30) {
        return new Response(
          JSON.stringify({ error: "Rate limit: máximo 30 requisições/hora" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

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

    // Convert messages to Gemini format
    const geminiContents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Sou o Wealth Advisor da IBBRA, pronto para auxiliar na gestão patrimonial." }] },
    ];

    for (const msg of messages) {
      geminiContents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Transform Gemini SSE stream to OpenAI-compatible SSE stream
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const jsonStr = line.slice(6).trim();
                if (!jsonStr || jsonStr === "[DONE]") continue;
                try {
                  const geminiChunk = JSON.parse(jsonStr);
                  const text = geminiChunk.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (text) {
                    // Convert to OpenAI SSE format
                    const openaiChunk = {
                      choices: [{ delta: { content: text } }],
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
                  }
                } catch {
                  // Skip malformed chunks
                }
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ai-chat error:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
