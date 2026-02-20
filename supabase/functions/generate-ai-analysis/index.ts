import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AnalysisRequest {
  prompt: string;
  context?: string;
  system_instruction?: string;
  temperature?: number;
  max_tokens?: number;
  organization_id?: string;
}

Deno.serve(async (req) => {
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
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

    // ── Backend enforcement: check AI request limits ──
    if (organization_id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);

      // Get plan limit
      const { data: sub } = await adminClient
        .from("organization_subscriptions")
        .select("plan_id, plans!inner(max_ai_requests)")
        .eq("organization_id", organization_id)
        .eq("status", "active")
        .maybeSingle();

      const maxAI = (sub?.plans as any)?.max_ai_requests ?? 50;

      // Count AI requests this month
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

        // Log the blocked request
        await adminClient.from("api_usage_logs").insert({
          organization_id,
          endpoint: "ai",
          tokens_used: 0,
          request_metadata: { blocked: true, reason: "plan_limit_exceeded" },
        });

        return new Response(
          JSON.stringify({
            error: "Limite de requisições de IA atingido",
            reason: `Limite mensal atingido (${currentAI}/${maxAI}). Faça upgrade do plano para continuar.`,
            current: currentAI,
            limit: maxAI,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const messages: Array<{ role: string; content: string }> = [];
    
    if (system_instruction) {
      messages.push({ role: "system", content: system_instruction });
    }
    
    messages.push({
      role: "user",
      content: context ? `${context}\n\n${prompt}` : prompt,
    });

    console.log("[generate-ai-analysis] Calling Lovable AI Gateway...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature,
        max_tokens,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[generate-ai-analysis] Gateway error:", aiResponse.status, errorText);
      
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
        JSON.stringify({ error: "AI service temporarily unavailable", details: aiResponse.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const textContent = aiData.choices?.[0]?.message?.content || "";
    const tokenUsage = aiData.usage?.total_tokens || 0;

    // Log successful AI usage
    if (organization_id) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      await adminClient.from("api_usage_logs").insert({
        organization_id,
        endpoint: "ai",
        tokens_used: tokenUsage,
        request_metadata: { model: aiData.model || "google/gemini-3-flash-preview" },
      });
    }

    console.log(`[generate-ai-analysis] Response received (${tokenUsage} tokens)`);

    return new Response(
      JSON.stringify({
        text: textContent,
        model: aiData.model || "google/gemini-3-flash-preview",
        token_usage: tokenUsage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-ai-analysis] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
