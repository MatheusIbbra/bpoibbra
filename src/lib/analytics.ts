import { Sentry } from "@/lib/sentry";

export type AnalyticsEvent =
  | "upgrade_modal_opened"
  | "upgrade_modal_plan_selected"
  | "checkout_started"
  | "checkout_completed"
  | "trial_started"
  | "trial_banner_clicked"
  | "plan_limit_reached"
  | "plan_limit_warning";

export function trackEvent(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  // Log no Sentry como breadcrumb para correlação com erros
  Sentry.addBreadcrumb({ category: "product", message: event, data: properties });

  // Log local para debug
  if (import.meta.env.DEV) {
    console.log(`[Analytics] ${event}`, properties);
  }

  // Registrar no Supabase para BI interno (fire-and-forget)
  import("@/integrations/supabase/client").then(({ supabase }) => {
    supabase.from("api_usage_logs").insert([{
      endpoint: `analytics:${event}`,
      request_metadata: (properties ?? null) as import("@/integrations/supabase/types").Json,
    }]).then();
  });
}
