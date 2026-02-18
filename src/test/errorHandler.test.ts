import { describe, it, expect, vi } from "vitest";
import { getSupabaseErrorMessage } from "@/lib/error-handler";

// Mock sonner toast so handleSupabaseError doesn't throw
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("getSupabaseErrorMessage", () => {
  it("returns duplicate record message for code 23505", () => {
    const msg = getSupabaseErrorMessage({ code: "23505" });
    expect(msg).toContain("duplicado");
  });

  it("returns invalid reference message for code 23503", () => {
    const msg = getSupabaseErrorMessage({ code: "23503" });
    expect(msg).toContain("Referência inválida");
  });

  it("returns required field message for code 23502", () => {
    const msg = getSupabaseErrorMessage({ code: "23502" });
    expect(msg).toContain("obrigatório");
  });

  it("returns permission denied for code 42501", () => {
    const msg = getSupabaseErrorMessage({ code: "42501" });
    expect(msg).toContain("permissão");
  });

  it("returns not found for PGRST116", () => {
    const msg = getSupabaseErrorMessage({ code: "PGRST116" });
    expect(msg).toContain("não encontrado");
  });

  it("returns session expired for PGRST301", () => {
    const msg = getSupabaseErrorMessage({ code: "PGRST301" });
    expect(msg).toContain("Sessão expirada");
  });

  it("returns plan limit message directly", () => {
    const msg = getSupabaseErrorMessage({
      message: "Limite de transações do plano atingido",
    });
    expect(msg).toBe("Limite de transações do plano atingido");
  });

  it("passes through P0001 raise exception messages", () => {
    const msg = getSupabaseErrorMessage({
      code: "P0001",
      message: "Custom trigger error",
    });
    expect(msg).toBe("Custom trigger error");
  });

  it("handles 401 status", () => {
    const msg = getSupabaseErrorMessage({ status: 401 });
    expect(msg).toContain("Sessão expirada");
  });

  it("handles 429 status", () => {
    const msg = getSupabaseErrorMessage({ status: 429 });
    expect(msg).toContain("Limite de requisições");
  });

  it("handles 500+ status", () => {
    const msg = getSupabaseErrorMessage({ status: 500 });
    expect(msg).toContain("Erro interno");
  });

  it("handles network errors", () => {
    const msg = getSupabaseErrorMessage({ message: "Failed to fetch" });
    expect(msg).toContain("conexão");
  });

  it("uses context prefix in fallback", () => {
    const msg = getSupabaseErrorMessage({ message: "algo deu errado" }, "salvar transação");
    expect(msg).toContain("Erro ao salvar transação");
  });

  it("returns unknown error for null", () => {
    const msg = getSupabaseErrorMessage(null);
    expect(msg).toBe("Erro desconhecido.");
  });
});
