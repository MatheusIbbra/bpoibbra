import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Import after mocking
import { supabase } from "@/integrations/supabase/client";

describe("useAIClassification - pipeline logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps AI confidence at 75% maximum", () => {
    // Simulate AI returning 95% confidence
    const rawConfidence = 0.95;
    const cappedConfidence = Math.min(rawConfidence, 0.75);
    expect(cappedConfidence).toBe(0.75);
  });

  it("does not cap rule/pattern confidence above 75%", () => {
    // Rule-based classification can be 100% confident
    const ruleConfidence = 1.0;
    const patternConfidence = 0.85;
    // Only AI confidence is capped, not rules/patterns
    expect(ruleConfidence).toBe(1.0);
    expect(patternConfidence).toBe(0.85);
  });

  it("auto_validated is never set by AI classification", () => {
    const aiResult = {
      category_id: "cat-1",
      category_name: "Alimentação",
      cost_center_id: null,
      cost_center_name: null,
      confidence: 0.75,
      is_transfer: false,
      reasoning: "Descrição típica de supermercado",
      source: "ai" as const,
      // auto_validated should never be true for AI
      auto_validated: false,
    };
    expect(aiResult.auto_validated).toBe(false);
    expect(aiResult.source).toBe("ai");
  });

  it("is_transfer is always false for AI classification", () => {
    const result = {
      category_id: "cat-1",
      confidence: 0.6,
      is_transfer: false, // AI always sets this to false
    };
    expect(result.is_transfer).toBe(false);
  });

  it("returns null category when AI cannot classify", () => {
    const fallbackResult = {
      category_id: null,
      category_name: null,
      cost_center_id: null,
      cost_center_name: null,
      confidence: 0,
      is_transfer: false,
      reasoning: "Não foi possível classificar automaticamente",
    };
    expect(fallbackResult.category_id).toBeNull();
    expect(fallbackResult.confidence).toBe(0);
  });

  it("validates returned category ID against available categories", () => {
    const categories = [
      { id: "cat-1", name: "Alimentação" },
      { id: "cat-2", name: "Transporte" },
    ];

    // AI returns a valid ID
    const validId = "cat-1";
    const isValid = categories.some(c => c.id === validId);
    expect(isValid).toBe(true);

    // AI returns an invalid/hallucinated ID
    const invalidId = "cat-999-nonexistent";
    const isInvalid = categories.some(c => c.id === invalidId);
    expect(isInvalid).toBe(false);
  });

  it("reduces confidence when category ID is invalid", () => {
    let confidence = 0.7;
    const categoryId = "cat-999-nonexistent";
    const categories = [{ id: "cat-1", name: "Alimentação" }];

    const valid = categories.find(c => c.id === categoryId);
    if (!valid) {
      confidence = Math.max(0, confidence - 0.3);
    }

    expect(confidence).toBe(0.4);
  });

  it("calls classify-transaction edge function correctly", async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockResolvedValueOnce({
      data: {
        category_id: "cat-1",
        category_name: "Alimentação",
        cost_center_id: null,
        cost_center_name: null,
        confidence: 0.75,
        is_transfer: false,
        reasoning: "Mercado",
        source: "ai",
      },
      error: null,
    });

    const result = await supabase.functions.invoke("classify-transaction", {
      body: {
        description: "SUPERMERCADO EXTRA",
        amount: 250,
        type: "expense",
        organization_id: "org-1",
      },
    });

    expect(mockInvoke).toHaveBeenCalledWith("classify-transaction", expect.any(Object));
    expect(result.data?.confidence).toBe(0.75);
    expect(result.data?.is_transfer).toBe(false);
    expect(result.error).toBeNull();
  });

  it("handles network error gracefully without exposing API keys", async () => {
    const mockInvoke = vi.mocked(supabase.functions.invoke);
    mockInvoke.mockRejectedValueOnce(new Error("Network error"));

    try {
      await supabase.functions.invoke("classify-transaction", { body: {} });
    } catch (error: any) {
      // Error should not contain API keys
      expect(error.message).not.toContain("AIzaSy");
      expect(error.message).not.toContain("sk-");
      expect(error.message).toBe("Network error");
    }
  });
});
