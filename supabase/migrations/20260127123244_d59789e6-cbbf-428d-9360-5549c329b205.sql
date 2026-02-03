-- Add blocked status to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Add DRE category link to categories
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS dre_group TEXT CHECK (dre_group IN (
  'receita_operacional',
  'deducoes_receita', 
  'custo_produtos_vendidos',
  'despesas_operacionais',
  'despesas_administrativas',
  'despesas_financeiras',
  'outras_receitas',
  'outras_despesas',
  'impostos'
));