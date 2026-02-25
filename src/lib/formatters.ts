// Formatting utilities

export function formatCurrency(value: number, currencyCode: string = "BRL"): string {
  const localeMap: Record<string, string> = {
    BRL: "pt-BR",
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
    CHF: "de-CH",
  };

  return new Intl.NumberFormat(localeMap[currencyCode] || "pt-BR", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function getCurrencySymbol(currencyCode: string): string {
  const symbols: Record<string, string> = {
    BRL: "R$",
    USD: "US$",
    EUR: "€",
    GBP: "£",
    CHF: "CHF",
  };
  return symbols[currencyCode] || currencyCode;
}

export function formatCpfCnpj(value: string): string {
  // Remove non-digits
  const digits = value.replace(/\D/g, "");
  
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    // CNPJ: 00.000.000/0000-00
    return digits
      .slice(0, 14)
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1/$2")
      .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
}

export function formatPhone(value: string): string {
  // Remove non-digits
  const digits = value.replace(/\D/g, "");
  
  if (digits.length <= 10) {
    // Landline: (00) 0000-0000
    return digits
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  } else {
    // Mobile: (00) 00000-0000
    return digits
      .slice(0, 11)
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  }
}

export function unformatValue(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date without UTC conversion.
 * This prevents the common off-by-one-day bug when parsing ISO date strings.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Handle both YYYY-MM-DD and full ISO datetime strings
  const datePart = dateStr.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  
  // Create date using local timezone (months are 0-indexed)
  return new Date(year, month - 1, day);
}

/**
 * Format a Date object as YYYY-MM-DD string without UTC conversion.
 * This prevents timezone shifts when formatting dates.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Shorten verbose bank account names from Open Finance.
 * e.g. "PIC PAY MASTERCARD GOLD - Cartão" → "Cartão de Crédito - PicPay"
 * e.g. "PICPAY INSTITUIÇÃO DE PAGAMENTO S.A - Conta Corrente" → "PicPay - Conta Corrente"
 */
export function shortenAccountName(name: string, accountType?: string): string {
  if (!name) return name;

  // Known bank brand mappings (verbose → short)
  const brandMap: [RegExp, string][] = [
    [/pic\s*pay/i, "PicPay"],
    [/nubank/i, "Nubank"],
    [/banco\s+inter/i, "Inter"],
    [/\binter\b/i, "Inter"],
    [/ita[uú]/i, "Itaú"],
    [/bradesco/i, "Bradesco"],
    [/santander/i, "Santander"],
    [/c6\s*bank/i, "C6 Bank"],
    [/banco\s+do\s+brasil/i, "Banco do Brasil"],
    [/caixa\s+econ/i, "Caixa"],
    [/\bcaixa\b/i, "Caixa"],
    [/neon/i, "Neon"],
    [/next/i, "Next"],
    [/original/i, "Original"],
    [/\bpan\b/i, "Pan"],
    [/safra/i, "Safra"],
    [/btg/i, "BTG"],
    [/\bxp\b/i, "XP"],
    [/modal/i, "Modal"],
    [/mercado\s*pago/i, "Mercado Pago"],
    [/stone/i, "Stone"],
    [/pagbank|pagseguro/i, "PagBank"],
    [/will\s*bank/i, "Will Bank"],
    [/banco\s+bmg/i, "BMG"],
    [/sicoob/i, "Sicoob"],
    [/sicredi/i, "Sicredi"],
  ];

  // Account type labels
  const typeLabels: Record<string, string> = {
    checking: "Conta Corrente",
    savings: "Poupança",
    credit_card: "Cartão de Crédito",
    investment: "Investimento",
    cash: "Dinheiro",
  };

  // Try to detect the subtype from the name itself
  let detectedSubtype = "";
  if (/cart[aã]o|credit|mastercard|visa|elo|gold|platinum|black/i.test(name)) {
    detectedSubtype = "Cartão de Crédito";
  } else if (/conta\s+corrente|checking/i.test(name)) {
    detectedSubtype = "Conta Corrente";
  } else if (/poupan[cç]a|savings/i.test(name)) {
    detectedSubtype = "Poupança";
  } else if (/invest/i.test(name)) {
    detectedSubtype = "Investimento";
  }

  // Use explicit account type if provided, else detected
  const subtype = accountType ? (typeLabels[accountType] || detectedSubtype) : detectedSubtype;

  // Find the brand
  let brand = "";
  for (const [regex, shortName] of brandMap) {
    if (regex.test(name)) {
      brand = shortName;
      break;
    }
  }

  if (brand && subtype) {
    return `${brand} - ${subtype}`;
  }

  // If we found brand but no subtype, just use brand + clean suffix
  if (brand) {
    // Try to extract suffix after " - "
    const dashIdx = name.lastIndexOf(" - ");
    if (dashIdx > -1) {
      const suffix = name.substring(dashIdx + 3).trim();
      if (suffix.length > 0 && suffix.length < 30) {
        return `${brand} - ${suffix}`;
      }
    }
    return brand;
  }

  // No brand match - try to at least shorten common patterns
  // Remove "INSTITUIÇÃO DE PAGAMENTO S.A", "S.A.", "LTDA", etc.
  let shortened = name
    .replace(/\s+INSTITUI[ÇC][AÃ]O\s+DE\s+PAGAMENTO\s+S\.?A\.?/gi, "")
    .replace(/\s+S\.?A\.?\s*/gi, " ")
    .replace(/\s+LTDA\.?\s*/gi, " ")
    .trim();

  // If still long and has " - ", keep the last part meaningful
  if (shortened.length > 30) {
    const dashIdx = shortened.lastIndexOf(" - ");
    if (dashIdx > -1) {
      const prefix = shortened.substring(0, dashIdx).trim();
      const suffix = shortened.substring(dashIdx + 3).trim();
      // Title-case the prefix
      const shortPrefix = prefix.length > 20 ? prefix.substring(0, 20).trim() : prefix;
      return `${shortPrefix} - ${suffix}`;
    }
  }

  return shortened;
}
