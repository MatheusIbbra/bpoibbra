import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RULE_SIMILARITY_THRESHOLD = 0.80;
const PATTERN_SIMILARITY_THRESHOLD = 0.80;
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
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(/\b\d{1,4}\b/g, "");
  const bankStopwords = /\b(pix|ted|doc|tev|transf|deb|cred|pag|rec|ref|nr|num|nf|cp|dp|de|para|em|do|da|dos|das|o|a|os|as|e|ou|que|com|por|no|na|nos|nas|um|uma|uns|umas)\b/gi;
  result = result.replace(bankStopwords, "");
  result = result.replace(/[^a-z0-9\s]/g, "");
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
  const set2 = new Set(words2);
  const commonWords = words1.filter(w => set2.has(w)).length;
  return commonWords / Math.max(words1.length, words2.length);
}

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });

    const { description, amount, type, transaction_id, organization_id }: ClassificationRequest = await req.json();

    if (!description) throw new Error("Descrição é obrigatória");

    // ETAPA 1: NORMALIZAÇÃO
    const normalizedDescription = normalizeText(description);
    console.log(`[NORMALIZAÇÃO] "${description}" -> "${normalizedDescription}"`);

    if (transaction_id) {
      await supabaseClient.from("transactions")
        .update({ normalized_description: normalizedDescription })
        .eq("id", transaction_id);
    }

    let result: ClassificationResult = {
      category_id: null, category_name: null, cost_center_id: null, cost_center_name: null,
      confidence: 0, is_transfer: false, reasoning: "", source: "none",
      auto_validated: false, normalized_description: normalizedDescription,
    };

    // ETAPA 2: REGRAS DE CONCILIAÇÃO
    if (organization_id) {
      const { data: rules, error: rulesError } = await supabaseClient
        .from("reconciliation_rules")
        .select(`id, description, category_id, cost_center_id, transaction_type, amount, due_day,
          categories:category_id (id, name), cost_centers:cost_center_id (id, name)`)
        .eq("organization_id", organization_id)
        .eq("is_active", true)
        .eq("transaction_type", type);

      if (!rulesError && rules && rules.length > 0) {
        let bestMatch: { rule: typeof rules[0]; similarity: number } | null = null;
        
        for (const rule of rules) {
          if (!rule.category_id) continue; // Skip rules without category
          const keywordSim = containsKeyword(description, rule.description);
          const normalizedSim = calculateSimilarity(normalizedDescription, normalizeText(rule.description));
          let similarity = Math.max(keywordSim, normalizedSim);
          if (rule.amount && Math.abs(amount - rule.amount) / rule.amount <= 0.01) {
            similarity = Math.min(similarity + 0.1, 1.0);
          }
          if (similarity >= RULE_SIMILARITY_THRESHOLD && (!bestMatch || similarity > bestMatch.similarity)) {
            bestMatch = { rule, similarity };
          }
        }
        
        if (bestMatch) {
          const cat = bestMatch.rule.categories as unknown as { id: string; name: string } | null;
          const cc = bestMatch.rule.cost_centers as unknown as { id: string; name: string } | null;
          const shouldAutoValidate = bestMatch.similarity >= 0.8;
          
          result = {
            category_id: bestMatch.rule.category_id, category_name: cat?.name || null,
            cost_center_id: bestMatch.rule.cost_center_id, cost_center_name: cc?.name || null,
            confidence: bestMatch.similarity, is_transfer: false,
            reasoning: `Regra "${bestMatch.rule.description}" (${(bestMatch.similarity * 100).toFixed(0)}%)`,
            source: "rule", auto_validated: shouldAutoValidate, normalized_description: normalizedDescription,
          };

          if (transaction_id && shouldAutoValidate && result.category_id) {
            await supabaseClient.from("transactions").update({
              category_id: result.category_id, cost_center_id: result.cost_center_id,
              classification_source: "rule", validation_status: "validated", validated_at: new Date().toISOString(),
            }).eq("id", transaction_id);
          }

          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
          });
        }
      }

      // ETAPA 3: PATTERNS
      const { data: patterns, error: patternsError } = await supabaseClient
        .from("transaction_patterns")
        .select(`id, normalized_description, category_id, cost_center_id, transaction_type, avg_amount, confidence, occurrences,
          categories:category_id (id, name), cost_centers:cost_center_id (id, name)`)
        .eq("organization_id", organization_id)
        .eq("transaction_type", type)
        .order("confidence", { ascending: false })
        .order("occurrences", { ascending: false })
        .limit(100);

      if (!patternsError && patterns && patterns.length > 0) {
        let bestPattern: { pattern: typeof patterns[0]; similarity: number } | null = null;
        
        for (const pattern of patterns) {
          const similarity = calculateSimilarity(normalizedDescription, pattern.normalized_description);
          const effectiveSimilarity = similarity * (0.7 + (pattern.confidence * 0.3));
          
          if (similarity >= PATTERN_SIMILARITY_THRESHOLD) {
            if (!bestPattern || effectiveSimilarity > bestPattern.similarity * (0.7 + ((bestPattern.pattern.confidence || 0) * 0.3))) {
              bestPattern = { pattern, similarity };
            }
          }
        }
        
        if (bestPattern) {
          const cat = bestPattern.pattern.categories as unknown as { id: string; name: string } | null;
          const cc = bestPattern.pattern.cost_centers as unknown as { id: string; name: string } | null;
          const patternConfidence = bestPattern.pattern.confidence || 0.5;
          const finalConfidence = Math.min(bestPattern.similarity * patternConfidence * 1.2, 0.95);
          const shouldAutoValidate = finalConfidence >= AUTO_VALIDATE_CONFIDENCE && (bestPattern.pattern.occurrences || 1) >= 3;
          
          result = {
            category_id: bestPattern.pattern.category_id, category_name: cat?.name || null,
            cost_center_id: bestPattern.pattern.cost_center_id, cost_center_name: cc?.name || null,
            confidence: finalConfidence, is_transfer: false,
            reasoning: `${bestPattern.pattern.occurrences} transações similares (${(patternConfidence * 100).toFixed(0)}% confiança)`,
            source: "pattern", auto_validated: shouldAutoValidate, normalized_description: normalizedDescription,
          };

          if (transaction_id && shouldAutoValidate && result.category_id) {
            await supabaseClient.from("transactions").update({
              category_id: result.category_id, cost_center_id: result.cost_center_id,
              classification_source: "pattern", validation_status: "validated", validated_at: new Date().toISOString(),
            }).eq("id", transaction_id);
          } else if (transaction_id && finalConfidence >= SUGGEST_CONFIDENCE) {
            await supabaseClient.from("transactions").update({
              category_id: result.category_id, cost_center_id: result.cost_center_id,
              classification_source: "pattern",
            }).eq("id", transaction_id);
          }

          if (finalConfidence >= SUGGEST_CONFIDENCE) {
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
            });
          }
        }
      }
    }

    // ETAPA 4: IA VIA LOVABLE AI GATEWAY
    console.log("[IA] Fallback to Lovable AI Gateway...");

    const { data: categories, error: catError } = await supabaseClient
      .from("categories").select("id, name, type, parent_id").eq("type", type).not("parent_id", "is", null);
    if (catError) throw catError;

    const { data: costCenters, error: ccError } = await supabaseClient
      .from("cost_centers").select("id, name");
    if (ccError) throw ccError;

    const categoryList = categories?.map((c) => `- ${c.name} (ID: ${c.id})`).join("\n") || "Nenhuma";
    const costCenterList = costCenters?.map((cc) => `- ${cc.name} (ID: ${cc.id})`).join("\n") || "Nenhum";

    const systemPrompt = `Você é um assistente financeiro. Classifique transações bancárias.
REGRAS: Retorne APENAS JSON válido. Use SOMENTE IDs fornecidos. is_transfer = false SEMPRE.

CATEGORIAS (${type}):
${categoryList}

CENTROS DE CUSTO:
${costCenterList}

Formato: {"category_id":"uuid|null","category_name":"nome|null","cost_center_id":"uuid|null","cost_center_name":"nome|null","confidence":0-1,"is_transfer":false,"reasoning":"explicação"}`;

    const userPrompt = `Classifique: "${description}" | R$ ${amount.toFixed(2)} | ${type === "income" ? "Receita" : "Despesa"}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      result.reasoning = "IA não configurada";
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
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
      console.error("[IA] Gateway error:", aiResponse.status);
      result.reasoning = "IA indisponível";
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let aiClassification: any;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON");
      aiClassification = JSON.parse(jsonMatch[0]);
    } catch {
      result.reasoning = "Não foi possível interpretar a resposta da IA";
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
      });
    }

    // Validate IDs
    if (aiClassification.category_id) {
      if (!categories?.find((c) => c.id === aiClassification.category_id)) {
        aiClassification.category_id = null;
        aiClassification.category_name = null;
        aiClassification.confidence = Math.max(0, (aiClassification.confidence || 0) - 0.3);
      }
    }
    if (aiClassification.cost_center_id) {
      if (!costCenters?.find((cc) => cc.id === aiClassification.cost_center_id)) {
        aiClassification.cost_center_id = null;
        aiClassification.cost_center_name = null;
      }
    }

    result = {
      category_id: aiClassification.category_id || null,
      category_name: aiClassification.category_name || null,
      cost_center_id: aiClassification.cost_center_id || null,
      cost_center_name: aiClassification.cost_center_name || null,
      confidence: Math.min(aiClassification.confidence || 0, 0.75),
      is_transfer: false,
      reasoning: aiClassification.reasoning || "Classificado pela IA",
      source: "ai", auto_validated: false,
      normalized_description: normalizedDescription,
    };

    if (transaction_id && result.category_id) {
      await supabaseClient.from("transactions").update({
        classification_source: "ai",
        category_id: result.category_id,
        cost_center_id: result.cost_center_id,
      }).eq("id", transaction_id);

      await supabaseClient.from("ai_suggestions").insert({
        transaction_id, suggested_category_id: result.category_id,
        suggested_cost_center_id: result.cost_center_id,
        suggested_type: type, confidence_score: result.confidence,
        reasoning: result.reasoning, model_version: "lovable-ai-v1",
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
