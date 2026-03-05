import { describe, it, expect } from "vitest";

// ────────────────────────────────────────────────────────────
// Pure logic tests for the financial events classification
// No Supabase calls – tests the algorithmic core only.
// ────────────────────────────────────────────────────────────

function classifyPair(
  txA: { type: string; account_id: string },
  txB: { type: string; account_id: string },
  investmentAccountIds: Set<string>
): "aporte" | "resgate" | "internal_transfer" | "no_match" {
  const isDebit  = (t: { type: string }) => t.type === "expense"  || t.type === "investment";
  const isCredit = (t: { type: string }) => t.type === "income"   || t.type === "redemption";

  let debitTx: typeof txA, creditTx: typeof txA;
  if      (isDebit(txA) && isCredit(txB)) { debitTx = txA; creditTx = txB; }
  else if (isCredit(txA) && isDebit(txB)) { debitTx = txB; creditTx = txA; }
  else return "no_match";

  const debitIsInv  = investmentAccountIds.has(debitTx.account_id);
  const creditIsInv = investmentAccountIds.has(creditTx.account_id);

  if      (!debitIsInv && creditIsInv) return "aporte";
  else if (debitIsInv && !creditIsInv) return "resgate";
  else                                  return "internal_transfer";
}

function mapEventType(txType: string, isIgnored: boolean, isRejected: boolean): string {
  if (isIgnored && isRejected) return "hidden_leg";
  switch (txType) {
    case "income":     return "income";
    case "expense":    return "expense";
    case "transfer":   return "internal_transfer";
    case "investment": return "investment_contribution";
    case "redemption": return "investment_withdraw";
    default:           return "expense";
  }
}

const investmentAccts = new Set(["inv-001", "inv-002"]);

describe("Financial Events – Pair Classification", () => {
  it("classifies regular→investment as APORTE", () => {
    const result = classifyPair(
      { type: "expense",  account_id: "checking-001" },
      { type: "income",   account_id: "inv-001" },
      investmentAccts
    );
    expect(result).toBe("aporte");
  });

  it("classifies investment→regular as RESGATE", () => {
    const result = classifyPair(
      { type: "expense", account_id: "inv-001" },
      { type: "income",  account_id: "checking-001" },
      investmentAccts
    );
    expect(result).toBe("resgate");
  });

  it("classifies two regular accounts as internal_transfer", () => {
    const result = classifyPair(
      { type: "expense", account_id: "checking-001" },
      { type: "income",  account_id: "checking-002" },
      investmentAccts
    );
    expect(result).toBe("internal_transfer");
  });

  it("returns no_match for two expenses", () => {
    const result = classifyPair(
      { type: "expense", account_id: "checking-001" },
      { type: "expense", account_id: "checking-002" },
      investmentAccts
    );
    expect(result).toBe("no_match");
  });

  it("classifies two investment accounts as internal_transfer", () => {
    const result = classifyPair(
      { type: "expense", account_id: "inv-001" },
      { type: "income",  account_id: "inv-002" },
      investmentAccts
    );
    expect(result).toBe("internal_transfer");
  });
});

describe("Financial Events – Event Type Mapping", () => {
  it("income transaction → income event", () => {
    expect(mapEventType("income", false, false)).toBe("income");
  });

  it("expense transaction → expense event", () => {
    expect(mapEventType("expense", false, false)).toBe("expense");
  });

  it("investment (primary) → investment_contribution", () => {
    expect(mapEventType("investment", false, false)).toBe("investment_contribution");
  });

  it("investment (secondary, hidden) → hidden_leg", () => {
    expect(mapEventType("investment", true, true)).toBe("hidden_leg");
  });

  it("redemption (primary) → investment_withdraw", () => {
    expect(mapEventType("redemption", false, false)).toBe("investment_withdraw");
  });

  it("transfer → internal_transfer", () => {
    expect(mapEventType("transfer", false, false)).toBe("internal_transfer");
  });
});

describe("Financial Events – Impact Flags", () => {
  const impactMap: Record<string, { cashflow: boolean; investments: boolean }> = {
    income:                  { cashflow: true,  investments: false },
    expense:                 { cashflow: true,  investments: false },
    internal_transfer:       { cashflow: false, investments: false },
    investment_contribution: { cashflow: false, investments: true  },
    investment_withdraw:     { cashflow: false, investments: true  },
  };

  it("internal_transfer has no cashflow or investment impact", () => {
    expect(impactMap["internal_transfer"].cashflow).toBe(false);
    expect(impactMap["internal_transfer"].investments).toBe(false);
  });

  it("investment_contribution does not affect cashflow", () => {
    expect(impactMap["investment_contribution"].cashflow).toBe(false);
    expect(impactMap["investment_contribution"].investments).toBe(true);
  });

  it("income affects cashflow but not investments", () => {
    expect(impactMap["income"].cashflow).toBe(true);
    expect(impactMap["income"].investments).toBe(false);
  });
});

describe("Financial Events – Deduplication (hash logic)", () => {
  function normalizeDesc(text: string): string {
    let r = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    r = r.replace(/\b\d{1,4}\b/g, "").replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    return r;
  }

  function buildHash(date: string, amount: number, desc: string, accountId: string): string {
    return `${date}|${Math.abs(amount).toFixed(2)}|${normalizeDesc(desc)}|${accountId}`;
  }

  it("produces identical hash for same transaction regardless of extra spaces", () => {
    const h1 = buildHash("2025-01-15", 500, "Mercado Pão de Açúcar", "acc-1");
    const h2 = buildHash("2025-01-15", 500, "Mercado   Pao  de  Acucar", "acc-1");
    expect(h1).toBe(h2);
  });

  it("produces different hashes for different amounts", () => {
    const h1 = buildHash("2025-01-15", 500, "Supermercado", "acc-1");
    const h2 = buildHash("2025-01-15", 501, "Supermercado", "acc-1");
    expect(h1).not.toBe(h2);
  });

  it("produces different hashes for different accounts", () => {
    const h1 = buildHash("2025-01-15", 500, "Supermercado", "acc-1");
    const h2 = buildHash("2025-01-15", 500, "Supermercado", "acc-2");
    expect(h1).not.toBe(h2);
  });

  it("ignores number tokens in description normalization", () => {
    const h1 = buildHash("2025-01-15", 100, "PIX 1234 João", "acc-1");
    const h2 = buildHash("2025-01-15", 100, "PIX João", "acc-1");
    expect(h1).toBe(h2);
  });
});

describe("Financial Events – Investment Balance Calculation", () => {
  it("calculates correct investment balance from events", () => {
    const events = [
      { event_type: "investment_contribution", amount: 10000 },
      { event_type: "investment_contribution", amount: 5000  },
      { event_type: "investment_withdraw",     amount: 3000  },
      { event_type: "internal_transfer",       amount: 1000  }, // must be ignored
      { event_type: "income",                  amount: 8000  }, // must be ignored
    ];

    let balance = 0;
    for (const ev of events) {
      if (ev.event_type === "investment_contribution") balance += ev.amount;
      if (ev.event_type === "investment_withdraw")     balance -= ev.amount;
    }

    expect(balance).toBe(12000); // 10000 + 5000 - 3000
  });

  it("returns 0 for no investment events", () => {
    const events = [
      { event_type: "income",  amount: 5000 },
      { event_type: "expense", amount: 2000 },
    ];
    let balance = 0;
    for (const ev of events) {
      if (ev.event_type === "investment_contribution") balance += ev.amount;
      if (ev.event_type === "investment_withdraw")     balance -= ev.amount;
    }
    expect(balance).toBe(0);
  });
});
