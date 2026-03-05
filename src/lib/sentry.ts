import * as Sentry from "@sentry/react";

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    console.warn("[Sentry] DSN not configured. Skipping initialization.");
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    enabled: !!dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
    beforeSend(event) {
      // Never expose API keys in error context
      if (event.extra) {
        const sanitized = { ...event.extra };
        for (const key of Object.keys(sanitized)) {
          if (/key|token|secret|password|dsn/i.test(key)) {
            sanitized[key] = "[Filtered]";
          }
        }
        event.extra = sanitized;
      }
      return event;
    },
  });
}

export { Sentry };

/** Add a breadcrumb for product/feature tracking */
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({ category, message, data, level: "info" });
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug(`[Breadcrumb:${category}] ${message}`, data);
  }
}

/** Start a Sentry performance transaction */
export function startTransaction(name: string, op: string) {
  return Sentry.startInactiveSpan({ name, op });
}
