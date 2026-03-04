import { describe, it, expect } from "vitest";

/**
 * Pure cash flow calculation logic extracted from useCashFlowReport.ts.
 * Tests transaction type handling without Supabase.
 */

interface CashFlowTransaction {
  type: string;
  amount: number;
  is_ignored: boolean;
}

function calculateCashFlowFromTransactions(transactions: CashFlowTransaction[]) {
  let inflows = 0;
  let outflows = 0;
  let investments = 0;
  let redemptions = 0;

  const filtered = transactions.filter((t) => !t.is_ignored);

  filtered.forEach((tx) => {
    const amount = Number(tx.amount);
    switch (tx.type) {
      case "income":
        inflows += amount;
        break;
      case "expense":
        outflows += amount;
        break;
      case "investment":
        investments += amount;
        break;
      case "redemption":
        redemptions += amount;
        break;
      // "transfer" is excluded from cash flow entirely
    }
  });

  const netFlow = inflows + redemptions - outflows - investments;

  return { inflows, outflows, investments, redemptions, netFlow };
}

function calculateOpeningBalance(priorTransactions: CashFlowTransaction[]) {
  let openingBalance = 0;

  priorTransactions
    .filter((t) => !t.is_ignored)
    .forEach((tx) => {
      const amount = Number(tx.amount);
      if (tx.type === "income" || tx.type === "redemption") {
        openingBalance += amount;
      } else if (tx.type === "expense" || tx.type === "investment") {
        openingBalance -= amount;
      }
      // Transfers don't affect opening balance
    });

  return openingBalance;
}

describe("Fluxo de Caixa — Cálculo de netFlow", () => {
  it("transferência entre contas NÃO afeta netFlow", () => {
    const transactions: CashFlowTransaction[] = [
      { type: "income", amount: 10000, is_ignored: false },
      { type: "transfer", amount: 5000, is_ignored: false },
      { type: "expense", amount: 2000, is_ignored: false },
    ];

    const result = calculateCashFlowFromTransactions(transactions);

    // 10000 - 2000 = 8000, transfer is excluded
    expect(result.netFlow).toBe(8000);
    expect(result.inflows).toBe(10000);
    expect(result.outflows).toBe(2000);
  });

  it("investimento REDUZ netFlow", () => {
    const transactions: CashFlowTransaction[] = [
      { type: "income", amount: 10000, is_ignored: false },
      { type: "investment", amount: 3000, is_ignored: false },
    ];

    const result = calculateCashFlowFromTransactions(transactions);

    // 10000 - 3000 = 7000
    expect(result.netFlow).toBe(7000);
    expect(result.investments).toBe(3000);
  });

  it("resgate AUMENTA netFlow", () => {
    const transactions: CashFlowTransaction[] = [
      { type: "expense", amount: 5000, is_ignored: false },
      { type: "redemption", amount: 8000, is_ignored: false },
    ];

    const result = calculateCashFlowFromTransactions(transactions);

    // 8000 - 5000 = 3000
    expect(result.netFlow).toBe(3000);
    expect(result.redemptions).toBe(8000);
  });

  it("transações ignoradas são excluídas do cálculo", () => {
    const transactions: CashFlowTransaction[] = [
      { type: "income", amount: 10000, is_ignored: false },
      { type: "expense", amount: 50000, is_ignored: true },
    ];

    const result = calculateCashFlowFromTransactions(transactions);

    expect(result.netFlow).toBe(10000);
    expect(result.outflows).toBe(0);
  });
});

describe("Fluxo de Caixa — Opening Balance", () => {
  it("transferências NÃO afetam openingBalance", () => {
    const priorTx: CashFlowTransaction[] = [
      { type: "income", amount: 20000, is_ignored: false },
      { type: "transfer", amount: 15000, is_ignored: false },
      { type: "expense", amount: 5000, is_ignored: false },
    ];

    const balance = calculateOpeningBalance(priorTx);

    // 20000 - 5000 = 15000 (transfer excluded)
    expect(balance).toBe(15000);
  });

  it("investimentos reduzem openingBalance, resgates aumentam", () => {
    const priorTx: CashFlowTransaction[] = [
      { type: "income", amount: 50000, is_ignored: false },
      { type: "investment", amount: 10000, is_ignored: false },
      { type: "redemption", amount: 3000, is_ignored: false },
    ];

    const balance = calculateOpeningBalance(priorTx);

    // 50000 - 10000 + 3000 = 43000
    expect(balance).toBe(43000);
  });

  it("openingBalance === 0 quando não há transações prévias", () => {
    expect(calculateOpeningBalance([])).toBe(0);
  });
});
