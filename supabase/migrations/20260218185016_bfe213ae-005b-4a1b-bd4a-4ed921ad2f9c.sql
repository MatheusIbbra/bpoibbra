
-- Migration: Push Subscriptions table
-- Tables affected: push_subscriptions

CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint per user
CREATE UNIQUE INDEX idx_push_subscriptions_user ON public.push_subscriptions (user_id);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role full access for edge functions
CREATE POLICY "Service role full access"
  ON public.push_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ROLLBACK:
-- DROP TABLE IF EXISTS public.push_subscriptions;
