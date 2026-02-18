import { toast } from "sonner";

/**
 * IBBRA — Supabase / PostgreSQL Error Handler
 * Maps common error codes to user-friendly Portuguese messages.
 */

interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

const PG_ERROR_MAP: Record<string, string> = {
  "23505": "Registro duplicado. Já existe um registro com esses dados.",
  "23503": "Referência inválida. O registro vinculado não existe ou foi removido.",
  "23502": "Campo obrigatório não preenchido.",
  "23514": "Valor informado não atende às regras de validação.",
  "42501": "Você não tem permissão para realizar esta ação.",
  "42P01": "Recurso não encontrado no sistema.",
  "PGRST116": "Registro não encontrado.",
  "PGRST301": "Sessão expirada. Faça login novamente.",
  "PGRST204": "Nenhum resultado encontrado.",
};

/**
 * Checks if the error message is from a plan limit trigger.
 */
function isPlanLimitError(message?: string): boolean {
  if (!message) return false;
  return (
    message.includes("Limite de transações do plano atingido") ||
    message.includes("Limite de conexões bancárias do plano atingido")
  );
}

/**
 * Extracts a user-friendly message from a Supabase/PostgreSQL error.
 */
export function getSupabaseErrorMessage(error: unknown, context?: string): string {
  if (!error) return "Erro desconhecido.";

  const err = error as SupabaseError;
  const code = err.code;
  const message = err.message || "";

  // Plan limit errors — use the trigger message directly
  if (isPlanLimitError(message)) {
    return message;
  }

  // Check violation — use the trigger/constraint message directly
  if (code === "23514" || message.includes("check_violation") || message.includes("violates check constraint")) {
    return message || PG_ERROR_MAP["23514"];
  }

  // Raise exception from triggers (code P0001)
  if (code === "P0001") {
    return message;
  }

  // Known PG error codes
  if (code && PG_ERROR_MAP[code]) {
    return PG_ERROR_MAP[code];
  }

  // HTTP status-based fallbacks
  if (err.status === 401 || err.status === 403) {
    return "Sessão expirada ou sem permissão. Faça login novamente.";
  }
  if (err.status === 404) {
    return "Recurso não encontrado.";
  }
  if (err.status === 429) {
    return "Limite de requisições atingido. Aguarde um momento.";
  }
  if (err.status && err.status >= 500) {
    return "Erro interno do servidor. Tente novamente em alguns instantes.";
  }

  // Network errors
  if (message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("ERR_NETWORK")) {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }

  // Generic fallback
  const prefix = context ? `Erro ao ${context}` : "Erro";
  return message ? `${prefix}: ${message}` : `${prefix}. Tente novamente.`;
}

/**
 * Handle a Supabase error by showing an appropriate toast notification.
 * Returns the error message string for optional further handling.
 */
export function handleSupabaseError(error: unknown, context?: string): string {
  const message = getSupabaseErrorMessage(error, context);

  if (isPlanLimitError((error as SupabaseError)?.message)) {
    toast.error("Limite do plano atingido", {
      description: message,
      action: {
        label: "Fazer upgrade →",
        onClick: () => window.location.href = "/perfil",
      },
      duration: 8000,
    });
  } else {
    toast.error(message);
  }

  console.error(`[SupabaseError] ${context || "unknown"}:`, error);
  return message;
}
