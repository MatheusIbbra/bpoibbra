import { supabase } from "@/integrations/supabase/client";

/**
 * Get the base URL for Supabase Edge Functions.
 * Derives from the Supabase client config to avoid hardcoded URLs.
 */
export function getSupabaseFunctionsUrl(): string {
  // supabaseUrl is exposed on the client
  const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1`;
}

/**
 * Helper to call a Supabase Edge Function with auth.
 */
export async function callEdgeFunction(
  functionName: string,
  body?: Record<string, unknown>,
  method: string = "POST"
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${getSupabaseFunctionsUrl()}/${functionName}`;

  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
