import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RULE_SIMILARITY_THRESHOLD = 0.70;
const PATTERN_SIMILARITY_THRESHOLD = 0.70;
const AUTO_VALIDATE_CONFIDENCE = 0.85;
const SUGGEST_CONFIDENCE = 0.60;

interface ClassificationRequest {
  transaction_id?: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  organization_id?: string;
}

interface ClassificationResult {
  category_id: string | null;
  category_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  confidence: number;
  is_transfer: boolean;
  reasoning: string;
  source: "rule" | "pattern" | "ai" | "none";
  auto_validated: boolean;
  normalized_description?: string;
}

// ========================================
// NORMALIZAÇÃO DE TEXTO (CAMADA 1)
// ========================================
function normalizeText(text: string): string {
  let result = text.toLowerCase();
  
  // Remove acentos
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Remove números curtos (1-4 dígitos, geralmente irrelevantes)
  result = result.replace(/\b\d{1,4}\b/g, "");
  
  // Remove stopwords bancárias
  const bankStopwords = /\b(pix|ted|doc|tev|transf|deb|cred|pag|rec|ref|nr|num|nf|cp|dp|de|para|em|do|da|dos|das|o|a|os|as|e|ou|que|com|por|no|na|nos|nas|um|uma|uns|umas)\b/gi;
  result = result.replace(bankStopwords, "");
  
  // Remove caracteres especiais mantendo espaços
  result = result.replace(/[^a-z0-9\s]/g, "");
  
  // Normaliza múltiplos espaços
  result = result.replace(/\s+/g, " ");
  
  return result.trim();
}

// ========================================
// CÁLCULO DE SIMILARIDADE
// ========================================
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = text1.split(" ").filter(w => w.length > 0);
  const words2 = text2.split(" ").filter(w => w.length > 0);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Contar palavras em comum
  const set2 = new Set(words2);
  const commonWords = words1.filter(w => set2.has(w)).length;
  
  // Usar a maior contagem como denominador
  const totalWords = Math.max(words1.length, words2.length);
  
  return commonWords / totalWords;
}

// Verifica se uma string contém a outra
function containsKeyword(description: string, keyword: string): number {
  const normalizedDesc = normalizeText(description);
  const normalizedKeyword = normalizeText(keyword);
  
  if (normalizedDesc.includes(normalizedKeyword)) {
    const matchScore = normalizedKeyword.length / Math.max(normalizedDesc.length, 1);
    return Math.min(0.75 + matchScore * 0.25, 1.0);
  }
  
  return 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !userData.user) {
      throw new Error("Usuário não autenticado");
    }

    const { description, amount, type, transaction_id, organization_id }: ClassificationRequest = await req.json();

    if (!description) {
      throw new Error("Descrição é obrigatória");
    }

    // ========================================
    // ETAPA 1: NORMALIZAÇÃO
    // ========================================
    const normalizedDescription = normalizeText(description);
    console.log(`[NORMALIZAÇÃO] Original: "${description}" -> Normalizado: "${normalizedDescription}"`);

    // Atualizar normalized_description na transação se ID fornecido
    if (transaction_id) {
      await supabaseClient
        .from("transactions")
        .update({ normalized_description: normalizedDescription })
        .eq("id", transaction_id);
    }

    let result: ClassificationResult = {
      category_id: null,
      category_name: null,
      cost_center_id: null,
      cost_center_name: null,
      confidence: 0,
      is_transfer: false,
      reasoning: "",
      source: "none",
      auto_validated: false,
      normalized_description: normalizedDescription,
    };

    // ========================================
    // ETAPA 2: REGRAS DE CONCILIAÇÃO
    // ========================================
    if (organization_id) {
      console.log(`[REGRAS] Buscando regras para org: ${organization_id}`);
      
      const { data: rules, error: rulesError } = await supabaseClient
        .from("reconciliation_rules")
        .select(`
          id,
          description,
          category_id,
          cost_center_id,
          transaction_type,
          amount,
          due_day,
          categories:category_id (id, name),
          cost_centers:cost_center_id (id, name)
        `)
        .eq("organization_id", organization_id)
        .eq("is_active", true)
        .eq("transaction_type", type);

      if (!rulesError && rules && rules.length > 0) {
        console.log(`[REGRAS] Encontradas ${rules.length} regras ativas`);
        
        let bestMatch: { rule: typeof rules[0]; similarity: number } | null = null;
        
        for (const rule of rules) {
          // Calcular similaridade usando múltiplos métodos
          const keywordSim = containsKeyword(description, rule.description);
          const normalizedSim = calculateSimilarity(normalizedDescription, normalizeText(rule.description));
          
          // Usar o maior score
          let similarity = Math.max(keywordSim, normalizedSim);
          
          // Boost se o valor também corresponder (±1%)
          if (rule.amount && Math.abs(amount - rule.amount) / rule.amount <= 0.01) {
            similarity = Math.min(similarity + 0.1, 1.0);
          }
          
          console.log(`[REGRAS] Regra "${rule.description}": keyword=${(keywordSim*100).toFixed(1)}%, normalized=${(normalizedSim*100).toFixed(1)}%, final=${(similarity*100).toFixed(1)}%`);
          
          if (similarity >= RULE_SIMILARITY_THRESHOLD) {
            if (!bestMatch || similarity > bestMatch.similarity) {
              bestMatch = { rule, similarity };
            }
          }
        }
        
        if (bestMatch) {
          console.log(`[REGRAS] ✓ Match: "${bestMatch.rule.description}" (${(bestMatch.similarity*100).toFixed(0)}%)`);
          
          const categoriesData = bestMatch.rule.categories as unknown as { id: string; name: string } | null;
          const costCentersData = bestMatch.rule.cost_centers as unknown as { id: string; name: string } | null;
          
          const shouldAutoValidate = bestMatch.similarity >= 0.8;
          
          result = {
            category_id: bestMatch.rule.category_id,
            category_name: categoriesData?.name || null,
            cost_center_id: bestMatch.rule.cost_center_id,
            cost_center_name: costCentersData?.name || null,
            confidence: bestMatch.similarity,
            is_transfer: false,
            reasoning: `Classificado pela regra "${bestMatch.rule.description}" com ${(bestMatch.similarity * 100).toFixed(0)}% de similaridade`,
            source: "rule",
            auto_validated: shouldAutoValidate,
            normalized_description: normalizedDescription,
          };

          // Auto-validar se score >= 0.8
          if (transaction_id && shouldAutoValidate && result.category_id) {
            await supabaseClient
              .from("transactions")
              .update({
                category_id: result.category_id,
                cost_center_id: result.cost_center_id,
                classification_source: "rule",
                validation_status: "validated",
                validated_at: new Date().toISOString(),
              })
              .eq("id", transaction_id);
              
            console.log(`[REGRAS] ✓ Auto-validado por regra`);
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }

      // ========================================
      // ETAPA 3: HISTÓRICO APRENDIDO (PATTERNS)
      // ========================================
      console.log(`[PATTERNS] Buscando padrões aprendidos...`);
      
      const { data: patterns, error: patternsError } = await supabaseClient
        .from("transaction_patterns")
        .select(`
          id,
          normalized_description,
          category_id,
          cost_center_id,
          transaction_type,
          avg_amount,
          confidence,
          occurrences,
          categories:category_id (id, name),
          cost_centers:cost_center_id (id, name)
        `)
        .eq("organization_id", organization_id)
        .eq("transaction_type", type)
        .order("confidence", { ascending: false })
        .order("occurrences", { ascending: false })
        .limit(100);

      if (!patternsError && patterns && patterns.length > 0) {
        console.log(`[PATTERNS] Encontrados ${patterns.length} padrões`);
        
        let bestPattern: { pattern: typeof patterns[0]; similarity: number } | null = null;
        
        for (const pattern of patterns) {
          const similarity = calculateSimilarity(normalizedDescription, pattern.normalized_description);
          
          // Considerar também a confiança do pattern
          const effectiveSimilarity = similarity * (0.7 + (pattern.confidence * 0.3));
          
          console.log(`[PATTERNS] Pattern "${pattern.normalized_description.substring(0,30)}...": sim=${(similarity*100).toFixed(1)}%, conf=${(pattern.confidence*100).toFixed(1)}%, effective=${(effectiveSimilarity*100).toFixed(1)}%`);
          
          if (similarity >= PATTERN_SIMILARITY_THRESHOLD) {
            if (!bestPattern || effectiveSimilarity > bestPattern.similarity * (0.7 + ((bestPattern.pattern.confidence || 0) * 0.3))) {
              bestPattern = { pattern, similarity };
            }
          }
        }
        
        if (bestPattern) {
          console.log(`[PATTERNS] ✓ Match: pattern id=${bestPattern.pattern.id} (${(bestPattern.similarity*100).toFixed(0)}%, ${bestPattern.pattern.occurrences} ocorrências)`);
          
          const categoriesData = bestPattern.pattern.categories as unknown as { id: string; name: string } | null;
          const costCentersData = bestPattern.pattern.cost_centers as unknown as { id: string; name: string } | null;
          
          const patternConfidence = bestPattern.pattern.confidence || 0.5;
          const finalConfidence = Math.min(bestPattern.similarity * patternConfidence * 1.2, 0.95);
          const shouldAutoValidate = finalConfidence >= AUTO_VALIDATE_CONFIDENCE && (bestPattern.pattern.occurrences || 1) >= 3;
          
          result = {
            category_id: bestPattern.pattern.category_id,
            category_name: categoriesData?.name || null,
            cost_center_id: bestPattern.pattern.cost_center_id,
            cost_center_name: costCentersData?.name || null,
            confidence: finalConfidence,
            is_transfer: false,
            reasoning: `Baseado em ${bestPattern.pattern.occurrences} transações similares (${(patternConfidence * 100).toFixed(0)}% de confiança histórica)`,
            source: "pattern",
            auto_validated: shouldAutoValidate,
            normalized_description: normalizedDescription,
          };

          // Auto-validar se alta confiança e múltiplas ocorrências
          if (transaction_id && shouldAutoValidate && result.category_id) {
            await supabaseClient
              .from("transactions")
              .update({
                category_id: result.category_id,
                cost_center_id: result.cost_center_id,
                classification_source: "pattern",
                validation_status: "validated",
                validated_at: new Date().toISOString(),
              })
              .eq("id", transaction_id);
              
            console.log(`[PATTERNS] ✓ Auto-validado por pattern`);
          } else if (transaction_id && finalConfidence >= SUGGEST_CONFIDENCE) {
            // Apenas marcar source, não auto-validar
            await supabaseClient
              .from("transactions")
              .update({
                category_id: result.category_id,
                cost_center_id: result.cost_center_id,
                classification_source: "pattern",
              })
              .eq("id", transaction_id);
          }

          // Se confiança >= 0.6, retornar como sugestão
          if (finalConfidence >= SUGGEST_CONFIDENCE) {
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            });
          }
        }
      }
    }

    // ========================================
    // ETAPA 4: IA (FALLBACK)
    // ========================================
    console.log(`[IA] Nenhuma regra ou pattern aplicável. Usando IA como fallback...`);

    // Buscar categorias do usuário
    const { data: categories, error: catError } = await supabaseClient
      .from("categories")
      .select("id, name, type")
      .eq("type", type);

    if (catError) throw catError;

    // Buscar centros de custo
    const { data: costCenters, error: ccError } = await supabaseClient
      .from("cost_centers")
      .select("id, name");

    if (ccError) throw ccError;

    // Build context for AI
    const categoryList = categories?.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n") || "Nenhuma categoria cadastrada";
    const costCenterList = costCenters?.map((cc) => `- ${cc.name} (ID: ${cc.id})`).join("\n") || "Nenhum centro de custo cadastrado";

    const systemPrompt = `Você é um assistente financeiro especializado em classificar transações bancárias.

REGRAS IMPORTANTES:
1. Você DEVE retornar um JSON válido
2. NÃO crie categorias ou centros de custo novos - use apenas os IDs fornecidos
3. Se não encontrar uma categoria adequada, retorne category_id como null
4. Identifique transferências entre contas (PIX para mesma pessoa, TED entre bancos próprios, etc.)

CATEGORIAS DISPONÍVEIS (${type}):
${categoryList}

CENTROS DE CUSTO DISPONÍVEIS:
${costCenterList}

Responda APENAS com um JSON no formato:
{
  "category_id": "uuid ou null",
  "category_name": "nome da categoria ou null",
  "cost_center_id": "uuid ou null",
  "cost_center_name": "nome do centro de custo ou null",
  "confidence": 0.0 a 1.0,
  "is_transfer": true/false,
  "reasoning": "breve explicação da classificação"
}`;

    const userPrompt = `Classifique esta transação:
Descrição: "${description}"
Descrição Normalizada: "${normalizedDescription}"
Valor: R$ ${amount.toFixed(2)}
Tipo: ${type === "income" ? "Receita" : "Despesa"}`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[IA] Gateway error:", errorText);
      
      // Retornar resultado vazio em vez de erro
      result.reasoning = "Não foi possível classificar automaticamente (IA indisponível)";
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response
    let aiClassification: any;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("JSON não encontrado na resposta");
      }
      aiClassification = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("[IA] Failed to parse response:", aiContent);
      result.reasoning = "Não foi possível interpretar a resposta da IA";
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Validar que IDs retornados existem
    if (aiClassification.category_id) {
      const validCategory = categories?.find((c) => c.id === aiClassification.category_id);
      if (!validCategory) {
        aiClassification.category_id = null;
        aiClassification.category_name = null;
        aiClassification.confidence = Math.max(0, (aiClassification.confidence || 0) - 0.3);
      }
    }

    if (aiClassification.cost_center_id) {
      const validCostCenter = costCenters?.find((cc) => cc.id === aiClassification.cost_center_id);
      if (!validCostCenter) {
        aiClassification.cost_center_id = null;
        aiClassification.cost_center_name = null;
      }
    }

    // Construir resultado final
    result = {
      category_id: aiClassification.category_id || null,
      category_name: aiClassification.category_name || null,
      cost_center_id: aiClassification.cost_center_id || null,
      cost_center_name: aiClassification.cost_center_name || null,
      confidence: Math.min(aiClassification.confidence || 0, 0.75), // Cap IA confidence at 75%
      is_transfer: aiClassification.is_transfer || false,
      reasoning: aiClassification.reasoning || "Classificado pela IA",
      source: "ai",
      auto_validated: false, // NUNCA auto-validar IA
      normalized_description: normalizedDescription,
    };

    console.log(`[IA] Classificação: category=${result.category_name}, confidence=${(result.confidence*100).toFixed(0)}%`);

    // Salvar sugestão da IA (nunca auto-validar)
    if (transaction_id && result.category_id) {
      // Atualizar transaction com source
      await supabaseClient
        .from("transactions")
        .update({
          classification_source: "ai",
          category_id: result.category_id,
          cost_center_id: result.cost_center_id,
        })
        .eq("id", transaction_id);

      // Criar sugestão na tabela ai_suggestions
      await supabaseClient
        .from("ai_suggestions")
        .insert({
          transaction_id: transaction_id,
          suggested_category_id: result.category_id,
          suggested_cost_center_id: result.cost_center_id,
          suggested_type: type,
          confidence_score: result.confidence,
          reasoning: result.reasoning,
          model_version: "classify-v2-3layer",
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    console.error("Error in classify-transaction:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
