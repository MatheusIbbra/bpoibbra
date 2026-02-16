# IBBRA — Prompt de Recriação v6.0

> **Objetivo:** Recriar o sistema IBBRA do zero em caso de disaster recovery.  
> **Dividido em 6 Etapas** para execução sequencial.  
> **Data de referência:** 16 de Fevereiro de 2026  
> **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase

---

## ETAPA 1: Fundação — Banco de Dados e Autenticação

### 1.1 Criar Projeto Supabase
- Região: South America (São Paulo)
- Habilitar Auth com email/password + Google OAuth
- Google OAuth: configurar apenas para login (não signup automático)

### 1.2 Tabelas Core

```sql
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'supervisor', 'fa', 'kam', 'cliente', 'projetista');
CREATE TYPE public.account_type AS ENUM ('checking', 'savings', 'investment', 'credit_card', 'cash');
CREATE TYPE public.account_status AS ENUM ('active', 'inactive');
CREATE TYPE public.category_type AS ENUM ('income', 'expense', 'investment', 'redemption');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense', 'investment', 'redemption');
CREATE TYPE public.validation_status AS ENUM ('pending_validation', 'validated', 'rejected');
CREATE TYPE public.import_status AS ENUM ('pending', 'processing', 'awaiting_validation', 'completed', 'failed', 'cancelled');

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
  legal_accepted BOOLEAN DEFAULT false,
  legal_accepted_at TIMESTAMPTZ,
  legal_accepted_version TEXT,
  registration_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER_ROLES
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'cliente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- USER_HIERARCHY
CREATE TABLE public.user_hierarchy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  supervisor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- FAMILY_MEMBERS
CREATE TABLE public.family_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  relationship TEXT NOT NULL,
  full_name TEXT NOT NULL,
  age INTEGER,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACCOUNTS
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

-- ACCOUNT_BALANCE_SNAPSHOTS
CREATE TABLE public.account_balance_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id),
  balance NUMERIC DEFAULT 0,
  last_transaction_id UUID REFERENCES transactions(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  type category_type NOT NULL,
  icon TEXT DEFAULT 'folder',
  color TEXT DEFAULT '#6B7280',
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  dre_group TEXT,
  expense_classification TEXT,
  is_system_template BOOLEAN DEFAULT false,
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

-- TRANSACTIONS (30+ campos)
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  user_id UUID NOT NULL,
  description TEXT,
  normalized_description TEXT,
  raw_description TEXT,
  amount NUMERIC NOT NULL,
  type transaction_type NOT NULL,
  date DATE NOT NULL,
  accrual_date DATE,
  category_id UUID REFERENCES categories(id),
  cost_center_id UUID REFERENCES cost_centers(id),
  status transaction_status DEFAULT 'completed',
  validation_status validation_status DEFAULT 'pending_validation',
  classification_source TEXT,
  transaction_hash TEXT,
  sync_dedup_key TEXT,
  external_transaction_id TEXT,
  linked_transaction_id UUID REFERENCES transactions(id),
  import_batch_id UUID,
  bank_connection_id UUID,
  is_ignored BOOLEAN DEFAULT false,
  is_anomaly BOOLEAN DEFAULT false,
  anomaly_score NUMERIC,
  financial_type TEXT,
  notes TEXT,
  paid_amount NUMERIC,
  payment_method TEXT,
  due_date DATE,
  payment_date DATE,
  converted_amount NUMERIC,
  exchange_rate_used NUMERIC,
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
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRANSACTION_COMMENTS
CREATE TABLE public.transaction_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- TRANSFERS
CREATE TABLE public.transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  origin_account_id UUID NOT NULL REFERENCES accounts(id),
  destination_account_id UUID NOT NULL REFERENCES accounts(id),
  amount NUMERIC NOT NULL,
  transfer_date DATE NOT NULL,
  description TEXT,
  status transaction_status DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IMPORT_BATCHES, AI_SUGGESTIONS, AI_STRATEGIC_INSIGHTS, AUDIT_LOG
-- BANK_CONNECTIONS, BANK_CONNECTIONS_SAFE (view), OPEN_FINANCE_ITEMS
-- OPEN_FINANCE_ACCOUNTS, OPEN_FINANCE_RAW_DATA, OPEN_FINANCE_SYNC_LOGS
-- EXCHANGE_RATES, CASHFLOW_FORECASTS, RECURRING_EXPENSES
-- FINANCIAL_SIMULATIONS, MATERIALIZED_METRICS
-- PLANS, ORGANIZATION_SUBSCRIPTIONS
-- API_USAGE_LOGS, SECURITY_EVENTS, INTEGRATION_LOGS, FILE_IMPORTS
-- CONSENT_LOGS, DATA_DELETION_REQUESTS, DATA_EXPORT_REQUESTS
-- LEGAL_DOCUMENTS
-- (Ver documentação V7 para definições completas)

-- ENABLE RLS em TODAS as tabelas
-- Padrão: organization_id IN (SELECT get_viewable_organizations(auth.uid()))
```

### 1.3 Trigger: handle_new_user (Auto-criação de profile + org)

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_full_name TEXT;
  new_org_id UUID;
BEGIN
  user_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Criar profile
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, user_full_name);

  -- Criar role (default: cliente)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'cliente');

  -- Criar organização pessoal
  INSERT INTO public.organizations (name, slug)
  VALUES (user_full_name, 'base-' || substr(NEW.id::text, 1, 8))
  RETURNING id INTO new_org_id;

  -- Vincular à organização
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'cliente');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 1.4 Funções RPC Essenciais
- `get_viewable_organizations(user_id)` — Admin→todas, Supervisor→FAs→KAMs→orgs, etc.
- `has_role(user_id, role)` — verifica role global
- `can_view_organization`, `can_view_profile`, `can_view_transaction`, `can_view_user_data`
- `can_manage_org_members`
- `get_subordinates(user_id)`
- `validate_hierarchy_chain(user_id, role)`
- `calculate_account_balance(account_id)` — saldo = initial + Σ(income+redemption) − Σ(expense+investment)
- `update_balance_snapshot()` — trigger em transactions para manter snapshots
- `generate_financial_health_score(org_id)` — score 0-100
- `generate_financial_metrics`, `generate_cashflow_forecast`, `detect_recurring_expenses`
- `get_consolidated_balance`, `get_bank_concentration`, `get_currency_exposure`
- `get_structured_liquidity`, `get_lifestyle_pattern`, `get_personal_runway`, `get_patrimony_evolution`
- `convert_currency`, `check_rate_limit`, `normalize_transaction_description`, `text_similarity`
- `upsert_transaction_pattern`

### 1.5 RLS
- Habilitar RLS em TODAS as tabelas
- Padrão: `organization_id IN (SELECT get_viewable_organizations(auth.uid()))`
- `audit_log`: append-only, SELECT apenas admin
- `profiles`: UPDATE apenas próprio, SELECT via can_view_profile
- `family_members`: CRUD apenas pelo próprio user_id

---

## ETAPA 2: Frontend Base — Layout, Auth e Dashboard

### 2.1 Identidade Visual (index.css)
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

:root {
  --brand-deep: 213 80% 13%;
  --brand-highlight: 210 100% 36%;
  --brand-cream: 18 24% 89%;
  --brand-coral: 14 100% 54%;
  --primary: 213 80% 13%;
  --accent: 210 100% 36%;
  --secondary: 18 24% 89%;
  --destructive: 14 100% 54%;
  --sidebar-background: 213 80% 13%;
}
```

### 2.2 Contextos (4)
1. **AuthContext** — user, session, signIn, signUp, signOut, blocked check, Google OAuth registration data sync
2. **ThemeContext** — light/dark toggle
3. **BaseFilterContext** — selectedOrganizationId, getOrganizationFilter(), getRequiredOrganizationId(), requiresBaseSelection
4. **ValuesVisibilityContext** — showValues, toggleValues, MaskedValue component

### 2.3 Auth Page (Login + Registro)
- **Login:** email/senha + Google OAuth + "Esqueci minha senha"
- **Recuperar Acesso:** usa `<input>` nativo (não react-hook-form) para compatibilidade mobile. Envia link via `supabase.auth.resetPasswordForEmail`
- **Registro (RegistrationFlow):** 7 steps:
  1. Pergunta cliente IBBRA (obrigatória)
  2. Validação CPF (se cliente)
  3. Método de cadastro (Google ou Email)
  4. Formulário padrão ou IBBRA
  5. Pergunta sobre familiares (obrigatória)
  6. Formulário de familiares (opcional)
  7. Criação da conta
- Google OAuth no registro salva dados em `localStorage` antes do redirect
- `AuthContext` processa dados pós-OAuth (<60s)

### 2.4 Layout
- `AppLayout` com `SidebarProvider` + `AppSidebar` + `AppHeader`
- Sidebar Deep Blue com logo IBBRA, nav items, role badge
- Header com seletor de base, toggle tema, toggle visibilidade
- 29 rotas lazy-loaded com `React.lazy()` + `Suspense`

### 2.5 Dashboard
- 20+ cards com métricas via RPCs SQL
- Gráficos Recharts, Cards shadcn/ui, Framer Motion

---

## ETAPA 3: CRUD, Transações e Classificação

### 3.1 Hooks CRUD (padrão useQuery + useMutation + invalidateQueries)

### 3.2 Transações Pareadas
Tipos `investment`, `redemption` criam 2 transações vinculadas (`linked_transaction_id`)

### 3.3 Pipeline de Classificação (Edge Function)
```
1. Normalização: lowercase, sem acentos, sem stopwords bancárias
2. Regras: reconciliation_rules, similaridade ≥ 80% → AUTO-VALIDA
3. Padrões: transaction_patterns, confiança ≥ 85% + 3 ocorrências → AUTO-VALIDA
4. IA: Gemini 3 Flash, NUNCA auto-valida, cap 75%
```

### 3.4 Importação de Extratos (OFX/CSV/PDF)
- Hash SHA-256 para deduplicação
- PDF via IA (Gemini 2.5 Flash vision)

---

## ETAPA 4: Open Finance

### 4.1 Pluggy (Primário)
```
pluggy-connect → gera accessToken
Popup /pluggy-connect.html → user conecta banco
postMessage → frontend salva item
pluggy-sync → PATCH item (force refresh) → poll status → fetch contas/transações → dedup → classify → insert
pluggy-webhook → sync em background
```

**"Sincronizar Todas":** itera todas as conexões com `external_account_id`, dispara `pluggy-sync` sequencialmente

### 4.2 Klavi (Secundário)
```
klavi-authorize → redirect OAuth
callback-klavi → troca código
klavi-sync → sincroniza
```

### 4.3 Cartões de Crédito
- Transações classificadas como `expense` por padrão
- Pagamentos de fatura → `transfer` com `is_ignored = true`
- Saldos de cartão excluídos do Saldo Total Acumulado
- Regime de Caixa: ignora compras individuais, contabiliza apenas pagamento de fatura
- Regime de Competência: reconhece cada compra na data de ocorrência

---

## ETAPA 5: Relatórios e IA

### 5.1 Relatórios (7 tipos)
- Extrato, DRE, Fluxo de Caixa, Demonstrativo, Categoria, Orçamento, Tipo Financeiro
- PDF via jspdf + jspdf-autotable com logo IBBRA

### 5.2 Fluxo de Caixa — Regras Importantes
- **EXCLUI cartões de crédito** — considera APENAS contas: `checking`, `savings`, `investment`, `cash`
- Filtragem por `account_id` no nível do banco de dados
- `getLegacyInitialBalanceAdjustment` recebe `allowedAccountIds` para não incluir saldos de cartão no saldo de abertura

### 5.3 Regimes Contábeis
- **Caixa:** `payment_date` (ou `date`). Ignora compras de cartão, contabiliza pagamento de fatura
- **Competência:** `accrual_date` (fallback `date`). Reconhece cada compra na data de ocorrência
- **DRE:** fixado exclusivamente em Competência
- Preferência persistida no `localStorage`

### 5.4 Chat IA (Wealth Advisor)
- Edge Function `ai-chat` com SSE streaming
- Modelo: Gemini 3 Flash via Lovable AI Gateway
- Contexto financeiro real via RPCs

---

## ETAPA 6: Admin, Segurança e Produção

### 6.1 Painel Admin
- Gestão de clientes/organizações, convite de usuários, roles, hierarquia
- Bloqueio de usuários e organizações, atribuição de KAM
- Audit log

### 6.2 Segurança
- RLS em todas as tabelas
- JWT validado manualmente em Edge Functions
- Bloqueio duplo (individual + organização)
- View segura `bank_connections_safe`
- Rate limiting via RPC
- Security events

### 6.3 PWA
- vite-plugin-pwa + manifest.json + splash screens iOS + IOSInstallPrompt

### 6.4 Planos e Limites
- `plans` + `organization_subscriptions`
- Features condicionais: anomaly_detection, forecast, simulator, benchmarking

### 6.5 Variáveis de Ambiente
```
# Edge Functions (secrets)
LOVABLE_API_KEY, PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET
KLAVI_CLIENT_ID, KLAVI_CLIENT_SECRET

# Frontend (.env)
VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_SUPABASE_PROJECT_ID
```

### 6.6 Config Edge Functions (supabase/config.toml)
- Todas as 21 functions com `verify_jwt = false`
- Validação manual de JWT no código

---

## Checklist de Recriação

- [ ] Projeto Supabase criado com enums e 31+ tabelas
- [ ] RLS em todas as tabelas
- [ ] 30+ funções RPC criadas
- [ ] Triggers: handle_new_user, update_balance_snapshot, log_audit_event
- [ ] Projeto React com Vite + Tailwind + shadcn/ui
- [ ] Identidade visual (index.css, tailwind.config.ts, logos)
- [ ] AuthContext com bloqueio + Google OAuth registration sync
- [ ] BaseFilterContext, ThemeContext, ValuesVisibilityContext
- [ ] AppLayout com Sidebar e Header
- [ ] Auth page: Login + RegistrationFlow (7 steps + familiares)
- [ ] Recuperar Acesso com input nativo (não react-hook-form)
- [ ] Dashboard com 20+ cards
- [ ] CRUD completo: accounts, categories, cost_centers, transactions, budgets
- [ ] Transações pareadas (investment, redemption)
- [ ] Pipeline de classificação (4 camadas)
- [ ] Importação OFX/CSV/PDF
- [ ] Open Finance Pluggy (popup + sync com PATCH trigger + webhook)
- [ ] Open Finance Klavi
- [ ] Cartões de crédito com dados OF (saldos excluídos do total)
- [ ] 7 tipos de relatório + PDF com logo
- [ ] Fluxo de Caixa exclui cartões (apenas checking, savings, investment, cash)
- [ ] Regimes contábeis: Caixa vs Competência (DRE fixo em Competência)
- [ ] Chat IA (Wealth Advisor) com streaming SSE
- [ ] Painel Admin completo
- [ ] Tabela family_members + formulário no registro
- [ ] PWA configurado
- [ ] 21 Edge Functions deployadas
- [ ] Secrets configurados
- [ ] 29 rotas mapeadas

---

*Prompt de recriação v6.0 — 16 de Fevereiro de 2026*
