import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders } from "../_shared/cors.ts";

interface ClassifyRequest {
  transactionIds: string[];
  organizationId: string;
}

interface CategoryPattern {
  category_id: string;
  category_name: string;
  cost_center_id: string | null;
  cost_center_name: string | null;
  pattern: string;
  count: number;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === supabaseServiceKey;
    
    if (!isServiceRole) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        console.error("Auth error:", authError);
        return new Response(
          JSON.stringify({ error: "Invalid token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body: ClassifyRequest = await req.json();
    const { transactionIds, organizationId } = body;

    console.log(`Classifying ${transactionIds.length} transactions for org ${organizationId}`);

    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("id, description, raw_description, amount, type, date")
      .in("id", transactionIds)
      .eq("organization_id", organizationId);

    if (txError || !transactions || transactions.length === 0) {
      console.log("No transactions found or error:", txError);
      return new Response(
        JSON.stringify({ error: "Transactions not found", details: txError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: historicalTx } = await supabase
      .from("transactions")
      .select(`
        description,
        category_id,
        cost_center_id,
        categories!inner(id, name),
        cost_centers(id, name)
      `)
      .eq("organization_id", organizationId)
      .eq("validation_status", "validated")
      .not("category_id", "is", null)
      .limit(1000);

    const patternMap = new Map<string, CategoryPattern>();
    
    for (const tx of historicalTx || []) {
      const keywords = (tx.description || "")
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w: string) => w.length >= 3);
      
      for (const keyword of keywords) {
        const existing = patternMap.get(keyword);
        if (existing) {
          existing.count++;
        } else {
          patternMap.set(keyword, {
            category_id: tx.category_id,
            category_name: (tx.categories as any)?.name || "",
            cost_center_id: tx.cost_center_id,
            cost_center_name: (tx.cost_centers as any)?.name || null,
            pattern: keyword,
            count: 1,
          });
        }
      }
    }

    const sortedPatterns = Array.from(patternMap.values())
      .sort((a, b) => b.count - a.count);

    console.log(`Found ${sortedPatterns.length} patterns from historical data`);

    const suggestions: any[] = [];
    
    for (const tx of transactions) {
      const description = (tx.raw_description || tx.description || "").toLowerCase();
      
      let bestMatch: CategoryPattern | null = null;
      let bestScore = 0;
      
      for (const pattern of sortedPatterns) {
        if (description.includes(pattern.pattern)) {
          const score = pattern.count * (description.indexOf(pattern.pattern) < 10 ? 2 : 1);
          if (score > bestScore) {
            bestScore = score;
            bestMatch = pattern;
          }
        }
      }

      let confidence = 0;
      let reasoning = "";
      
      if (bestMatch) {
        confidence = Math.min(0.95, 0.5 + (bestMatch.count / 100));
        
        const matchingPatterns = sortedPatterns.filter((p) => 
          description.includes(p.pattern) && p.category_id === bestMatch!.category_id
        );
        if (matchingPatterns.length > 1) {
          confidence = Math.min(0.95, confidence + 0.1);
        }
        
        reasoning = `Baseado em ${bestMatch.count} transações similares contendo "${bestMatch.pattern}". `;
        reasoning += `Categoria "${bestMatch.category_name}" é frequentemente usada para este tipo de descrição.`;
        
        if (bestMatch.cost_center_name) {
          reasoning += ` Centro de custo "${bestMatch.cost_center_name}" também sugerido.`;
        }
      } else {
        confidence = 0.3;
        reasoning = "Nenhum padrão histórico encontrado. Sugestão baseada apenas no tipo de transação.";
      }

      const suggestion = {
        transaction_id: tx.id,
        suggested_category_id: bestMatch?.category_id || null,
        suggested_cost_center_id: bestMatch?.cost_center_id || null,
        suggested_type: tx.type,
        suggested_competence_date: tx.date,
        confidence_score: parseFloat(confidence.toFixed(2)),
        reasoning,
        model_version: "pattern-matching-v1",
      };

      const { data: insertedSuggestion, error: insertError } = await supabase
        .from("ai_suggestions")
        .insert(suggestion)
        .select()
        .single();

      if (!insertError && insertedSuggestion) {
        suggestions.push(insertedSuggestion);
      } else if (insertError) {
        console.error("Error inserting suggestion:", insertError);
      }
    }

    console.log(`Created ${suggestions.length} AI suggestions`);

    return new Response(
      JSON.stringify({
        success: true,
        suggestionsCreated: suggestions.length,
        suggestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error classifying transactions:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
