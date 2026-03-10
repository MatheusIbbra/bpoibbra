import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

function byteaToString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    if (value.startsWith("\\x") || value.startsWith("\\X")) {
      const hex = value.slice(2);
      try {
        const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
        return new TextDecoder("utf-8").decode(bytes);
      } catch {
        return value;
      }
    }
    return value;
  }
  return String(value);
}

function getMatrixClient() {
  const matrixUrl = Deno.env.get("IBBRA_MATRIX_SUPABASE_URL");
  const matrixKey = Deno.env.get("IBBRA_MATRIX_SERVICE_ROLE_KEY");

  if (!matrixUrl || !matrixKey) {
    throw new Error("Missing IBBRA matrix credentials");
  }

  return createClient(matrixUrl, matrixKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function findClientByCpf(cleanCpf: string) {
  const matrixClient = getMatrixClient();

  const { data, error } = await matrixClient
    .from("c_cliente")
    .select(
      "nome_completo, email, telefone, data_nascimento, genero, perfil_comportamental, comunidade, operacional"
    )
    .eq("cpf", cleanCpf)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Matrix query error:", error);
    throw new Error("Erro ao consultar base de dados");
  }

  return data;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Authentication: require a valid Supabase JWT ──────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ found: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ found: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Rate limiting: max 10 requests / IP / minute ──────────────────────
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({ found: false, error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { cpf, action, email: userEmail } = body;

    if (!cpf || typeof cpf !== "string") {
      return new Response(JSON.stringify({ found: false, error: "CPF inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ found: false, error: "CPF deve ter 11 dígitos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: verify_email - check if user-typed email matches the one in c_cliente
    if (action === "verify_email") {
      if (!userEmail || typeof userEmail !== "string") {
        return new Response(JSON.stringify({ match: false, error: "E-mail não informado" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await findClientByCpf(cleanCpf);
      if (!data) {
        return new Response(JSON.stringify({ match: false, error: "Cliente não encontrado" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const rawEmail = byteaToString(data.email) || String(data.email || "");
      const normalizedStored = rawEmail.trim().toLowerCase();
      const normalizedUser = userEmail.trim().toLowerCase();

      const match = normalizedStored === normalizedUser;

      return new Response(
        JSON.stringify({
          match,
          // Only return the real email if it matches (for signUp flow)
          email: match ? rawEmail : null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // DEFAULT ACTION: validate CPF and return client data
    const data = await findClientByCpf(cleanCpf);

    if (!data) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const genero = byteaToString(data.genero);
    const perfil_comportamental = byteaToString(data.perfil_comportamental);
    const comunidade = byteaToString(data.comunidade);
    const operacional = byteaToString(data.operacional);
    const nome_completo = byteaToString(data.nome_completo) || String(data.nome_completo || "");
    const email = byteaToString(data.email) || String(data.email || "");
    const telefone = byteaToString(data.telefone) || String(data.telefone || "");

    const maskedEmail = email ? maskEmail(email) : null;

    let birth_date: string | null = null;
    if (data.data_nascimento) {
      const d = new Date(data.data_nascimento);
      if (!isNaN(d.getTime())) {
        birth_date = d.toISOString().split("T")[0];
      } else {
        birth_date = String(data.data_nascimento);
      }
    }

    return new Response(
      JSON.stringify({
        found: true,
        nome_completo,
        email_masked: maskedEmail,
        email_hash: email ? btoa(encodeURIComponent(email)).slice(0, 16) : null,
        telefone,
        data_nascimento: birth_date,
        genero,
        perfil_comportamental,
        comunidade,
        operacional,
        full_name: nome_completo,
        birth_date,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Unexpected error in validate-ibbra-client:", error);
    return new Response(
      JSON.stringify({ found: false, error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
