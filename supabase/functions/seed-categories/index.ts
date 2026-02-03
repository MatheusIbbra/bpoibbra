import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Initial categories structure with DRE mapping
const initialCategories = [
  // RECEITA - PAI
  { id: 1, type: "income", name: "Renda", parent_id: null, dre_group: "receita_operacional" },
  { id: 2, type: "income", name: "Renda Extra", parent_id: null, dre_group: "outras_receitas" },
  { id: 3, type: "income", name: "Rendimentos", parent_id: null, dre_group: "receitas_financeiras" },
  { id: 4, type: "income", name: "Outras Receitas", parent_id: null, dre_group: "outras_receitas" },
  // DESPESA - PAI
  { id: 5, type: "expense", name: "Moradia", parent_id: null, dre_group: "despesas_operacionais" },
  { id: 6, type: "expense", name: "Alimentação", parent_id: null, dre_group: "despesas_operacionais" },
  { id: 7, type: "expense", name: "Transporte", parent_id: null, dre_group: "despesas_operacionais" },
  { id: 8, type: "expense", name: "Saúde", parent_id: null, dre_group: "despesas_operacionais" },
  { id: 9, type: "expense", name: "Educação", parent_id: null, dre_group: "despesas_operacionais" },
  { id: 10, type: "expense", name: "Pessoal & Lazer", parent_id: null, dre_group: "despesas_operacionais" },
  { id: 11, type: "expense", name: "Financeiras", parent_id: null, dre_group: "despesas_financeiras" },
  { id: 12, type: "expense", name: "Impostos", parent_id: null, dre_group: "impostos" },
  { id: 13, type: "expense", name: "Investimentos", parent_id: null, dre_group: "outras_despesas" },
  { id: 14, type: "expense", name: "Outros", parent_id: null, dre_group: "outras_despesas" },
  // RECEITA - FILHA (herdam o dre_group do pai)
  { id: 15, type: "income", name: "Salário", parent_id: 1, dre_group: "receita_operacional" },
  { id: 16, type: "income", name: "Pró-labore", parent_id: 1, dre_group: "receita_operacional" },
  { id: 17, type: "income", name: "Pensão / Aposentadoria", parent_id: 1, dre_group: "receita_operacional" },
  { id: 18, type: "income", name: "Freelance", parent_id: 2, dre_group: "outras_receitas" },
  { id: 19, type: "income", name: "Comissão / Bônus", parent_id: 2, dre_group: "outras_receitas" },
  { id: 20, type: "income", name: "Investimentos", parent_id: 3, dre_group: "receitas_financeiras" },
  { id: 21, type: "income", name: "Aluguel", parent_id: 3, dre_group: "receitas_financeiras" },
  { id: 22, type: "income", name: "Reembolsos", parent_id: 4, dre_group: "outras_receitas" },
  { id: 23, type: "income", name: "Venda de bens", parent_id: 4, dre_group: "outras_receitas" },
  // DESPESA - FILHA (herdam o dre_group do pai)
  { id: 24, type: "expense", name: "Aluguel / Financiamento", parent_id: 5, dre_group: "despesas_operacionais" },
  { id: 25, type: "expense", name: "Contas da casa", parent_id: 5, dre_group: "despesas_operacionais" },
  { id: 26, type: "expense", name: "Condomínio / IPTU", parent_id: 5, dre_group: "despesas_operacionais" },
  { id: 27, type: "expense", name: "Supermercado", parent_id: 6, dre_group: "despesas_operacionais" },
  { id: 28, type: "expense", name: "Refeições fora", parent_id: 6, dre_group: "despesas_operacionais" },
  { id: 29, type: "expense", name: "Combustível", parent_id: 7, dre_group: "despesas_operacionais" },
  { id: 30, type: "expense", name: "Transporte público / Apps", parent_id: 7, dre_group: "despesas_operacionais" },
  { id: 31, type: "expense", name: "Plano de saúde", parent_id: 8, dre_group: "despesas_operacionais" },
  { id: 32, type: "expense", name: "Medicamentos / Consultas", parent_id: 8, dre_group: "despesas_operacionais" },
  { id: 33, type: "expense", name: "Cursos / Mensalidades", parent_id: 9, dre_group: "despesas_operacionais" },
  { id: 34, type: "expense", name: "Vestuário", parent_id: 10, dre_group: "despesas_operacionais" },
  { id: 35, type: "expense", name: "Lazer / Assinaturas", parent_id: 10, dre_group: "despesas_operacionais" },
  { id: 36, type: "expense", name: "Cartão de crédito", parent_id: 11, dre_group: "despesas_financeiras" },
  { id: 37, type: "expense", name: "Juros / Tarifas", parent_id: 11, dre_group: "despesas_financeiras" },
  { id: 38, type: "expense", name: "Imposto de renda", parent_id: 12, dre_group: "impostos" },
  { id: 39, type: "expense", name: "Taxas", parent_id: 12, dre_group: "impostos" },
  { id: 40, type: "expense", name: "Aportes / Reserva", parent_id: 13, dre_group: "outras_despesas" },
  { id: 41, type: "expense", name: "Doações", parent_id: 14, dre_group: "outras_despesas" },
  { id: 42, type: "expense", name: "Despesas eventuais", parent_id: 14, dre_group: "outras_despesas" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user's token for RLS
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the user
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      throw new Error("Unauthorized");
    }

    const userId = userData.user.id;
    const { organization_id } = await req.json();

    // Check if categories already exist for this user/organization
    let existingQuery = supabaseUser
      .from("categories")
      .select("id")
      .eq("user_id", userId);
    
    if (organization_id) {
      existingQuery = existingQuery.eq("organization_id", organization_id);
    }

    const { data: existing } = await existingQuery.limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Categories already exist", seeded: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for inserting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create parent categories first (those without parent_id)
    const parentCategories = initialCategories.filter(c => c.parent_id === null);
    const childCategories = initialCategories.filter(c => c.parent_id !== null);

    // Map old IDs to new UUIDs
    const idMap: Record<number, string> = {};

    // Insert parent categories
    for (const cat of parentCategories) {
      const { data, error } = await supabaseAdmin
        .from("categories")
        .insert({
          name: cat.name,
          type: cat.type as "income" | "expense",
          user_id: userId,
          organization_id: organization_id || null,
          dre_group: cat.dre_group || null,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`Error inserting parent category ${cat.name}:`, error);
        throw error;
      }

      idMap[cat.id] = data.id;
    }

    // Insert child categories with correct parent references
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
        });

      if (error) {
        console.error(`Error inserting child category ${cat.name}:`, error);
        throw error;
      }
    }

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
    console.error("Error seeding categories:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
