import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { checkAIRateLimit, logAIUsage } from "../_shared/rate-limiter.ts";

interface AnalysisRequest {
  prompt: string;
  context?: string;
  system_instruction?: string;
  temperature?: number;
  max_tokens?: number;
  organization_id?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: AnalysisRequest = await req.json();
    const {
      prompt,
      context,
      system_instruction,
      temperature = 0.3,
      max_tokens = 1024,
      organization_id,
    } = body;

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: "prompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Backend enforcement: unified rate limiting ──
    if (organization_id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      const rateResult = await checkAIRateLimit(adminClient, organization_id, userData.user.id);
      if (!rateResult.allowed) {
        return new Response(
          JSON.stringify({
            error: rateResult.reason || "Rate limit exceeded",
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": String(rateResult.retryAfter || 60),
            },
          }
        );
      }

      // Monthly plan limit
      const { data: sub } = await adminClient
        .from("organization_subscriptions")
        .select("plan_id, plans!inner(max_ai_requests)")
        .eq("organization_id", organization_id)
        .eq("status", "active")
        .maybeSingle();

      const maxAI = (sub?.plans as Record<string, unknown>)?.max_ai_requests as number ?? 50;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: aiCount } = await adminClient
        .from("api_usage_logs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organization_id)
        .eq("endpoint", "ai")
        .gte("created_at", startOfMonth.toISOString());

      const currentAI = aiCount || 0;

      if (currentAI >= maxAI) {
        console.log(`[generate-ai-analysis] AI limit reached for org ${organization_id}: ${currentAI}/${maxAI}`);

        await adminClient.from("api_usage_logs").insert({
          organization_id,
          endpoint: "ai",
          tokens_used: 0,
          request_metadata: { blocked: true, reason: "plan_limit_exceeded", user_id: userData.user.id },
        });

        return new Response(
          JSON.stringify({
            error: "Limite de requisições de IA atingido",
            reason: `Limite mensal atingido (${currentAI}/${maxAI}). Faça upgrade do plano para continuar.`,
            current: currentAI,
            limit: maxAI,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" } }
        );
      }
    }

    const contents = [];
    
    if (system_instruction) {
      contents.push({ role: "user", parts: [{ text: system_instruction }] });
      contents.push({ role: "model", parts: [{ text: "Entendido." }] });
    }
    
    contents.push({
      role: "user",
      parts: [{ text: context ? `${context}\n\n${prompt}` : prompt }],
    });

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: max_tokens,
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[generate-ai-analysis] Gemini error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable", details: aiResponse.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const textContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const tokenUsage = aiData.usageMetadata?.totalTokenCount || 0;

    if (organization_id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await logAIUsage(adminClient, organization_id, userData.user.id, tokenUsage, {
        model: "gemini-2.5-flash",
      });
    }

    return new Response(
      JSON.stringify({
        text: textContent,
        model: "gemini-2.5-flash",
        token_usage: tokenUsage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-ai-analysis] Unexpected error:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
