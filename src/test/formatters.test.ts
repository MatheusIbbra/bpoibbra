import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  getCurrencySymbol,
  formatCpfCnpj,
  formatPhone,
  unformatValue,
  parseLocalDate,
  formatLocalDate,
} from "@/lib/formatters";

describe("formatCurrency", () => {
  it("formats BRL correctly", () => {
    const result = formatCurrency(1234.56, "BRL");
    expect(result).toContain("1.234,56");
  });

  it("formats USD correctly", () => {
    const result = formatCurrency(1234.56, "USD");
    expect(result).toContain("1,234.56");
  });

  it("formats EUR correctly", () => {
    const result = formatCurrency(1234.56, "EUR");
    expect(result).toContain("1.234,56");
  });

  it("formats GBP correctly", () => {
    const result = formatCurrency(99.9, "GBP");
    expect(result).toContain("99.90");
  });

  it("defaults to BRL when no currency provided", () => {
    const result = formatCurrency(100);
    expect(result).toContain("R$");
  });

  it("handles zero", () => {
    const result = formatCurrency(0, "BRL");
    expect(result).toContain("0,00");
  });

  it("handles negative values", () => {
    const result = formatCurrency(-500.5, "BRL");
    expect(result).toContain("500,50");
  });
});

describe("getCurrencySymbol", () => {
  it("returns R$ for BRL", () => {
    expect(getCurrencySymbol("BRL")).toBe("R$");
  });

  it("returns € for EUR", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
  });

  it("returns code for unknown currency", () => {
    expect(getCurrencySymbol("JPY")).toBe("JPY");
  });
});

describe("formatCpfCnpj", () => {
  it("formats CPF with 11 digits", () => {
    expect(formatCpfCnpj("12345678901")).toBe("123.456.789-01");
  });

  it("formats partial CPF", () => {
    expect(formatCpfCnpj("1234567")).toContain("123.456.7");
  });

  it("formats CNPJ with 14 digits", () => {
    expect(formatCpfCnpj("12345678000199")).toBe("12.345.678/0001-99");
  });

  it("strips non-digit characters before formatting", () => {
    expect(formatCpfCnpj("123.456.789-01")).toBe("123.456.789-01");
  });
});

describe("formatPhone", () => {
  it("formats landline (10 digits)", () => {
    expect(formatPhone("1133334444")).toBe("(11) 3333-4444");
  });

  it("formats mobile (11 digits)", () => {
    expect(formatPhone("11999998888")).toBe("(11) 99999-8888");
  });

  it("handles partial input", () => {
    const result = formatPhone("119");
    expect(result).toContain("(11)");
  });
});

describe("unformatValue", () => {
  it("removes all non-digit characters", () => {
    expect(unformatValue("123.456.789-01")).toBe("12345678901");
  });

  it("returns empty for non-digit string", () => {
    expect(unformatValue("abc")).toBe("");
  });
});

describe("parseLocalDate", () => {
  it("parses YYYY-MM-DD without UTC shift", () => {
    const date = parseLocalDate("2024-01-15");
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(15);
  });

  it("handles ISO datetime strings", () => {
    const date = parseLocalDate("2024-06-30T23:59:59Z");
    expect(date.getDate()).toBe(30);
  });

  it("returns current date for empty string", () => {
    const date = parseLocalDate("");
    expect(date).toBeInstanceOf(Date);
  });
});

describe("formatLocalDate", () => {
  it("formats date as YYYY-MM-DD", () => {
    const date = new Date(2024, 0, 5); // Jan 5 2024
    expect(formatLocalDate(date)).toBe("2024-01-05");
  });

  it("pads single-digit months and days", () => {
    const date = new Date(2024, 2, 3); // Mar 3
    expect(formatLocalDate(date)).toBe("2024-03-03");
  });
});
