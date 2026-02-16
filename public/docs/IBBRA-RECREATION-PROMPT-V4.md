# IBBRA — Prompt de Recriação v4.0

> **Objetivo:** Recriar o sistema IBBRA do zero em caso de disaster recovery.  
> **Dividido em 5 Etapas** para execução sequencial.  
> **Data de referência:** Fevereiro 2026

---

## ETAPA 1: Fundação — Banco de Dados e Autenticação

### 1.1 Criar Projeto Supabase
- Região: South America (São Paulo)
- Habilitar Auth com email/password

### 1.2 Tabelas Core

```sql
-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  base_currency TEXT NOT NULL DEFAULT 'BRL',
  cpf_cnpj TEXT,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  kam_id UUID,
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  cpf TEXT,
  phone TEXT,
  address TEXT,
  birth_date DATE,
  avatar_url TEXT,
  is_ibbra_client BOOLEAN DEFAULT false,
  external_client_validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMPTZ,
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER_ROLES (enum: admin, supervisor, fa, kam, cliente)
CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'fa', 'kam', 'cliente');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER_HIERARCHY
CREATE TABLE public.user_hierarchy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supervisor_id UUID NOT NULL,
  subordinate_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supervisor_id, subordinate_id)
);

-- ORGANIZATION_MEMBERS
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- ACCOUNTS
CREATE TYPE public.account_type AS ENUM ('checking', 'savings', 'credit_card', 'investment', 'wallet');
CREATE TYPE public.account_status AS ENUM ('active', 'inactive');

CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  bank_name TEXT,
  account_type account_type NOT NULL DEFAULT 'checking',
  currency_code TEXT NOT NULL DEFAULT 'BRL',
  initial_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  official_balance NUMERIC,
  last_official_balance_at TIMESTAMPTZ,
  start_date DATE,
  color TEXT DEFAULT '#3B82F6',
  status account_status DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CATEGORIES
CREATE TYPE public.category_type AS ENUM ('income', 'expense');

CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  type category_type NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6B7280',
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  dre_group TEXT,
  expense_classification TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COST_CENTERS
CREATE TABLE public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRANSACTIONS
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  user_id UUID NOT NULL,
  description TEXT,
  normalized_description TEXT,
  raw_description TEXT,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL, -- income, expense, transfer, investment, redemption
  date DATE NOT NULL,
  accrual_date DATE,
  category_id UUID REFERENCES categories(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  status TEXT DEFAULT 'completed', -- pending, completed, cancelled
  validation_status TEXT DEFAULT 'pending_validation',
  classification_source TEXT, -- rule, pattern, ai, manual
  transaction_hash TEXT,
  external_transaction_id TEXT,
  linked_transaction_id UUID REFERENCES transactions(id),
  import_batch_id UUID,
  is_ignored BOOLEAN DEFAULT false,
  financial_type TEXT,
  notes TEXT,
  paid_amount NUMERIC,
  payment_method TEXT,
  due_date DATE,
  payment_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RECONCILIATION_RULES
CREATE TABLE public.reconciliation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  description TEXT NOT NULL,
  transaction_type TEXT NOT NULL DEFAULT 'expense',
  amount NUMERIC NOT NULL,
  due_day INTEGER,
  category_id UUID REFERENCES categories(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRANSACTION_PATTERNS
CREATE TABLE public.transaction_patterns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  normalized_description TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  avg_amount NUMERIC DEFAULT 0,
  occurrences INTEGER DEFAULT 1,
  confidence NUMERIC DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BUDGETS
CREATE TABLE public.budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IMPORT_BATCHES
CREATE TYPE public.import_status AS ENUM ('pending', 'processing', 'awaiting_validation', 'completed', 'failed');

CREATE TABLE public.import_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  status import_status NOT NULL DEFAULT 'pending',
  total_transactions INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  error_message TEXT,
  period_start DATE,
  period_end DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI_SUGGESTIONS
CREATE TABLE public.ai_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  suggested_category_id UUID REFERENCES categories(id),
  suggested_cost_center_id UUID REFERENCES cost_centers(id),
  suggested_type TEXT,
  suggested_competence_date DATE,
  confidence_score NUMERIC,
  reasoning TEXT,
  model_version TEXT,
  was_accepted BOOLEAN,
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AUDIT_LOG
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  organization_id UUID REFERENCES organizations(id),
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.3 Funções RPC Essenciais

```sql
-- get_viewable_organizations: retorna UUIDs de orgs que o user pode ver
-- (admin vê todas, outros veem suas memberships + subordinados)

-- has_role: verifica role global do user
CREATE OR REPLACE FUNCTION public.has_role(user_id UUID, role app_role)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = $1 AND user_roles.role = $2
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- can_view_organization: verifica se user pode ver org
-- can_view_profile: verifica se user pode ver perfil de outro user
-- can_manage_org_members: verifica se user pode gerenciar membros da org
```

### 1.4 RLS
- Habilitar RLS em TODAS as tabelas
- Padrão: `organization_id IN (SELECT get_viewable_organizations(auth.uid()))`
- `audit_log`: append-only, SELECT apenas admin
- `profiles`: UPDATE apenas próprio, SELECT via can_view_profile

---

## ETAPA 2: Frontend Base — Layout, Auth e Dashboard

### 2.1 Projeto React
```bash
# Stack
React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
```

### 2.2 Identidade Visual (index.css)
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --brand-deep: 213 80% 13%;       /* #011E41 */
  --brand-highlight: 210 100% 36%;  /* #005CB9 */
  --brand-cream: 18 24% 89%;        /* #EBE1DC */
  --brand-coral: 14 100% 54%;       /* #FF4614 */
  --primary: 213 80% 13%;
  --accent: 210 100% 36%;
  --secondary: 18 24% 89%;
  --destructive: 14 100% 54%;
  --sidebar-background: 213 80% 13%;
}
```

### 2.3 Contextos (4)
1. **AuthContext** — user, session, signIn, signUp, signOut, blocked check
2. **ThemeContext** — light/dark toggle
3. **BaseFilterContext** — selectedOrganizationId, availableOrganizations, getOrganizationFilter(), getRequiredOrganizationId()
4. **ValuesVisibilityContext** — showValues, toggleValues, MaskedValue component

### 2.4 Layout
- `AppLayout` com `SidebarProvider` + `AppSidebar` + `AppHeader`
- Sidebar Deep Blue com logo IBBRA, nav items, role badge, avatar
- Header com seletor de base, toggle tema, toggle visibilidade valores
- Rotas lazy-loaded com `React.lazy()` + `Suspense`

### 2.5 Dashboard (/)
- Consolidação Patrimonial (saldo multimoeda)
- Gráfico de evolução mensal (Recharts)
- Donut por categoria
- Cards: saúde financeira, runway, concentração bancária
- Transações recentes
- Insights estratégicos IA

---

## ETAPA 3: CRUD, Transações e Classificação

### 3.1 Hooks CRUD
Cada entidade segue o padrão:
```typescript
export function useEntities(filters?) {
  return useQuery({ queryKey: ["entities", ...], queryFn: async () => { ... } });
}
export function useCreateEntity() {
  return useMutation({ mutationFn: ..., onSuccess: () => invalidateQueries(...) });
}
export function useUpdateEntity() { ... }
export function useDeleteEntity() { ... }
```

### 3.2 Transações Pareadas
Tipos `transfer`, `investment`, `redemption` criam 2 transações vinculadas:
- Saída da conta origem
- Entrada na conta destino
- `linked_transaction_id` bidirecional

### 3.3 Pipeline de Classificação (Edge Function)
```
1. Normalização: lowercase, sem acentos, sem números, sem stopwords
2. Regras: reconciliation_rules, similaridade ≥ 80% → AUTO-VALIDA
3. Padrões: transaction_patterns, confiança ≥ 85% + 3 ocorrências → AUTO-VALIDA
4. IA: Lovable AI Gateway (Gemini 3 Flash), NUNCA auto-valida, cap 75%
```

### 3.4 Importação de Extratos
- OFX: parse XML de `<STMTTRN>` tags
- CSV: auto-detect separator e colunas
- PDF: Lovable AI Gateway com vision mode (Gemini 2.5 Flash)
- Deduplicação: SHA-256 hash de `account_id|date|amount|raw_description`

---

## ETAPA 4: Open Finance, Relatórios e IA

### 4.1 Open Finance — Pluggy
```
pluggy-connect → gera accessToken
Widget react-pluggy-connect → user conecta banco
pluggy-webhook → notifica item pronto
pluggy-sync → sincroniza contas + transações
financial-core-engine → processa cada transação (dedup, classify, insert)
```

### 4.2 Open Finance — Klavi
```
klavi-authorize → redirect OAuth
callback-klavi → troca código por token
klavi-sync → sincroniza dados
klavi-disconnect → desconecta
```

### 4.3 Cartões de Crédito
- Dados de `open_finance_accounts` (credit_limit, available_credit, due_day)
- Fallback: `raw_data.creditData.creditLimit`
- Permite saldo usado > limite (cartão em atraso)
- Faturas por mês com status (pago, parcial, aberto)

### 4.4 Relatórios
- Extrato, DRE, Fluxo de Caixa, Demonstrativo, Categoria, Orçamento
- Exportação PDF via jspdf + jspdf-autotable
- Logo IBBRA no cabeçalho

### 4.5 IA
- **generate-ai-analysis**: Gateway genérico para chamadas IA
- **generate-ai-insights**: Insights estratégicos com contexto financeiro
- **ai-chat**: Chat streaming (SSE) com Wealth Advisor
- **Modelo**: `google/gemini-3-flash-preview` via `ai.gateway.lovable.dev`
- **Secret**: `LOVABLE_API_KEY`
- **Nenhuma chave no frontend**

---

## ETAPA 5: Admin, Segurança e Produção

### 5.1 Painel Admin
- Gestão de clientes (organizações)
- Convite de usuários (por email)
- Atribuição de roles
- Hierarquia supervisor→subordinado
- Bloqueio de usuários e organizações
- Atribuição de KAM
- Audit log

### 5.2 Segurança
- RLS em todas as tabelas
- `get_viewable_organizations()` como função central
- Bloqueio duplo: individual + organização
- Audit log append-only
- Edge Functions com validação de JWT
- Nenhuma chave de API no frontend
- Hash SHA-256 para deduplicação

### 5.3 PWA
- `vite-plugin-pwa` com service worker
- manifest.json com ícones
- Splash screens iOS
- IOSInstallPrompt component

### 5.4 Planos e Limites
- Tabela `plans` com limites: max_transactions, max_ai_requests, max_bank_connections
- Tabela `organization_subscriptions` vincula org↔plano
- Features condicionais: anomaly_detection, forecast, simulator, benchmarking

### 5.5 Variáveis de Ambiente
```
# Edge Functions
LOVABLE_API_KEY=...
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
KLAVI_CLIENT_ID=...
KLAVI_CLIENT_SECRET=...

# Frontend (.env)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
```

### 5.6 Config Edge Functions (supabase/config.toml)
```toml
project_id = "xxx"

[functions.pluggy-connect]
verify_jwt = false

[functions.pluggy-sync]
verify_jwt = false

# ... todas as 20 functions com verify_jwt = false
# (validação de JWT é feita manualmente no código)
```

---

## Checklist de Recriação

- [ ] Projeto Supabase criado
- [ ] Todas as tabelas criadas com RLS
- [ ] Funções RPC criadas (get_viewable_organizations, has_role, etc.)
- [ ] Projeto React com Vite + Tailwind + shadcn/ui
- [ ] Identidade visual (index.css, tailwind.config.ts)
- [ ] AuthContext com bloqueio
- [ ] BaseFilterContext com seleção de base
- [ ] ThemeContext e ValuesVisibilityContext
- [ ] AppLayout com Sidebar e Header
- [ ] Dashboard com 20+ cards
- [ ] CRUD completo: accounts, categories, cost_centers, transactions, budgets
- [ ] Transações pareadas (transfer, investment, redemption)
- [ ] Pipeline de classificação (4 camadas)
- [ ] Importação OFX/CSV/PDF
- [ ] Open Finance (Pluggy + Klavi)
- [ ] Cartões de crédito com dados OF
- [ ] 7 tipos de relatório + PDF
- [ ] Chat IA (Wealth Advisor) com streaming
- [ ] Painel Admin completo
- [ ] PWA configurado
- [ ] 20 Edge Functions deployadas
- [ ] Secrets configurados
- [ ] 29 rotas mapeadas

---

*Prompt de recriação v4.0 — Fevereiro 2026*
