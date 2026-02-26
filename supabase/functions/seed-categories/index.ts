import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Initial categories structure with DRE mapping and expense classification
const initialCategories = [
  // RECEITA - PAI
  { id: 1, type: "income", name: "Renda", parent_id: null, dre_group: "receita_operacional", expense_classification: null },
  { id: 2, type: "income", name: "Renda Extra", parent_id: null, dre_group: "outras_receitas", expense_classification: null },
  { id: 3, type: "income", name: "Rendimentos", parent_id: null, dre_group: "outras_receitas", expense_classification: null },
  { id: 4, type: "income", name: "Outras Receitas", parent_id: null, dre_group: "outras_receitas", expense_classification: null },
  // DESPESA - PAI (with expense_classification)
  { id: 5, type: "expense", name: "Moradia", parent_id: null, dre_group: "despesas_operacionais", expense_classification: "fixa" },
  { id: 6, type: "expense", name: "Alimentação", parent_id: null, dre_group: "despesas_operacionais", expense_classification: "variavel_recorrente" },
  { id: 7, type: "expense", name: "Transporte", parent_id: null, dre_group: "despesas_operacionais", expense_classification: "variavel_recorrente" },
  { id: 8, type: "expense", name: "Saúde", parent_id: null, dre_group: "despesas_operacionais", expense_classification: "variavel_programada" },
  { id: 9, type: "expense", name: "Educação", parent_id: null, dre_group: "despesas_operacionais", expense_classification: "fixa" },
  { id: 10, type: "expense", name: "Pessoal & Lazer", parent_id: null, dre_group: "despesas_operacionais", expense_classification: "variavel_recorrente" },
  { id: 11, type: "expense", name: "Financeiras", parent_id: null, dre_group: "despesas_financeiras", expense_classification: "variavel_programada" },
  { id: 12, type: "expense", name: "Impostos", parent_id: null, dre_group: "impostos", expense_classification: "fixa" },
  { id: 13, type: "expense", name: "Investimentos", parent_id: null, dre_group: "outras_despesas", expense_classification: "variavel_programada" },
  { id: 14, type: "expense", name: "Outros", parent_id: null, dre_group: "outras_despesas", expense_classification: "variavel_recorrente" },
  // RECEITA - FILHA
  { id: 15, type: "income", name: "Salário", parent_id: 1, dre_group: "receita_operacional", expense_classification: null },
  { id: 16, type: "income", name: "Pró-labore", parent_id: 1, dre_group: "receita_operacional", expense_classification: null },
  { id: 17, type: "income", name: "Pensão / Aposentadoria", parent_id: 1, dre_group: "receita_operacional", expense_classification: null },
  { id: 18, type: "income", name: "Freelance", parent_id: 2, dre_group: "outras_receitas", expense_classification: null },
  { id: 19, type: "income", name: "Comissão / Bônus", parent_id: 2, dre_group: "outras_receitas", expense_classification: null },
  { id: 20, type: "income", name: "Investimentos", parent_id: 3, dre_group: "outras_receitas", expense_classification: null },
  { id: 21, type: "income", name: "Aluguel", parent_id: 3, dre_group: "outras_receitas", expense_classification: null },
  { id: 22, type: "income", name: "Reembolsos", parent_id: 4, dre_group: "outras_receitas", expense_classification: null },
  { id: 23, type: "income", name: "Receitas Diversas", parent_id: 4, dre_group: "outras_receitas", expense_classification: null },
  // DESPESA - FILHA
  { id: 24, type: "expense", name: "Aluguel / Financiamento", parent_id: 5, dre_group: "despesas_operacionais", expense_classification: "fixa" },
  { id: 25, type: "expense", name: "Contas da casa", parent_id: 5, dre_group: "despesas_operacionais", expense_classification: "fixa" },
  { id: 26, type: "expense", name: "Condomínio / IPTU", parent_id: 5, dre_group: "despesas_operacionais", expense_classification: "fixa" },
  { id: 27, type: "expense", name: "Supermercado", parent_id: 6, dre_group: "despesas_operacionais", expense_classification: "variavel_recorrente" },
  { id: 28, type: "expense", name: "Refeições fora", parent_id: 6, dre_group: "despesas_operacionais", expense_classification: "variavel_recorrente" },
  { id: 29, type: "expense", name: "Combustível", parent_id: 7, dre_group: "despesas_operacionais", expense_classification: "variavel_recorrente" },
  { id: 30, type: "expense", name: "Transporte público / Apps", parent_id: 7, dre_group: "despesas_operacionais", expense_classification: "variavel_recorrente" },
  { id: 31, type: "expense", name: "Plano de saúde", parent_id: 8, dre_group: "despesas_operacionais", expense_classification: "fixa" },
  { id: 32, type: "expense", name: "Medicamentos / Consultas", parent_id: 8, dre_group: "despesas_operacionais", expense_classification: "variavel_programada" },
  { id: 33, type: "expense", name: "Cursos / Mensalidades", parent_id: 9, dre_group: "despesas_operacionais", expense_classification: "fixa" },
  { id: 34, type: "expense", name: "Vestuário", parent_id: 10, dre_group: "despesas_operacionais", expense_classification: "variavel_programada" },
  { id: 35, type: "expense", name: "Lazer / Assinaturas", parent_id: 10, dre_group: "despesas_operacionais", expense_classification: "variavel_recorrente" },
  { id: 36, type: "expense", name: "Cartão de crédito", parent_id: 11, dre_group: "despesas_financeiras", expense_classification: "variavel_programada" },
  { id: 37, type: "expense", name: "Juros / Tarifas", parent_id: 11, dre_group: "despesas_financeiras", expense_classification: "variavel_programada" },
  { id: 38, type: "expense", name: "Imposto de renda", parent_id: 12, dre_group: "impostos", expense_classification: "fixa" },
  { id: 39, type: "expense", name: "Taxas", parent_id: 12, dre_group: "impostos", expense_classification: "fixa" },
  { id: 40, type: "expense", name: "Aportes / Reserva", parent_id: 13, dre_group: "outras_despesas", expense_classification: "variavel_programada" },
  { id: 41, type: "expense", name: "Doações", parent_id: 14, dre_group: "outras_despesas", expense_classification: "variavel_recorrente" },
  { id: 42, type: "expense", name: "Despesas eventuais", parent_id: 14, dre_group: "outras_despesas", expense_classification: "variavel_recorrente" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("[seed-categories] Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Authorization header is required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user with anon client + user token
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    
    // Try getClaims first, fallback to getUser via admin client
    let userId: string;
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    
    if (!claimsError && claimsData?.claims?.sub) {
      userId = claimsData.claims.sub as string;
      console.log("[seed-categories] Auth via getClaims OK, userId:", userId);
    } else {
      // Fallback: use admin client to validate
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: userData, error: userError } = await adminClient.auth.getUser(token);
      if (userError || !userData.user) {
        console.error("[seed-categories] Auth failed:", claimsError?.message, userError?.message);
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = userData.user.id;
      console.log("[seed-categories] Auth via getUser fallback OK, userId:", userId);
    }

    const { organization_id } = await req.json();
    console.log("[seed-categories] org_id:", organization_id, "user_id:", userId);

    // Use admin client for all DB operations to avoid RLS issues
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if categories already exist for this organization
    let existingQuery = supabaseAdmin
      .from("categories")
      .select("id")
      .eq("user_id", userId);
    
    if (organization_id) {
      existingQuery = existingQuery.eq("organization_id", organization_id);
    }

    const { data: existing, error: existingError } = await existingQuery.limit(1);

    if (existingError) {
      console.error("[seed-categories] Error checking existing:", existingError);
      throw existingError;
    }

    if (existing && existing.length > 0) {
      console.log("[seed-categories] Categories already exist, skipping");
      return new Response(
        JSON.stringify({ success: true, message: "Categories already exist", seeded: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create parent categories first
    const parentCategories = initialCategories.filter(c => c.parent_id === null);
    const childCategories = initialCategories.filter(c => c.parent_id !== null);
    const idMap: Record<number, string> = {};

    for (const cat of parentCategories) {
      const { data, error } = await supabaseAdmin
        .from("categories")
        .insert({
          name: cat.name,
          type: cat.type as "income" | "expense",
          user_id: userId,
          organization_id: organization_id || null,
          dre_group: cat.dre_group || null,
          expense_classification: cat.expense_classification || null,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`[seed-categories] Error inserting parent "${cat.name}":`, error);
        throw error;
      }
      idMap[cat.id] = data.id;
    }

    for (const cat of childCategories) {
      const parentUuid = idMap[cat.parent_id!];
      const { error } = await supabaseAdmin
        .from("categories")
        .insert({
          name: cat.name,
          type: cat.type as "income" | "expense",
          user_id: userId,
          organization_id: organization_id || null,
          parent_id: parentUuid,
          dre_group: cat.dre_group || null,
          expense_classification: cat.expense_classification || null,
        });

      if (error) {
        console.error(`[seed-categories] Error inserting child "${cat.name}":`, error);
        throw error;
      }
    }

    console.log(`[seed-categories] Successfully seeded ${initialCategories.length} categories`);
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Categories seeded successfully", 
        seeded: true,
        count: initialCategories.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[seed-categories] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
