/**
 * IBBRA Client Validation Service
 *
 * Validates CPF against the external IBBRA client database (Supabase B - matriz).
 * Calls the Edge Function validate-ibbra-client which reads from c_cliente table.
 */

import { supabase } from "@/integrations/supabase/client";

export interface IbbraClientValidationResult {
  found: boolean;
  full_name?: string;
  birth_date?: string;
  nome_completo?: string;
  email_masked?: string;
  telefone?: string;
  data_nascimento?: string;
  genero?: string;
  perfil_comportamental?: string;
  comunidade?: string;
  operacional?: string;
  error?: string;
}

/**
 * Validates a CPF against the IBBRA client database via Edge Function.
 * The Edge Function connects to Supabase B (matriz) and reads c_cliente.
 */
export async function validateClientByCPF(cpf: string): Promise<IbbraClientValidationResult> {
  const cleanCpf = cpf.replace(/\D/g, "");

  const { data, error } = await supabase.functions.invoke("validate-ibbra-client", {
    body: { cpf: cleanCpf },
  });

  if (error) {
    console.error("validate-ibbra-client error:", error);
    return { found: false, error: error.message || "Erro ao validar CPF" };
  }

  return data as IbbraClientValidationResult;
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
