import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockInvoke } = vi.hoisted(() => {
  const mockInvoke = vi.fn();
  return { mockInvoke };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

import { callAIAnalysis, classifyTransactionWithAI } from "@/services/aiService";

describe("aiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("callAIAnalysis", () => {
    it("calls generate-ai-analysis edge function with correct params", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: { text: "Análise completa", model: "gemini-1.5-flash", token_usage: 150 },
        error: null,
      });

      const result = await callAIAnalysis({
        prompt: "Analise meu fluxo de caixa",
        temperature: 0.3,
        maxTokens: 1024,
      });

      expect(mockInvoke).toHaveBeenCalledWith("generate-ai-analysis", {
        body: expect.objectContaining({
          prompt: "Analise meu fluxo de caixa",
          temperature: 0.3,
          max_tokens: 1024,
        }),
      });
      expect(result.text).toBe("Análise completa");
      expect(result.model).toBe("gemini-1.5-flash");
    });

    it("throws when edge function returns error", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: "Function error" },
      });

      await expect(callAIAnalysis({ prompt: "test" })).rejects.toThrow(
        "Serviço de IA indisponível no momento"
      );
    });

    it("handles network timeout gracefully", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Request timeout"));

      await expect(callAIAnalysis({ prompt: "test" })).rejects.toThrow();
    });

    it("does not expose API keys in error messages", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: null,
        error: { message: "Unauthorized" },
      });

      try {
        await callAIAnalysis({ prompt: "test" });
      } catch (error: any) {
        expect(error.message).not.toMatch(/AIzaSy[A-Za-z0-9_-]+/);
        expect(error.message).not.toMatch(/sk-[A-Za-z0-9]+/);
        expect(error.message).toBe("Serviço de IA indisponível no momento");
      }
    });
  });

  describe("classifyTransactionWithAI", () => {
    const mockCategories = [
      { id: "cat-1", name: "Alimentação" },
      { id: "cat-2", name: "Transporte" },
    ];
    const mockCostCenters = [
      { id: "cc-1", name: "Pessoal" },
    ];

    it("returns valid classification from Gemini response", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          text: JSON.stringify({
            category_id: "cat-1",
            category_name: "Alimentação",
            cost_center_id: "cc-1",
            cost_center_name: "Pessoal",
            confidence: 0.9,
            is_transfer: false,
            reasoning: "Compra em supermercado",
          }),
          model: "gemini-1.5-flash",
          token_usage: 80,
        },
        error: null,
      });

      const result = await classifyTransactionWithAI({
        description: "SUPERMERCADO EXTRA",
        amount: 250,
        type: "expense",
        categories: mockCategories,
        costCenters: mockCostCenters,
      });

      expect(result.category_id).toBe("cat-1");
      // Confidence must be capped at 0.75
      expect(result.confidence).toBeLessThanOrEqual(0.75);
      expect(result.is_transfer).toBe(false);
    });

    it("caps confidence at 0.75 even when Gemini returns higher", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          text: JSON.stringify({
            category_id: "cat-1",
            category_name: "Alimentação",
            cost_center_id: null,
            cost_center_name: null,
            confidence: 0.99, // AI returns very high confidence
            is_transfer: false,
            reasoning: "Óbvio",
          }),
          model: "gemini-1.5-flash",
          token_usage: 60,
        },
        error: null,
      });

      const result = await classifyTransactionWithAI({
        description: "MERCADO",
        amount: 100,
        type: "expense",
        categories: mockCategories,
        costCenters: mockCostCenters,
      });

      expect(result.confidence).toBe(0.75);
    });

    it("nullifies category_id when Gemini hallucinates an ID not in the list", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          text: JSON.stringify({
            category_id: "cat-999-hallucinated",
            category_name: "Categoria Falsa",
            cost_center_id: null,
            cost_center_name: null,
            confidence: 0.8,
            is_transfer: false,
            reasoning: "Inventei",
          }),
          model: "gemini-1.5-flash",
          token_usage: 50,
        },
        error: null,
      });

      const result = await classifyTransactionWithAI({
        description: "COMPRA DIVERSA",
        amount: 50,
        type: "expense",
        categories: mockCategories,
        costCenters: mockCostCenters,
      });

      expect(result.category_id).toBeNull();
      expect(result.category_name).toBeNull();
    });

    it("returns fallback when Gemini response is malformed JSON", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          text: "Desculpe, não consigo classificar essa transação agora.",
          model: "gemini-1.5-flash",
          token_usage: 20,
        },
        error: null,
      });

      const result = await classifyTransactionWithAI({
        description: "TRANSACAO ESTRANHA",
        amount: 999,
        type: "expense",
        categories: mockCategories,
        costCenters: mockCostCenters,
      });

      expect(result.category_id).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.reasoning).toBeTruthy();
    });

    it("always sets is_transfer to false regardless of Gemini response", async () => {
      mockInvoke.mockResolvedValueOnce({
        data: {
          text: JSON.stringify({
            category_id: "cat-1",
            category_name: "Alimentação",
            cost_center_id: null,
            cost_center_name: null,
            confidence: 0.7,
            is_transfer: true, // AI incorrectly says it's a transfer
            reasoning: "Pode ser transferência",
          }),
          model: "gemini-1.5-flash",
          token_usage: 60,
        },
        error: null,
      });

      const result = await classifyTransactionWithAI({
        description: "PIX RECEBIDO",
        amount: 500,
        type: "income",
        categories: mockCategories,
        costCenters: mockCostCenters,
      });

      // is_transfer must always be false from AI classification
      expect(result.is_transfer).toBe(false);
    });
  });
});
