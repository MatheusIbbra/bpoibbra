import { describe, it, expect } from "vitest";
import { getDaysInMonth } from "date-fns";

/**
 * Pure projection logic extracted from Orcamentos.tsx (lines 200-207).
 * This mirrors the exact calculation used in production.
 */
function calculateProjection(
  selectedMonth: Date,
  totalSpent: number,
  today: Date = new Date()
) {
  const totalDays = getDaysInMonth(selectedMonth);
  const isCurrentMonth =
    selectedMonth.getMonth() === today.getMonth() &&
    selectedMonth.getFullYear() === today.getFullYear();
  const isPastMonth =
    selectedMonth < new Date(today.getFullYear(), today.getMonth(), 1);
  const daysPassed = isPastMonth
    ? totalDays
    : isCurrentMonth
      ? today.getDate()
      : 0;
  const projectedExpenses =
    daysPassed > 0 ? (totalSpent / daysPassed) * totalDays : totalSpent;

  return { totalDays, daysPassed, projectedExpenses };
}

describe("Projeção de gastos do mês", () => {
  const today = new Date(2026, 2, 4); // 4 de Março de 2026

  it("mês passado: daysPassed === totalDays, projeção === realizado", () => {
    const feb = new Date(2026, 1, 1); // Fevereiro 2026
    const totalSpent = 5000;

    const result = calculateProjection(feb, totalSpent, today);

    expect(result.daysPassed).toBe(result.totalDays);
    expect(result.projectedExpenses).toBe(totalSpent);
  });

  it("mês atual na metade: projeção > realizado", () => {
    // Simula 15 de março (metade do mês de 31 dias)
    const midMonthToday = new Date(2026, 2, 15);
    const march = new Date(2026, 2, 1);
    const totalSpent = 3000;

    const result = calculateProjection(march, totalSpent, midMonthToday);

    expect(result.daysPassed).toBe(15);
    expect(result.totalDays).toBe(31);
    // 3000 / 15 * 31 = 6200
    expect(result.projectedExpenses).toBeCloseTo(6200, 0);
    expect(result.projectedExpenses).toBeGreaterThan(totalSpent);
  });

  it("mês futuro: daysPassed === 0, projeção === totalSpent (sem extrapolação)", () => {
    const april = new Date(2026, 3, 1); // Abril 2026
    const totalSpent = 1000;

    const result = calculateProjection(april, totalSpent, today);

    expect(result.daysPassed).toBe(0);
    expect(result.projectedExpenses).toBe(totalSpent);
  });

  it("mês atual no primeiro dia: projeção extrapola corretamente", () => {
    const firstDayToday = new Date(2026, 2, 1);
    const march = new Date(2026, 2, 1);
    const totalSpent = 100;

    const result = calculateProjection(march, totalSpent, firstDayToday);

    expect(result.daysPassed).toBe(1);
    // 100 / 1 * 31 = 3100
    expect(result.projectedExpenses).toBe(3100);
  });
});
