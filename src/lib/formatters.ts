// Formatting utilities

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
