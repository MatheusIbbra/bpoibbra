import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// IP-based rate limiter: max 5 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Rate limiting: max 5 requests per IP per minute
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ exists: false, error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { cpf } = await req.json();

    if (!cpf || typeof cpf !== "string" || cpf.length !== 11) {
      return new Response(JSON.stringify({ exists: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if CPF exists in profiles with completed registration
    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_id")
      .eq("cpf", cpf)
      .eq("registration_completed", true)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ exists: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get masked email
    const { data: userData } = await adminClient.auth.admin.getUserById(profile.user_id);
    
    const email = userData?.user?.email || "";
    const [local, domain] = email.split("@");
    const maskedEmail = domain 
      ? `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`
      : "***@***";

    return new Response(JSON.stringify({ exists: true, email: maskedEmail }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in check-cpf-duplicate:", error);
    return new Response(JSON.stringify({ exists: false }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
