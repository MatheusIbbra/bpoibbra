import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Normalize text: lowercase and remove accents
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Initial reconciliation rules with keywords
// Keywords are matched against normalized transaction descriptions (lowercase, no accents)
const initialRules = [
  // Alimentação – Supermercado
  {
    keywords: ["carrefour", "extra", "assai", "atacadao", "big", "pao de acucar", "supermercado", "mercado", "hortifruti"],
    categoryName: "Supermercado",
    transactionType: "expense",
  },
  // Alimentação – Refeições fora
  {
    keywords: ["ifood", "uber eats", "rappi", "restaurante", "lanchonete", "pizza", "hamburguer", "bar", "cafe", "padaria"],
    categoryName: "Refeições fora",
    transactionType: "expense",
  },
  // Transporte – Combustível
  {
    keywords: ["posto", "ipiranga", "shell", "petrobras", "ale", "gasolina", "etanol", "diesel"],
    categoryName: "Combustível",
    transactionType: "expense",
  },
  // Transporte – Transporte / Apps
  {
    keywords: ["uber", "99", "cabify", "indrive", "metro", "metro sp", "cptm", "onibus"],
    categoryName: "Transporte público / Apps",
    transactionType: "expense",
  },
  // Moradia – Aluguel / Financiamento
  {
    keywords: ["aluguel", "locacao", "financiamento", "habitacional", "caixa habitacao"],
    categoryName: "Aluguel / Financiamento",
    transactionType: "expense",
  },
  // Moradia – Contas da casa
  {
    keywords: ["enel", "cpfl", "energisa", "luz", "energia", "sabesp", "copasa", "sanepar", "agua", "gas"],
    categoryName: "Contas da casa",
    transactionType: "expense",
  },
  // Moradia – Internet / Telefonia (maps to Contas da casa as there's no specific subcategory)
  {
    keywords: ["vivo", "claro", "tim", "oi", "internet", "banda larga", "telefone", "telefonia"],
    categoryName: "Contas da casa",
    transactionType: "expense",
  },
  // Moradia – Condomínio / IPTU
  {
    keywords: ["condominio", "iptu", "prefeitura"],
    categoryName: "Condomínio / IPTU",
    transactionType: "expense",
  },
  // Saúde – Plano de saúde
  {
    keywords: ["unimed", "amil", "bradesco saude", "sulamerica", "hapvida", "plano de saude"],
    categoryName: "Plano de saúde",
    transactionType: "expense",
  },
  // Saúde – Medicamentos / Consultas
  {
    keywords: ["farmacia", "drogasil", "droga raia", "pague menos", "consulta", "clinica", "hospital", "laboratorio"],
    categoryName: "Medicamentos / Consultas",
    transactionType: "expense",
  },
  // Educação – Cursos / Mensalidades
  {
    keywords: ["curso", "faculdade", "universidade", "mensalidade", "udemy", "alura", "hotmart", "coursera"],
    categoryName: "Cursos / Mensalidades",
    transactionType: "expense",
  },
  // Pessoal & Lazer – Vestuário
  {
    keywords: ["renner", "riachuelo", "cea", "zara", "roupa", "vestuario"],
    categoryName: "Vestuário",
    transactionType: "expense",
  },
  // Pessoal & Lazer – Lazer / Assinaturas
  {
    keywords: ["netflix", "spotify", "amazon prime", "prime video", "hbo", "disney", "cinema", "teatro"],
    categoryName: "Lazer / Assinaturas",
    transactionType: "expense",
  },
  // Financeiras – Juros / Tarifas
  {
    keywords: ["juros", "tarifa", "anuidade", "encargos", "mora"],
    categoryName: "Juros / Tarifas",
    transactionType: "expense",
  },
  // Impostos – Imposto de renda
  {
    keywords: ["irrf", "imposto de renda", "receita federal"],
    categoryName: "Imposto de renda",
    transactionType: "expense",
  },
  // Impostos – Taxas
  {
    keywords: ["taxa", "emolumento", "registro"],
    categoryName: "Taxas",
    transactionType: "expense",
  },
  // Outros – Doações
  {
    keywords: ["doacao", "ong", "instituto"],
    categoryName: "Doações",
    transactionType: "expense",
  },
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

    if (!organization_id) {
      throw new Error("organization_id is required");
    }

    // Check if rules already exist for this organization
    const { data: existingRules } = await supabaseUser
      .from("reconciliation_rules")
      .select("id")
      .eq("organization_id", organization_id)
      .limit(1);

    if (existingRules && existingRules.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Reconciliation rules already exist", seeded: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch categories for this organization to map names to IDs
    const { data: categories, error: catError } = await supabaseUser
      .from("categories")
      .select("id, name, type, parent_id")
      .eq("organization_id", organization_id);

    if (catError) {
      throw catError;
    }

    // Build a map of category name -> ID (only for child categories)
    const categoryMap: Record<string, string> = {};
    categories?.forEach(cat => {
      if (cat.parent_id) {
        // Normalize the category name for matching
        const normalizedName = normalizeText(cat.name);
        categoryMap[normalizedName] = cat.id;
      }
    });

    // Use service role client for inserting
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    let createdCount = 0;
    let skippedCount = 0;

    // Create rules for each keyword pattern
    for (const ruleConfig of initialRules) {
      // Find the matching category
      const normalizedCategoryName = normalizeText(ruleConfig.categoryName);
      const categoryId = categoryMap[normalizedCategoryName];

      if (!categoryId) {
        console.log(`Category not found: ${ruleConfig.categoryName} (normalized: ${normalizedCategoryName})`);
        skippedCount += ruleConfig.keywords.length;
        continue;
      }

      // Create a rule for each keyword
      for (const keyword of ruleConfig.keywords) {
        const { error } = await supabaseAdmin
          .from("reconciliation_rules")
          .insert({
            description: keyword,
            amount: 0, // Amount is not relevant for keyword matching
            transaction_type: ruleConfig.transactionType,
            category_id: categoryId,
            organization_id: organization_id,
            user_id: userId,
            is_active: true,
          });

        if (error) {
          console.error(`Error inserting rule for keyword ${keyword}:`, error);
          skippedCount++;
        } else {
          createdCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reconciliation rules seeded successfully`, 
        seeded: true,
        created: createdCount,
        skipped: skippedCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error seeding reconciliation rules:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
