import { describe, it, expect } from "vitest";
import { isValidCPF } from "@/services/ibbraClientValidationService";

/**
 * Reconciliation rule matching logic.
 * Since the actual matching happens server-side, we test the pure matching
 * functions that mirror the database logic for client-side preview/filtering.
 */

interface ReconciliationRule {
  description: string;
  match_type: "exact" | "contains";
  amount: number | null;
  category_id: string;
}

interface Transaction {
  description: string;
  amount: number;
}

/** Matches a transaction against a rule — mirrors DB trigger logic */
function matchRule(tx: Transaction, rule: ReconciliationRule): boolean {
  // Description matching
  let descMatch = false;
  if (rule.match_type === "exact") {
    descMatch = tx.description.toLowerCase() === rule.description.toLowerCase();
  } else if (rule.match_type === "contains") {
    descMatch = tx.description.toLowerCase().includes(rule.description.toLowerCase());
  }

  // Amount matching (if rule specifies amount)
  if (rule.amount !== null) {
    return descMatch && Math.abs(tx.amount) === Math.abs(rule.amount);
  }

  return descMatch;
}

describe("reconciliation rule matching", () => {
  const baseRule: ReconciliationRule = {
    description: "NETFLIX",
    match_type: "exact",
    amount: null,
    category_id: "cat-1",
  };

  it("matches exact description", () => {
    expect(matchRule({ description: "NETFLIX", amount: -39.9 }, baseRule)).toBe(true);
  });

  it("exact match is case-insensitive", () => {
    expect(matchRule({ description: "netflix", amount: -39.9 }, baseRule)).toBe(true);
  });

  it("exact match rejects partial match", () => {
    expect(matchRule({ description: "NETFLIX PREMIUM", amount: -39.9 }, baseRule)).toBe(false);
  });

  it("contains match finds substring", () => {
    const containsRule = { ...baseRule, match_type: "contains" as const };
    expect(matchRule({ description: "PAGTO NETFLIX PREMIUM", amount: -55.9 }, containsRule)).toBe(true);
  });

  it("contains match is case-insensitive", () => {
    const containsRule = { ...baseRule, match_type: "contains" as const };
    expect(matchRule({ description: "pagto netflix", amount: -10 }, containsRule)).toBe(true);
  });

  it("matches by amount when specified", () => {
    const amountRule = { ...baseRule, match_type: "contains" as const, amount: 39.9 };
    expect(matchRule({ description: "NETFLIX", amount: -39.9 }, amountRule)).toBe(true);
  });

  it("rejects wrong amount", () => {
    const amountRule = { ...baseRule, match_type: "contains" as const, amount: 39.9 };
    expect(matchRule({ description: "NETFLIX", amount: -55.9 }, amountRule)).toBe(false);
  });

  it("requires both description and amount to match", () => {
    const comboRule: ReconciliationRule = {
      description: "SPOTIFY",
      match_type: "exact",
      amount: 21.9,
      category_id: "cat-2",
    };
    // Description matches, amount doesn't
    expect(matchRule({ description: "SPOTIFY", amount: -30 }, comboRule)).toBe(false);
    // Both match
    expect(matchRule({ description: "SPOTIFY", amount: -21.9 }, comboRule)).toBe(true);
  });
});

// Bonus: CPF validation (critical for onboarding)
describe("isValidCPF", () => {
  it("validates a correct CPF", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
  });

  it("rejects all-same-digit CPFs", () => {
    expect(isValidCPF("111.111.111-11")).toBe(false);
  });

  it("rejects wrong check digits", () => {
    expect(isValidCPF("529.982.247-26")).toBe(false);
  });

  it("rejects too short", () => {
    expect(isValidCPF("123456")).toBe(false);
  });
});
