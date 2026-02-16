
-- Allow organization_id to be NULL for templates in reconciliation_rules
ALTER TABLE public.reconciliation_rules ALTER COLUMN organization_id DROP NOT NULL;

-- 1. Add is_system_template to categories (may already exist from partial run)
ALTER TABLE public.categories 
  ADD COLUMN IF NOT EXISTS is_system_template boolean NOT NULL DEFAULT false;
ALTER TABLE public.categories ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add is_system_template to reconciliation_rules  
ALTER TABLE public.reconciliation_rules
  ADD COLUMN IF NOT EXISTS is_system_template boolean NOT NULL DEFAULT false;
ALTER TABLE public.reconciliation_rules ALTER COLUMN user_id DROP NOT NULL;

-- 3. Clean up any partial template data from failed runs
DELETE FROM public.reconciliation_rules WHERE is_system_template = true;
DELETE FROM public.categories WHERE is_system_template = true;

-- 4. Insert template categories - INCOME parents
INSERT INTO public.categories (name, type, parent_id, dre_group, expense_classification, organization_id, user_id, is_system_template, icon, color)
VALUES
  ('Renda', 'income', NULL, 'receita_operacional', NULL, NULL, NULL, true, 'wallet', '#22C55E'),
  ('Renda Extra', 'income', NULL, 'outras_receitas', NULL, NULL, NULL, true, 'plus-circle', '#10B981'),
  ('Rendimentos', 'income', NULL, 'outras_receitas', NULL, NULL, NULL, true, 'trending-up', '#059669'),
  ('Outras Receitas', 'income', NULL, 'outras_receitas', NULL, NULL, NULL, true, 'folder', '#6B7280');

-- EXPENSE parents
INSERT INTO public.categories (name, type, parent_id, dre_group, expense_classification, organization_id, user_id, is_system_template, icon, color)
VALUES
  ('Moradia', 'expense', NULL, 'despesas_operacionais', 'fixa', NULL, NULL, true, 'home', '#EF4444'),
  ('Alimentação', 'expense', NULL, 'despesas_operacionais', 'variavel_recorrente', NULL, NULL, true, 'utensils', '#F97316'),
  ('Transporte', 'expense', NULL, 'despesas_operacionais', 'variavel_recorrente', NULL, NULL, true, 'car', '#EAB308'),
  ('Saúde', 'expense', NULL, 'despesas_operacionais', 'variavel_programada', NULL, NULL, true, 'heart-pulse', '#EC4899'),
  ('Educação', 'expense', NULL, 'despesas_operacionais', 'fixa', NULL, NULL, true, 'graduation-cap', '#8B5CF6'),
  ('Pessoal & Lazer', 'expense', NULL, 'despesas_operacionais', 'variavel_recorrente', NULL, NULL, true, 'smile', '#06B6D4'),
  ('Financeiras', 'expense', NULL, 'despesas_financeiras', 'variavel_programada', NULL, NULL, true, 'landmark', '#64748B'),
  ('Impostos', 'expense', NULL, 'impostos', 'fixa', NULL, NULL, true, 'receipt', '#DC2626'),
  ('Investimentos', 'expense', NULL, 'outras_despesas', 'variavel_programada', NULL, NULL, true, 'piggy-bank', '#0EA5E9'),
  ('Outros', 'expense', NULL, 'outras_despesas', 'variavel_recorrente', NULL, NULL, true, 'ellipsis', '#9CA3AF');

-- INCOME children
INSERT INTO public.categories (name, type, parent_id, dre_group, expense_classification, organization_id, user_id, is_system_template, icon, color)
VALUES
  ('Salário', 'income', (SELECT id FROM public.categories WHERE name='Renda' AND is_system_template=true AND parent_id IS NULL AND type='income' LIMIT 1), 'receita_operacional', NULL, NULL, NULL, true, 'wallet', '#22C55E'),
  ('Pró-labore', 'income', (SELECT id FROM public.categories WHERE name='Renda' AND is_system_template=true AND parent_id IS NULL AND type='income' LIMIT 1), 'receita_operacional', NULL, NULL, NULL, true, 'wallet', '#22C55E'),
  ('Pensão / Aposentadoria', 'income', (SELECT id FROM public.categories WHERE name='Renda' AND is_system_template=true AND parent_id IS NULL AND type='income' LIMIT 1), 'receita_operacional', NULL, NULL, NULL, true, 'wallet', '#22C55E'),
  ('Freelance', 'income', (SELECT id FROM public.categories WHERE name='Renda Extra' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'outras_receitas', NULL, NULL, NULL, true, 'plus-circle', '#10B981'),
  ('Comissão / Bônus', 'income', (SELECT id FROM public.categories WHERE name='Renda Extra' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'outras_receitas', NULL, NULL, NULL, true, 'plus-circle', '#10B981'),
  ('Investimentos', 'income', (SELECT id FROM public.categories WHERE name='Rendimentos' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'outras_receitas', NULL, NULL, NULL, true, 'trending-up', '#059669'),
  ('Aluguel', 'income', (SELECT id FROM public.categories WHERE name='Rendimentos' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'outras_receitas', NULL, NULL, NULL, true, 'trending-up', '#059669'),
  ('Reembolsos', 'income', (SELECT id FROM public.categories WHERE name='Outras Receitas' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'outras_receitas', NULL, NULL, NULL, true, 'folder', '#6B7280'),
  ('Venda de bens', 'income', (SELECT id FROM public.categories WHERE name='Outras Receitas' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'outras_receitas', NULL, NULL, NULL, true, 'folder', '#6B7280');

-- EXPENSE children
INSERT INTO public.categories (name, type, parent_id, dre_group, expense_classification, organization_id, user_id, is_system_template, icon, color)
VALUES
  ('Aluguel / Financiamento', 'expense', (SELECT id FROM public.categories WHERE name='Moradia' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'fixa', NULL, NULL, true, 'home', '#EF4444'),
  ('Contas da casa', 'expense', (SELECT id FROM public.categories WHERE name='Moradia' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'fixa', NULL, NULL, true, 'home', '#EF4444'),
  ('Condomínio / IPTU', 'expense', (SELECT id FROM public.categories WHERE name='Moradia' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'fixa', NULL, NULL, true, 'home', '#EF4444'),
  ('Supermercado', 'expense', (SELECT id FROM public.categories WHERE name='Alimentação' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'variavel_recorrente', NULL, NULL, true, 'utensils', '#F97316'),
  ('Refeições fora', 'expense', (SELECT id FROM public.categories WHERE name='Alimentação' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'variavel_recorrente', NULL, NULL, true, 'utensils', '#F97316'),
  ('Combustível', 'expense', (SELECT id FROM public.categories WHERE name='Transporte' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'variavel_recorrente', NULL, NULL, true, 'car', '#EAB308'),
  ('Transporte público / Apps', 'expense', (SELECT id FROM public.categories WHERE name='Transporte' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'variavel_recorrente', NULL, NULL, true, 'car', '#EAB308'),
  ('Plano de saúde', 'expense', (SELECT id FROM public.categories WHERE name='Saúde' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'fixa', NULL, NULL, true, 'heart-pulse', '#EC4899'),
  ('Medicamentos / Consultas', 'expense', (SELECT id FROM public.categories WHERE name='Saúde' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'variavel_programada', NULL, NULL, true, 'heart-pulse', '#EC4899'),
  ('Cursos / Mensalidades', 'expense', (SELECT id FROM public.categories WHERE name='Educação' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'fixa', NULL, NULL, true, 'graduation-cap', '#8B5CF6'),
  ('Vestuário', 'expense', (SELECT id FROM public.categories WHERE name='Pessoal & Lazer' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'variavel_programada', NULL, NULL, true, 'smile', '#06B6D4'),
  ('Lazer / Assinaturas', 'expense', (SELECT id FROM public.categories WHERE name='Pessoal & Lazer' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_operacionais', 'variavel_recorrente', NULL, NULL, true, 'smile', '#06B6D4'),
  ('Cartão de crédito', 'expense', (SELECT id FROM public.categories WHERE name='Financeiras' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_financeiras', 'variavel_programada', NULL, NULL, true, 'landmark', '#64748B'),
  ('Juros / Tarifas', 'expense', (SELECT id FROM public.categories WHERE name='Financeiras' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'despesas_financeiras', 'variavel_programada', NULL, NULL, true, 'landmark', '#64748B'),
  ('Imposto de renda', 'expense', (SELECT id FROM public.categories WHERE name='Impostos' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'impostos', 'fixa', NULL, NULL, true, 'receipt', '#DC2626'),
  ('Taxas', 'expense', (SELECT id FROM public.categories WHERE name='Impostos' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'impostos', 'fixa', NULL, NULL, true, 'receipt', '#DC2626'),
  ('Aportes / Reserva', 'expense', (SELECT id FROM public.categories WHERE name='Investimentos' AND is_system_template=true AND parent_id IS NULL AND type='expense' LIMIT 1), 'outras_despesas', 'variavel_programada', NULL, NULL, true, 'piggy-bank', '#0EA5E9'),
  ('Doações', 'expense', (SELECT id FROM public.categories WHERE name='Outros' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'outras_despesas', 'variavel_recorrente', NULL, NULL, true, 'ellipsis', '#9CA3AF'),
  ('Despesas eventuais', 'expense', (SELECT id FROM public.categories WHERE name='Outros' AND is_system_template=true AND parent_id IS NULL LIMIT 1), 'outras_despesas', 'variavel_recorrente', NULL, NULL, true, 'ellipsis', '#9CA3AF');

-- 5. Insert template reconciliation rules
INSERT INTO public.reconciliation_rules (description, amount, transaction_type, category_id, organization_id, user_id, is_system_template, is_active)
SELECT keyword, 0, 'expense', c.id, NULL, NULL, true, true
FROM (VALUES
  ('carrefour', 'Supermercado'), ('extra', 'Supermercado'), ('assai', 'Supermercado'), ('atacadao', 'Supermercado'),
  ('pao de acucar', 'Supermercado'), ('supermercado', 'Supermercado'), ('mercado', 'Supermercado'), ('hortifruti', 'Supermercado'),
  ('ifood', 'Refeições fora'), ('uber eats', 'Refeições fora'), ('rappi', 'Refeições fora'), ('restaurante', 'Refeições fora'),
  ('lanchonete', 'Refeições fora'), ('pizza', 'Refeições fora'), ('padaria', 'Refeições fora'), ('cafe', 'Refeições fora'),
  ('posto', 'Combustível'), ('ipiranga', 'Combustível'), ('shell', 'Combustível'), ('gasolina', 'Combustível'),
  ('uber', 'Transporte público / Apps'), ('99', 'Transporte público / Apps'), ('metro', 'Transporte público / Apps'),
  ('aluguel', 'Aluguel / Financiamento'), ('locacao', 'Aluguel / Financiamento'), ('financiamento', 'Aluguel / Financiamento'),
  ('enel', 'Contas da casa'), ('cpfl', 'Contas da casa'), ('luz', 'Contas da casa'), ('energia', 'Contas da casa'),
  ('sabesp', 'Contas da casa'), ('agua', 'Contas da casa'), ('gas', 'Contas da casa'),
  ('vivo', 'Contas da casa'), ('claro', 'Contas da casa'), ('tim', 'Contas da casa'), ('internet', 'Contas da casa'),
  ('condominio', 'Condomínio / IPTU'), ('iptu', 'Condomínio / IPTU'),
  ('unimed', 'Plano de saúde'), ('amil', 'Plano de saúde'), ('plano de saude', 'Plano de saúde'),
  ('farmacia', 'Medicamentos / Consultas'), ('drogasil', 'Medicamentos / Consultas'), ('consulta', 'Medicamentos / Consultas'),
  ('curso', 'Cursos / Mensalidades'), ('mensalidade', 'Cursos / Mensalidades'), ('udemy', 'Cursos / Mensalidades'),
  ('renner', 'Vestuário'), ('riachuelo', 'Vestuário'), ('zara', 'Vestuário'),
  ('netflix', 'Lazer / Assinaturas'), ('spotify', 'Lazer / Assinaturas'), ('amazon prime', 'Lazer / Assinaturas'),
  ('juros', 'Juros / Tarifas'), ('tarifa', 'Juros / Tarifas'), ('anuidade', 'Juros / Tarifas'),
  ('irrf', 'Imposto de renda'), ('imposto de renda', 'Imposto de renda'),
  ('taxa', 'Taxas'),
  ('doacao', 'Doações')
) AS rules(keyword, cat_name)
JOIN public.categories c ON c.name = rules.cat_name AND c.is_system_template = true AND c.parent_id IS NOT NULL;

-- 6. Create the provisioning function
CREATE OR REPLACE FUNCTION public.provision_organization_from_template(p_org_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_map jsonb := '{}'::jsonb;
  v_category_map jsonb := '{}'::jsonb;
  rec RECORD;
  new_id uuid;
  new_parent_id uuid;
  v_cat_count integer := 0;
  v_rule_count integer := 0;
BEGIN
  -- Check if already provisioned
  IF EXISTS (SELECT 1 FROM categories WHERE organization_id = p_org_id LIMIT 1) THEN
    RETURN jsonb_build_object('success', true, 'already_provisioned', true);
  END IF;

  -- Step 1: Copy parent categories
  FOR rec IN
    SELECT id, name, type, dre_group, expense_classification, icon, color
    FROM categories
    WHERE is_system_template = true AND parent_id IS NULL
    ORDER BY type, name
  LOOP
    INSERT INTO categories (name, type, parent_id, dre_group, expense_classification, icon, color, organization_id, user_id, is_system_template)
    VALUES (rec.name, rec.type, NULL, rec.dre_group, rec.expense_classification, rec.icon, rec.color, p_org_id, p_user_id, false)
    RETURNING id INTO new_id;
    
    v_parent_map := v_parent_map || jsonb_build_object(rec.id::text, new_id::text);
    v_category_map := v_category_map || jsonb_build_object(rec.id::text, new_id::text);
    v_cat_count := v_cat_count + 1;
  END LOOP;

  -- Step 2: Copy child categories with mapped parent_id
  FOR rec IN
    SELECT id, name, type, parent_id, dre_group, expense_classification, icon, color
    FROM categories
    WHERE is_system_template = true AND parent_id IS NOT NULL
    ORDER BY name
  LOOP
    new_parent_id := (v_parent_map->>rec.parent_id::text)::uuid;
    
    IF new_parent_id IS NOT NULL THEN
      INSERT INTO categories (name, type, parent_id, dre_group, expense_classification, icon, color, organization_id, user_id, is_system_template)
      VALUES (rec.name, rec.type, new_parent_id, rec.dre_group, rec.expense_classification, rec.icon, rec.color, p_org_id, p_user_id, false)
      RETURNING id INTO new_id;
      
      v_category_map := v_category_map || jsonb_build_object(rec.id::text, new_id::text);
      v_cat_count := v_cat_count + 1;
    END IF;
  END LOOP;

  -- Step 3: Copy reconciliation rules with mapped category_id
  FOR rec IN
    SELECT description, amount, transaction_type, category_id, is_active
    FROM reconciliation_rules
    WHERE is_system_template = true
  LOOP
    new_id := (v_category_map->>rec.category_id::text)::uuid;
    
    IF new_id IS NOT NULL THEN
      INSERT INTO reconciliation_rules (description, amount, transaction_type, category_id, organization_id, user_id, is_system_template, is_active)
      VALUES (rec.description, rec.amount, rec.transaction_type, new_id, p_org_id, p_user_id, false, rec.is_active);
      
      v_rule_count := v_rule_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'already_provisioned', false,
    'categories_created', v_cat_count,
    'rules_created', v_rule_count
  );
END;
$$;

-- 7. Update RLS to exclude templates from normal user queries
DROP POLICY IF EXISTS "categories_select_secure" ON public.categories;
CREATE POLICY "categories_select_secure" ON public.categories
  FOR SELECT USING (
    (is_system_template = false AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR organization_id IN (SELECT get_viewable_organizations(auth.uid()))
    ))
    OR (is_system_template = true AND has_role(auth.uid(), 'admin'::app_role))
  );

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_categories_system_template ON public.categories (is_system_template) WHERE is_system_template = true;
CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_system_template ON public.reconciliation_rules (is_system_template) WHERE is_system_template = true;
