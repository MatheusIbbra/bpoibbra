-- Fix: Set view to SECURITY INVOKER (default in newer PG but explicit is safer)
ALTER VIEW public.bank_connections_safe SET (security_invoker = on);