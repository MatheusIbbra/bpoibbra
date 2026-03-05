const env = typeof Deno !== "undefined" ? Deno.env.get("ENVIRONMENT") : undefined;

const ALLOWED_ORIGINS: string[] = [
  "https://app.ibbra.com.br",
];

if (env === "development") {
  ALLOWED_ORIGINS.push("http://localhost:8080", "http://localhost:5173");
}

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}
