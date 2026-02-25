import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Convert a bytea-like value to a readable string.
 * The Supabase JS client returns bytea columns as hex strings (\\xHEX).
 */
function byteaToString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    // Hex-encoded bytea: \x48656c6c6f
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { cpf } = await req.json();

    if (!cpf || typeof cpf !== "string") {
      return new Response(JSON.stringify({ found: false, error: "CPF inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize CPF (digits only)
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ found: false, error: "CPF deve ter 11 dígitos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Connect to Supabase B (matriz) using service_role - READ ONLY
    const matrixUrl = Deno.env.get("IBBRA_MATRIX_SUPABASE_URL");
    const matrixKey = Deno.env.get("IBBRA_MATRIX_SERVICE_ROLE_KEY");

    if (!matrixUrl || !matrixKey) {
      console.error("Missing IBBRA matrix credentials");
      return new Response(
        JSON.stringify({ found: false, error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const matrixClient = createClient(matrixUrl, matrixKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Query c_cliente table - limit(1) for performance, SELECT only needed fields
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
      return new Response(
        JSON.stringify({ found: false, error: "Erro ao consultar base de dados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data) {
      return new Response(JSON.stringify({ found: false }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode bytea fields (genero, perfil_comportamental may be stored as bytea)
    const genero = byteaToString(data.genero);
    const perfil_comportamental = byteaToString(data.perfil_comportamental);
    const comunidade = byteaToString(data.comunidade);
    const operacional = byteaToString(data.operacional);
    const nome_completo = byteaToString(data.nome_completo) || String(data.nome_completo || "");
    const email = byteaToString(data.email) || String(data.email || "");
    const telefone = byteaToString(data.telefone) || String(data.telefone || "");

    // Mask email for display
    let maskedEmail: string | null = null;
    if (email) {
      const [local, domain] = email.split("@");
      if (domain) {
        maskedEmail = `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
      }
    }

    // Format birth_date to ISO (YYYY-MM-DD) if it's a Date or string
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
        // email_raw is intentionally NOT returned - security measure
        // The Edge Function will use it only to call inviteUserByEmail
        email_hash: email ? btoa(encodeURIComponent(email)).slice(0, 16) : null,
        telefone,
        data_nascimento: birth_date,
        genero,
        perfil_comportamental,
        comunidade,
        operacional,
        // Return full_name and birth_date aliases for compatibility with existing frontend
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
