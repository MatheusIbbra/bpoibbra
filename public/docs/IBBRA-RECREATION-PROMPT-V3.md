# IBBRA — Prompt de Recriação v3.0

> **Objetivo:** Recriar o sistema IBBRA do zero em 5 etapas.
> **Uso:** Backup, disaster recovery e documentação de referência.
> **Última atualização:** 16 de Fevereiro de 2026
> **Referência completa:** `public/docs/IBBRA-SYSTEM-DOCUMENTATION-V4.md`

---

## ETAPA 1 — Fundação (Banco de Dados + Auth)

### 1.1 Criar projeto Supabase (Lovable Cloud)

Stack: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase + TanStack React Query v5 + vite-plugin-pwa

### 1.2 Enums

```sql
CREATE TYPE account_type AS ENUM ('checking', 'savings', 'investment', 'credit_card', 'cash');
CREATE TYPE account_status AS ENUM ('active', 'inactive');
CREATE TYPE app_role AS ENUM ('admin', 'user', 'supervisor', 'fa', 'kam', 'cliente', 'projetista');
CREATE TYPE category_type AS ENUM ('income', 'expense', 'investment', 'redemption');
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer', 'investment', 'redemption');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE validation_status AS ENUM ('pending_validation', 'validated', 'rejected', 'needs_review');
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'awaiting_validation', 'completed', 'failed', 'cancelled');
```

### 1.3 Tabelas (30+)

Criar as seguintes tabelas (ver documentação V4 para schema completo):

**Core:**
1. `organizations` — Multi-tenant, com bloqueio, base_currency
2. `profiles` — Extensão de auth.users, com bloqueio
3. `user_roles` — Roles separados (CRÍTICO: nunca no profile)
4. `user_hierarchy` — Hierarquia supervisor → subordinado
5. `organization_members` — Vínculo user ↔ org com role

**Financeiro:**
6. `accounts` — Contas financeiras (5 tipos, com currency_code)
7. `categories` — Categorias hierárquicas com DRE
8. `cost_centers` — Centros de custo
9. `transactions` — Transações (tabela central, 35+ colunas incluindo anomaly, converted_amount)
10. `transfers` — Transferências entre contas
11. `budgets` — Orçamentos mensais

**Classificação:**
12. `reconciliation_rules` — Regras de conciliação manuais
13. `transaction_patterns` — Padrões aprendidos automaticamente
14. `ai_suggestions` — Sugestões da IA

**Importação:**
15. `import_batches` — Lotes de importação
16. `file_imports` — Importações legado

**Open Finance:**
17. `bank_connections` — Conexões bancárias
18. `open_finance_items` — Itens Open Finance (UNIQUE org + institution)
19. `open_finance_accounts` — Contas OF (UNIQUE item + pluggy_account_id)
20. `open_finance_sync_logs` — Logs de sync
21. `open_finance_raw_data` — Dados brutos
22. `sync_audit_logs` — Auditoria de syncs

**IA e Analytics:**
23. `ai_strategic_insights` — Insights IA salvos
24. `api_usage_logs` — Logs de uso de API

**Infraestrutura:**
25. `audit_log` — Log imutável de auditoria
26. `integration_logs` — Logs de integrações

**Extras:**
27. `account_balance_snapshots` — Snapshots de saldo
28. `cashflow_forecasts` — Previsões
29. `exchange_rates` — Taxas de câmbio
30. `financial_simulations` — Simulações
31. `organization_subscriptions` — Assinaturas
32. `plans` — Planos
33. `recurring_expenses` — Despesas recorrentes
34. `transaction_comments` — Comentários

### 1.4 Funções SQL (SECURITY DEFINER)

```sql
-- CONTROLE DE ACESSO (críticas)
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION get_viewable_organizations(_user_id uuid)
RETURNS uuid[] ...
-- Lógica: admin vê tudo, supervisor vê subordinados, fa/kam vê atribuídos, cliente vê própria

CREATE OR REPLACE FUNCTION can_view_organization(_org_id uuid, _viewer_id uuid)
RETURNS boolean ...

CREATE OR REPLACE FUNCTION can_view_profile(_profile_user_id uuid, _viewer_id uuid)
RETURNS boolean ...

CREATE OR REPLACE FUNCTION can_manage_org_members(_org_id uuid, _user_id uuid)
RETURNS boolean ...

CREATE OR REPLACE FUNCTION get_subordinates(_user_id uuid)
RETURNS uuid[] ...

-- NEGÓCIO
CREATE OR REPLACE FUNCTION calculate_account_balance(account_uuid uuid)
RETURNS numeric ...
-- initial_balance + SUM(income) - SUM(expense) + SUM(redemption) - SUM(investment)
-- Exclui is_ignored = true e status = 'cancelled'

CREATE OR REPLACE FUNCTION normalize_transaction_description(description text)
RETURNS text ...
-- lowercase, remove acentos, remove números, remove stopwords

CREATE OR REPLACE FUNCTION text_similarity(text1 text, text2 text)
RETURNS numeric ...
-- pg_trgm similarity

CREATE OR REPLACE FUNCTION upsert_transaction_pattern(...)
RETURNS uuid ...

CREATE OR REPLACE FUNCTION generate_financial_health_score(p_organization_id uuid)
RETURNS json ...
-- IMPORTANTE: Retorna NULL se não há contas ou transações (não inventa score)

CREATE OR REPLACE FUNCTION generate_cashflow_forecast(p_organization_id uuid, p_days integer)
RETURNS json ...

CREATE OR REPLACE FUNCTION detect_recurring_expenses(p_organization_id uuid)
RETURNS json ...

CREATE OR REPLACE FUNCTION get_consolidated_balance(p_organization_id uuid, p_target_currency text)
RETURNS json ...

CREATE OR REPLACE FUNCTION convert_currency(p_amount numeric, p_from text, p_to text, p_rate_date text)
RETURNS numeric ...
```

### 1.5 RLS

Habilitar RLS em TODAS as tabelas. Padrão:
- SELECT: `get_viewable_organizations(auth.uid())` ou `has_role(admin)`
- INSERT: mesmo + `user_id = auth.uid()`
- UPDATE/DELETE: mesmo filtro
- **audit_log:** SELECT admin only, UPDATE/DELETE bloqueados (`USING false`)
- **user_roles:** admin only para CUD
- **profiles:** próprio user + admin
- **ai_suggestions:** service role INSERT, FA+ UPDATE
- **organizations:** admin INSERT, membros+admin UPDATE, ninguém DELETE

---

## ETAPA 2 — Identidade Visual + Layout

### 2.1 Fontes
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
```

### 2.2 Paleta IBBRA (CSS Variables em HSL — index.css)
```css
:root {
  /* Brand */
  --brand-deep: 213 80% 13%;       /* #011E41 */
  --brand-highlight: 210 100% 36%;  /* #005CB9 */
  --brand-light-blue: 214 58% 95%;  /* #ECF2FA */
  --brand-cream: 18 24% 89%;        /* #EBE1DC */
  --brand-cream-deep: 18 14% 77%;   /* #CEC3BE */
  --brand-coral: 14 100% 54%;       /* #FF4614 */

  /* Core surfaces */
  --background: 30 15% 98%;          /* Warm off-white */
  --foreground: 213 80% 13%;
  --card: 0 0% 100%;
  --card-foreground: 213 80% 13%;

  /* Semantic */
  --primary: 213 80% 13%;
  --primary-foreground: 0 0% 100%;
  --secondary: 18 24% 89%;
  --accent: 210 100% 36%;
  --accent-foreground: 0 0% 100%;
  --destructive: 14 100% 54%;
  --success: 160 60% 36%;
  --warning: 38 92% 50%;
  --info: 210 100% 36%;

  /* Muted */
  --muted: 220 12% 95%;
  --muted-foreground: 215 14% 46%;

  /* Borders */
  --border: 220 12% 91%;
  --input: 220 12% 91%;
  --ring: 210 100% 36%;
  --radius: 0.625rem;

  /* Sidebar */
  --sidebar-background: 213 80% 13%;
  --sidebar-foreground: 214 30% 88%;
  --sidebar-primary: 210 100% 50%;
  --sidebar-accent: 213 55% 20%;
  --sidebar-border: 213 45% 22%;
  --sidebar-muted: 215 18% 58%;

  /* Charts */
  --chart-1: 210 100% 36%;
  --chart-2: 213 80% 13%;
  --chart-3: 160 60% 36%;
  --chart-4: 38 92% 50%;
  --chart-5: 18 24% 77%;
}
```

### 2.3 Tipografia
- h1, h2, h3: `font-family: 'Playfair Display', Georgia, serif`
- h4+, body: `font-family: 'Plus Jakarta Sans', system-ui, sans-serif`
- Letter-spacing negativo (-0.03em, -0.025em, -0.02em)

### 2.4 Conceito Visual
- Elegante, sutil, segura, objetiva, racional
- Cards brancos com sombra suave (`shadow-executive`)
- Sidebar azul escuro com gradiente sutil
- **EVITAR:** gradientes, cores fora da paleta, sombras fortes, elementos chamativos
- **NUNCA** usar cores hardcoded nos componentes — sempre tokens semânticos

### 2.5 Layout Principal
- AppLayout: Sidebar + Content area
- AppSidebar: Azul escuro IBBRA, logo full white, navegação, perfil no footer
- AppHeader: Seletor de base (obrigatório), controles, visibilidade de valores
- max-width: `1400px` no conteúdo principal

### 2.6 Assets
- `src/assets/ibbra-logo-full-white.png` — Logo sidebar
- `src/assets/ibbra-logo-full.png` — Logo claro
- `src/assets/ibbra-logo-icon.png` — Ícone
- `src/assets/ibbra-logo-pdf.png` — Logo para PDFs
- `public/ibbra-grafismo.svg` — Grafismo decorativo

---

## ETAPA 3 — Funcionalidades Core

### 3.1 Contextos React (4)
1. **AuthContext** — Login, logout, sessão, recuperação
2. **ThemeContext** — Modo claro/escuro, localStorage
3. **BaseFilterContext** — Seleção de base obrigatória (organization_id)
4. **ValuesVisibilityContext** — Ocultar/mostrar valores

### 3.2 Dashboard (Consolidação Patrimonial)
Rota `/` — Layout completo (ver seção 12 da documentação V4):

**Bloco 1:** 4 StatCards (2x2 mobile, 4 colunas desktop)
- Posição Financeira (Wallet) — saldo contas correntes
- Entradas Financeiras (ArrowUpRight) — receitas mês com trend
- Saídas Financeiras (ArrowDownRight) — despesas mês com trend
- Evolução Patrimonial (TrendingUp) — entradas - saídas

**Bloco 2:** MultiCurrencyBalanceSection

**Bloco 3:** BudgetAlerts

**Bloco 4:** CategoryDonutChart + MonthlyEvolutionChart (lado a lado)

**Bloco 5:** FinancialHealthCard (full width, retorna NULL sem dados)

**Bloco 6:** BudgetProgress + FintechTransactionsList (lado a lado, MESMO TAMANHO)
- FintechTransactionsList é minimalista, compacto, NUNCA maior que BudgetProgress

**Bloco 7:** RecurringExpensesCard (full width)

**Bloco 8:** CashflowForecastCard + FinancialSimulatorCard (lado a lado)

**Bloco 9:** ReconciliationMetricsCard (full width)

**Bloco 10:** ConnectedAccountsSection (full width)

**Flutuante:** AIAssistantChat (canto inferior)

### 3.3 Transações
- CRUD completo com filtros por período, tipo, categoria, conta
- Validação (pending_validation → validated/rejected)
- Classificação automática pós-criação
- Histórico de classificação (source: rule, pattern, ai, manual)
- Comentários em transações

### 3.4 Importação de Extratos
Fluxo:
1. Upload (OFX/CSV/PDF) para Supabase Storage
2. Validação de formato
3. Criação do lote (import_batches)
4. Edge Function `process-import`:
   - Parse do arquivo
   - Hash SHA-256 para deduplicação
   - Inserção de transações
   - Classificação automática
5. Atualização do status
6. Notificação ao usuário

### 3.5 Pipeline de Classificação
4 camadas sequenciais (ver Edge Function `classify-transaction`):
1. Normalização → `normalize_transaction_description()`
2. Regras de conciliação → `text_similarity ≥ 80%` → **AUTO-VALIDADO**
3. Padrões aprendidos → `confidence ≥ 85% + occurrences ≥ 3` → **AUTO-VALIDADO**
4. IA Gemini 2.5 Flash → **NUNCA auto-valida**, cap 75%, vai para Pendências

Aprendizado: cada validação humana → `upsert_transaction_pattern()`

### 3.6 Orçamentos
- Cadastro mensal por categoria + centro de custo
- Análise orçamentária (realizado vs orçado)
- Alertas de orçamento (>80%, >100%)

### 3.7 Relatórios (8 tipos)
- DRE (Demonstrativo de Resultados)
- Fluxo de Caixa
- Demonstrativo Financeiro
- Extrato
- Análise por Categoria
- Análise Orçamentária
- Relatório por Tipo Financeiro
- Movimentações
- Exportação PDF (jsPDF + jspdf-autotable com logo IBBRA)

---

## ETAPA 4 — Integrações

### 4.1 IA (Gemini 2.5 Flash)

**Arquitetura segura:**
- Edge Function `generate-ai-analysis` → Gateway seguro
- `GEMINI_API_KEY` como secret no Supabase
- Frontend chama via `aiService.ts` → `supabase.functions.invoke()`
- Nenhuma chave exposta no cliente

**Edge Functions de IA:**
- `generate-ai-analysis` — Gateway genérico
- `generate-ai-insights` — Insights estratégicos do dashboard
- `classify-transaction` — Pipeline de classificação
- `classify-transactions` — Classificação em lote

### 4.2 Open Finance — Pluggy (Primária)

**Fluxo:**
1. `pluggy-connect` — Gera access token e abre widget via popup
2. Usuário conecta banco no widget
3. `pluggy-webhook` — Recebe notificação de item criado/atualizado
4. `pluggy-sync` — Busca contas e transações via API Pluggy
5. `financial-core-engine` — Processa dados:
   - Cria/atualiza `open_finance_items` e `open_finance_accounts`
   - Deduplicação por `sync_dedup_key`
   - Classificação por `creditDebitType`
   - Criação de transações locais
   - Ignora transações espelhadas

### 4.3 Open Finance — Klavi (Secundária)

**Fluxo OAuth:**
1. `klavi-authorize` → redireciona para Klavi
2. `/callback-klavi` → recebe código
3. `klavi-exchange-token` → troca por access token
4. `klavi-sync` → sincroniza dados
5. `klavi-disconnect` → revoga consentimento

### 4.4 Secrets necessários
```
GEMINI_API_KEY
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
```

---

## ETAPA 5 — Administração + Polish

### 5.1 Painel Admin (/admin)
- Gestão de usuários por role (tabs)
- Convite de novos usuários
- Edição de acesso e hierarquia
- Bloqueio/desbloqueio de usuários e organizações
- Gestão de KAMs
- Audit log
- Gestão de clientes

### 5.2 Cadastros (/cadastros)
Hub unificado para:
- Contas (`/contas`)
- Categorias (`/categorias`)
- Centros de Custo (`/centros-custo`)
- Regras de Conciliação (`/regras-conciliacao`)

### 5.3 Edge Functions de Gestão
- `manage-user-access` — Convite, update role, block/unblock
- `delete-user` — Exclusão com cascata
- `get-user-emails` — Consulta emails (admin API)
- `seed-categories` — Categorias iniciais
- `seed-reconciliation-rules` — Regras iniciais

### 5.4 Rotas Completas (30)
```
/                         → Consolidação Patrimonial (Dashboard)
/auth                     → Login / Registro
/admin                    → Painel Administrativo
/extrato                  → Extrato Bancário
/transacoes               → Transações
/receitas                 → Entradas Financeiras
/despesas                 → Saídas Financeiras
/movimentacoes            → Movimentações
/cadastros                → Hub de Cadastros
/contas                   → Contas
/categorias               → Categorias
/centros-custo            → Centros de Custo
/regras-conciliacao       → Regras de Conciliação
/orcamentos               → Orçamentos
/pendencias               → Pendências de Validação
/analise-orcamento        → Análise Orçamentária
/relatorios               → Hub de Relatórios
/dre                      → DRE
/demonstrativo-financeiro → Demonstrativo Financeiro
/fluxo-caixa              → Fluxo de Caixa
/importacoes              → Importação de Extratos
/perfil                   → Perfil do Usuário
/padroes-aprendidos       → Padrões Aprendidos (Admin)
/documentacao             → Documentação do Sistema
/open-finance             → Open Finance
/callback-klavi           → Callback Klavi
/cartoes                  → Cartões de Crédito
/cartao/:accountId        → Detalhes do Cartão
/open-finance-monitor     → Monitor Open Finance
*                         → 404
```

### 5.5 Terminologia Corporativa
| Sistema | IBBRA |
|---|---|
| Saldo | Posição Financeira |
| Dashboard/Resumo | Consolidação Patrimonial |
| Receitas | Entradas Financeiras |
| Despesas | Saídas Financeiras |
| Saldo do Mês | Evolução Patrimonial |

### 5.6 Regra de Saldo Disponível
O cálculo de "Posição Financeira" consolida **apenas contas correntes vinculadas**:
- Exclui: investimento, cartões, contas OF sem local_account_id
- Cada conta corrente OF precisa de conta local vinculada

### 5.7 Configuração Edge Functions (supabase/config.toml)
Todas as 19 funções com `verify_jwt = false` (autenticação interna via Authorization header).

### 5.8 PWA
- Manifest em `public/manifest.json`
- Ícones em `public/pwa-192x192.png` e `public/pwa-512x512.png`
- Configurado via `vite-plugin-pwa`

---

## Checklist de Validação

- [ ] 30+ tabelas criadas com RLS
- [ ] 15+ funções SQL SECURITY DEFINER
- [ ] 19 Edge Functions deployadas
- [ ] Identidade visual IBBRA (paleta HSL, Playfair + Jakarta Sans, sidebar azul escuro)
- [ ] Terminologia corporativa em todas as telas
- [ ] Pipeline de classificação funcional (regras → padrões → IA)
- [ ] Open Finance Pluggy conectando e sincronizando
- [ ] Secrets configurados (GEMINI_API_KEY, PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET)
- [ ] Dashboard com 4 StatCards + layout correto (ver seção 3.2)
- [ ] Importação OFX/CSV/PDF funcional
- [ ] Relatórios com exportação PDF (com logo IBBRA)
- [ ] Painel admin com gestão de acessos e hierarquia
- [ ] Audit log imutável
- [ ] Cartões de crédito com resumo avançado
- [ ] Score de saúde financeira retorna NULL sem dados
- [ ] Simulador financeiro ao lado de previsão de caixa
- [ ] Últimas Movimentações ao lado e do mesmo tamanho de Orçamentos do Mês
- [ ] Lazy loading em todas as páginas exceto Index/Auth/NotFound
- [ ] Tokens semânticos em todos os componentes (nunca cores hardcoded)
- [ ] PWA configurado

---

*Prompt de recriação — IBBRA v3.0 — 16 de Fevereiro de 2026*
