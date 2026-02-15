import { supabase } from "@/integrations/supabase/client";

/**
 * Camada de abstração para chamadas de IA via Edge Function segura.
 * Nenhuma chave de API é exposta no frontend.
 * Toda comunicação passa pela Edge Function generate-ai-analysis.
 */

export interface AIAnalysisRequest {
  prompt: string;
  context?: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIAnalysisResponse {
  text: string;
  model: string;
  token_usage: number;
}

export interface AIClassificationRequest {
  description: string;
  amount: number;
  type: "income" | "expense";
  categories: Array<{ id: string; name: string }>;
  costCenters: Array<{ id: string; name: string }>;
}

export interface AIClassificationResult {
  category_id: string | null;
  category_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  confidence: number;
  is_transfer: boolean;
  reasoning: string;
}

const SYSTEM_CONTEXT =
  "Você é um analista financeiro especializado em organização patrimonial de alta renda.";

/**
 * Chamada genérica à Edge Function de IA.
 */
export async function callAIAnalysis(
  request: AIAnalysisRequest
): Promise<AIAnalysisResponse> {
  const { data, error } = await supabase.functions.invoke("generate-ai-analysis", {
    body: {
      prompt: request.prompt,
      context: request.context,
      system_instruction: request.systemInstruction || SYSTEM_CONTEXT,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 1024,
    },
  });

  if (error) {
    console.error("[aiService] Edge function error:", error);
    throw new Error("Serviço de IA indisponível no momento");
  }

  return data as AIAnalysisResponse;
}

/**
 * Classificação de transação via IA (Gemini).
 * Retorna sugestão de categoria e centro de custo.
 */
export async function classifyTransactionWithAI(
  request: AIClassificationRequest
): Promise<AIClassificationResult> {
  const categoryList =
    request.categories.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n") ||
    "Nenhuma categoria cadastrada";
  const costCenterList =
    request.costCenters.map((cc) => `- ${cc.name} (ID: ${cc.id})`).join("\n") ||
    "Nenhum centro de custo cadastrado";

  const systemInstruction = `Você é um analista financeiro especializado em organização patrimonial de alta renda.
Classifique transações bancárias com precisão.

REGRAS:
1. Retorne APENAS JSON válido, sem texto adicional
2. Use SOMENTE IDs das categorias/centros de custo fornecidos
3. Se não encontrar categoria adequada, retorne category_id como null
4. is_transfer deve ser SEMPRE false

CATEGORIAS DISPONÍVEIS (${request.type}):
${categoryList}

CENTROS DE CUSTO DISPONÍVEIS:
${costCenterList}

Formato de resposta:
{
  "category_id": "uuid ou null",
  "category_name": "nome ou null",
  "cost_center_id": "uuid ou null",
  "cost_center_name": "nome ou null",
  "confidence": 0.0 a 1.0,
  "is_transfer": false,
  "reasoning": "breve explicação"
}`;

  const prompt = `Classifique esta transação:
Descrição: "${request.description}"
Valor: R$ ${request.amount.toFixed(2)}
Tipo: ${request.type === "income" ? "Receita" : "Despesa"}`;

  try {
    const response = await callAIAnalysis({
      prompt,
      systemInstruction: systemInstruction,
      temperature: 0.2,
      maxTokens: 500,
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON não encontrado na resposta da IA");
    }

    const parsed = JSON.parse(jsonMatch[0]) as AIClassificationResult;

    // Validate returned IDs
    if (parsed.category_id) {
      const valid = request.categories.find((c) => c.id === parsed.category_id);
      if (!valid) {
        parsed.category_id = null;
        parsed.category_name = null;
        parsed.confidence = Math.max(0, (parsed.confidence || 0) - 0.3);
      }
    }
    if (parsed.cost_center_id) {
      const valid = request.costCenters.find((cc) => cc.id === parsed.cost_center_id);
      if (!valid) {
        parsed.cost_center_id = null;
        parsed.cost_center_name = null;
      }
    }

    // Cap AI confidence at 75%
    parsed.confidence = Math.min(parsed.confidence || 0, 0.75);
    parsed.is_transfer = false;

    return parsed;
  } catch (err) {
    console.error("[aiService] Classification error:", err);
    return {
      category_id: null,
      category_name: null,
      cost_center_id: null,
      cost_center_name: null,
      confidence: 0,
      is_transfer: false,
      reasoning: "Não foi possível classificar automaticamente",
    };
  }
}
