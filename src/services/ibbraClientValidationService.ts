/**
 * IBBRA Client Validation Service
 * 
 * Validates CPF against the external IBBRA client database.
 * Currently in MOCK mode until the real API is available.
 * 
 * When the real API is ready:
 * 1. Set USE_MOCK_VALIDATION = false
 * 2. Implement the real validation via Edge Function
 * 3. No UI changes needed
 */

const USE_MOCK_VALIDATION = true;

export interface IbbraClientValidationResult {
  found: boolean;
  full_name?: string;
  birth_date?: string;
}

/**
 * Mock validation for development.
 * CPF "00000000000" returns a found client.
 * Any other CPF returns not found.
 */
async function mockValidation(cpf: string): Promise<IbbraClientValidationResult> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const cleanCpf = cpf.replace(/\D/g, "");

  if (cleanCpf === "00000000000") {
    return {
      found: true,
      full_name: "Maria Helena de Souza",
      birth_date: "1985-03-15",
    };
  }

  return { found: false };
}

/**
 * Real validation via Edge Function (future implementation).
 */
async function realValidation(_cpf: string): Promise<IbbraClientValidationResult> {
  // Future: call edge function validate-ibbra-client
  // const { data, error } = await supabase.functions.invoke('validate-ibbra-client', { body: { cpf } });
  throw new Error("Real validation not yet implemented. Set USE_MOCK_VALIDATION = true.");
}

/**
 * Validates a CPF against the IBBRA client database.
 */
export async function validateClientByCPF(cpf: string): Promise<IbbraClientValidationResult> {
  if (USE_MOCK_VALIDATION) {
    return mockValidation(cpf);
  }
  return realValidation(cpf);
}

/**
 * Validates CPF format and check digits.
 */
export function isValidCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== parseInt(cleaned.charAt(10))) return false;

  return true;
}

/**
 * Formats a CPF string with mask: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const cleaned = value.replace(/\D/g, "").slice(0, 11);
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
}
