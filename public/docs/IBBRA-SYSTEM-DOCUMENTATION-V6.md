# IBBRA — Documentação Técnica Completa v6.0

> **Data:** 16 de Fevereiro de 2026  
> **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase (External)  
> **Propósito:** Plataforma institucional de wealth strategy e gestão financeira multi-tenant para BPO  
> **URL Publicada:** https://bpoibbra.lovable.app  
> **Supabase Project ID:** umqehhhpedwqdfjmdjqv

---

## 1. Identidade e Visão Geral

### 1.1 Nome e Propósito
- **Nome:** IBBRA
- **Propósito:** Plataforma de gestão patrimonial e financeira multi-tenant, projetada para operações de BPO (Business Process Outsourcing) de family offices e wealth advisors
- **Público-alvo:** Clientes de alta renda, family offices, gestores patrimoniais

### 1.2 Identidade Visual

| Token | Valor HSL | Hex | Uso |
|-------|-----------|-----|-----|
| `--brand-deep` | 213 80% 13% | #011E41 | Azul Profundo — Primary |
| `--brand-highlight` | 210 100% 36% | #005CB9 | Azul Highlight — Accent |
| `--brand-light-blue` | 214 58% 95% | #ECF2FA | Azul Claro — Backgrounds |
| `--brand-cream` | 18 24% 89% | #EBE1DC | Creme Claro — Secondary |
| `--brand-cream-deep` | 18 14% 77% | #CEC3BE | Creme Sofisticado |
| `--brand-coral` | 14 100% 54% | #FF4614 | Vermelho — Destructive (pontual) |

### 1.3 Tipografia
- **Display:** Playfair Display (serif) — títulos, headings
- **Body:** Plus Jakarta Sans (sans-serif) — corpo, UI

### 1.4 Assets de Logo
- `src/assets/ibbra-logo-full-white.png` — Logo completo branco (sidebar/login)
- `src/assets/ibbra-logo-full.png` — Logo completo colorido
- `src/assets/ibbra-logo-icon.png` — Ícone (mobile login)
- `src/assets/ibbra-logo-white.png` — Logo branco compacto
- `src/assets/ibbra-logo-pdf.png` — Logo para relatórios PDF
- `public/ibbra-grafismo.svg` — Grafismo decorativo (login background)

### 1.5 Design System
- Tokens CSS semânticos em `src/index.css` (light/dark mode)
- Tailwind config com cores mapeadas via `hsl(var(--token))`
- Componentes shadcn/ui customizados
- Sidebar Deep Blue com gradiente premium
- Suporte completo a dark mode

---

## 2. Arquitetura Multi-Tenant

### 2.1 Modelo de Organizações (Bases)
Cada cliente = 1 organização (base). Isolamento total via RLS (Row Level Security).

```
┌─────────────────────────────────┐
│         IBBRA Platform          │
├─────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐    │
│  │Base A│ │Base B│ │Base C│    │
│  │(RLS) │ │(RLS) │ │(RLS) │    │
│  └──────┘ └──────┘ └──────┘    │
└─────────────────────────────────┘
```

### 2.2 Hierarquia de Usuários (7 Roles)

| Nível | Role | Permissões |
|-------|------|------------|
| 1 | **Admin** | Gestão total: criar bases, convidar, bloquear, ver tudo |
| 2 | **Supervisor** | Validação e qualidade, ver subordinados |
| 3 | **FA** (Financial Analyst) | Classificação, importação, edição |
| 4 | **KAM** (Key Account Manager) | Relacionamento, ver bases atribuídas |
| 5 | **Cliente** | Upload, visualização restrita da própria base |
| 6 | **Projetista** | Vinculado a bases específicas |
| 7 | **User** | Acesso básico |

### 2.3 Regra de Seleção de Base Obrigatória
- Perfis com múltiplas bases (Admin, Supervisor, FA, KAM) precisam selecionar uma base antes de criar itens
- Clientes com apenas 1 base são auto-selecionados
- Componente `BaseSelectorEnhanced` no header

### 2.4 Sistema de Bloqueio
- **Usuários individuais:** `profiles.is_blocked`, `blocked_reason`, `blocked_at`
- **Organizações:** `organizations.is_blocked`, `blocked_reason`, `blocked_at`
- Se TODAS as orgs do usuário estão bloqueadas → logout forçado

### 2.5 Auto-Criação no Cadastro
- Trigger `handle_new_user()` no Supabase cria automaticamente:
  1. Profile em `profiles`
  2. Role `cliente` em `user_roles`
  3. Organização pessoal em `organizations` (slug: `base-XXXXXXXX`)
  4. Vínculo em `organization_members` com role `cliente`

---

## 3. Autenticação e Registro

### 3.1 Fluxo de Login
- Email/senha via `supabase.auth.signInWithPassword`
- Google OAuth via `supabase.auth.signInWithOAuth` (somente para contas existentes no login)
- Verificação de bloqueio pós-login (`checkUserBlocked`)

### 3.2 Fluxo de Registro (7 Steps)
Componente: `RegistrationFlow.tsx`

| Step | Descrição | Obrigatório |
|------|-----------|-------------|
| `client_question` | "Já é cliente IBBRA?" (Sim/Não) | ✅ Sempre |
| `cpf_validation` | Validação CPF na base IBBRA | ✅ Se cliente |
| `signup_method` | Escolher Google ou Email/Senha | ✅ Sempre |
| `form_standard` | Formulário completo (nome, CPF, email, senha, etc.) | ✅ Se não-cliente + email |
| `form_ibbra` | Formulário com dados pré-preenchidos | ✅ Se cliente + email |
| `family_question` | "Deseja cadastrar familiares?" | ✅ Sempre |
| `family_form` | Formulário de familiares (parentesco, nome, idade, telefone, email) | Opcional |

### 3.3 Google OAuth no Registro
- Dados IBBRA (isIbbraClient, CPF, validação) salvos em `localStorage` antes do redirect OAuth
- `AuthContext` detecta novo cadastro Google (<60s) e aplica dados do `localStorage` ao profile

### 3.4 Cadastro de Familiares
- Tabela: `family_members`
- Campos: `relationship`, `full_name`, `age`, `phone`, `email`
- Opções de parentesco: Cônjuge, Filho(a), Pai/Mãe, Irmão(ã), Avô/Avó, Neto(a), Tio(a), Sobrinho(a), Outro
- Permite múltiplos familiares por cadastro
- Vinculado ao `user_id` e `organization_id`

---

## 4. Banco de Dados (31+ Tabelas)

### 4.1 Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `organizations` | Bases/clientes com nome, slug, moeda, KAM, bloqueio |
| `profiles` | Perfil do usuário (nome, CPF, telefone, bloqueio, `is_ibbra_client`, `external_client_validated`) |
| `user_roles` | Role global do usuário (enum: admin, supervisor, fa, kam, cliente, projetista, user) |
| `user_hierarchy` | Relação supervisor→subordinado (`user_id` + `supervisor_id`) |
| `organization_members` | Vínculo user↔org com role local |
| `accounts` | Contas bancárias (checking, savings, credit_card, investment, cash) |
| `account_balance_snapshots` | Snapshots de saldo atualizados via trigger |
| `categories` | Categorias de receita/despesa com subcategorias (parent_id), `dre_group`, `expense_classification` |
| `cost_centers` | Centros de custo |
| `transactions` | Transações financeiras (core — 30+ campos) |
| `transfers` | Transferências entre contas |
| `budgets` | Orçamentos por categoria/mês |
| `reconciliation_rules` | Regras de conciliação automática |
| `transaction_patterns` | Padrões aprendidos de classificação |
| `transaction_comments` | Comentários em transações |
| `import_batches` | Lotes de importação (OFX/CSV/PDF) |
| `file_imports` | Importações de arquivo (legacy) |
| `ai_suggestions` | Sugestões de classificação da IA |
| `ai_strategic_insights` | Insights estratégicos da IA |
| `audit_log` | Log de auditoria (append-only) |
| `bank_connections` | Conexões Open Finance (Pluggy/Klavi) |
| `open_finance_items` | Itens do Pluggy (instituições conectadas) |
| `open_finance_accounts` | Contas Open Finance mapeadas |
| `open_finance_raw_data` | Dados brutos do Open Finance |
| `open_finance_sync_logs` | Logs de sincronização |
| `sync_audit_logs` | Auditoria de sincronização |
| `integration_logs` | Logs de integração |
| `family_members` | Familiares do usuário (parentesco, nome, idade, telefone, email) |
| `cashflow_forecasts` | Projeções de fluxo de caixa |
| `recurring_expenses` | Despesas recorrentes detectadas |
| `financial_simulations` | Simulações financeiras |
| `exchange_rates` | Taxas de câmbio |
| `materialized_metrics` | Métricas materializadas (cache) |
| `organization_subscriptions` | Assinaturas de plano |
| `plans` | Planos disponíveis |
| `api_usage_logs` | Logs de uso da API |
| `security_events` | Eventos de segurança |

### 4.2 Campos-Chave da Tabela `transactions`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `organization_id` | uuid | FK → organizations |
| `account_id` | uuid | FK → accounts |
| `user_id` | uuid | Dono |
| `description` | text | Descrição original |
| `normalized_description` | text | Descrição normalizada |
| `raw_description` | text | Descrição bruta do banco |
| `amount` | numeric | Valor (sempre positivo) |
| `type` | enum | income, expense, investment, redemption |
| `date` | date | Data da transação |
| `accrual_date` | date | Data de competência |
| `category_id` | uuid | FK → categories |
| `cost_center_id` | uuid | FK → cost_centers |
| `status` | enum | pending, completed, cancelled |
| `validation_status` | enum | pending_validation, validated, rejected |
| `classification_source` | text | rule, pattern, ai, manual |
| `transaction_hash` | text | SHA-256 para deduplicação |
| `external_transaction_id` | text | ID externo (Open Finance) |
| `sync_dedup_key` | text | Chave de deduplicação de sync |
| `linked_transaction_id` | uuid | Self-ref para pares (transferências) |
| `import_batch_id` | uuid | FK → import_batches |
| `bank_connection_id` | uuid | FK → bank_connections |
| `is_ignored` | boolean | Ignorar no cálculo de saldo |
| `is_anomaly` | boolean | Flag de anomalia |
| `anomaly_score` | numeric | Score de anomalia |
| `financial_type` | text | Tipo financeiro |
| `notes` | text | Observações |
| `paid_amount` | numeric | Valor pago |
| `payment_method` | text | Método de pagamento |
| `due_date` | date | Data de vencimento |
| `payment_date` | date | Data de pagamento |
| `converted_amount` | numeric | Valor convertido |
| `exchange_rate_used` | numeric | Taxa de câmbio usada |

### 4.3 Campos-Chave da Tabela `accounts`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `account_type` | enum | checking, savings, credit_card, investment, cash |
| `currency_code` | text | BRL, USD, EUR, etc. |
| `initial_balance` | numeric | Saldo inicial |
| `current_balance` | numeric | Saldo atual (calculado via trigger) |
| `official_balance` | numeric | Saldo oficial do banco (Open Finance) |
| `last_official_balance_at` | timestamptz | Última atualização do saldo oficial |
| `start_date` | date | Data início para cálculo de saldo |
| `status` | enum | active, inactive |
| `color` | text | Cor para UI |

---

## 5. Funções SQL / RPCs (20+)

| Função | Descrição |
|--------|-----------|
| `get_viewable_organizations(user_id)` | Retorna IDs das orgs que o usuário pode ver (admin→todas, supervisor→FAs→KAMs→orgs, etc.) |
| `can_view_organization(org_id, user_id)` | Boolean: user pode ver esta org? |
| `can_view_transaction(tx_org_id, user_id)` | Boolean: user pode ver transações desta org? |
| `can_view_profile(target_user_id, viewer_id)` | Boolean: viewer pode ver perfil? |
| `can_view_user_data(target_user_id, viewer_id)` | Boolean: viewer pode ver dados do user? |
| `can_manage_org_members(user_id, org_id)` | Boolean: user pode gerenciar membros? |
| `has_role(user_id, role)` | Boolean: user tem este role global? |
| `get_user_organizations(user_id)` | Retorna orgs onde user é membro |
| `get_user_org_ids(user_id)` | Retorna apenas IDs |
| `get_subordinates(user_id)` | Retorna subordinados na hierarquia |
| `user_belongs_to_org(org_id, user_id)` | Boolean: user pertence à org? |
| `validate_hierarchy_chain(user_id, role)` | Valida cadeia hierárquica (FA→Supervisor, KAM→FA, etc.) |
| `normalize_transaction_description(text)` | Normaliza descrição de transação |
| `text_similarity(text1, text2)` | Calcula similaridade entre textos |
| `calculate_account_balance(account_id)` | Calcula saldo da conta |
| `upsert_transaction_pattern(...)` | Cria/atualiza padrão de transação |
| `generate_financial_health_score(org_id)` | Calcula score de saúde financeira (0-100) |
| `generate_financial_metrics(org_id, period)` | Métricas financeiras do período |
| `generate_cashflow_forecast(org_id, days)` | Projeção de fluxo de caixa |
| `detect_recurring_expenses(org_id)` | Detecta despesas recorrentes |
| `detect_transaction_anomalies(org_id)` | Detecta anomalias em transações |
| `get_consolidated_balance(org_id, currency)` | Saldo consolidado multi-moeda |
| `get_bank_concentration(org_id)` | Concentração por banco |
| `get_currency_exposure(org_id)` | Exposição cambial |
| `get_structured_liquidity(org_id)` | Liquidez estruturada (imediata, 30d, 90d) |
| `get_lifestyle_pattern(org_id)` | Padrões de estilo de vida |
| `get_personal_runway(org_id)` | Runway pessoal |
| `get_patrimony_evolution(org_id)` | Evolução patrimonial |
| `convert_currency(amount, from, to, date)` | Converte moeda usando exchange_rates |
| `check_rate_limit(org_id, endpoint, window, max)` | Verifica rate limit |
| `cleanup_expired_oauth_states()` | Limpa estados OAuth expirados |

### Triggers
| Trigger | Tabela | Descrição |
|---------|--------|-----------|
| `update_balance_snapshot` | transactions | Recalcula saldo e atualiza `account_balance_snapshots` + `accounts.current_balance` |
| `log_audit_event` | múltiplas | Registra INSERT/UPDATE/DELETE no `audit_log` |

---

## 6. Políticas RLS (Resumo)

### Padrão de Isolamento
Todas as tabelas com `organization_id` usam:
```sql
-- SELECT: org_id IN (SELECT get_viewable_organizations(auth.uid()))
-- INSERT: org_id IN (SELECT get_viewable_organizations(auth.uid()))
-- UPDATE: org_id IN (SELECT get_viewable_organizations(auth.uid()))
-- DELETE: org_id IN (SELECT get_viewable_organizations(auth.uid()))
```

### Tabelas com Regras Especiais
- **`audit_log`**: Append-only (no UPDATE, no DELETE), SELECT apenas admin
- **`profiles`**: SELECT via `can_view_profile()`, UPDATE apenas próprio
- **`organizations`**: INSERT apenas admin, DELETE não permitido
- **`plans`**: Todos veem planos ativos, apenas admin gerencia
- **`materialized_metrics`**: Apenas SELECT (service_role insere)
- **`family_members`**: CRUD apenas pelo próprio user_id
- **`bank_connections`**: View segura via `bank_connections_safe` (oculta tokens)

---

## 7. Edge Functions (21 funções)

### 7.1 IA e Classificação

| Função | Descrição |
|--------|-----------|
| `generate-ai-analysis` | Gateway seguro para Lovable AI (Gemini 3 Flash) — chamadas genéricas |
| `generate-ai-insights` | Insights estratégicos via IA com contexto financeiro |
| `ai-chat` | Chat streaming com Wealth Advisor IA (SSE) |
| `classify-transaction` | Pipeline de classificação em 4 camadas (regras → padrões → IA) |
| `classify-transactions` | Classificação em lote |

### 7.2 Open Finance

| Função | Descrição |
|--------|-----------|
| `pluggy-connect` | Gera access token Pluggy para widget popup |
| `pluggy-sync` | Sincroniza contas e transações via Pluggy (com trigger de atualização PATCH + polling) |
| `pluggy-webhook` | Recebe webhooks do Pluggy (`transactions/created`) |
| `klavi-authorize` | Inicia fluxo OAuth Klavi |
| `klavi-exchange-token` | Troca código por token Klavi |
| `klavi-sync` | Sincroniza dados Klavi |
| `klavi-disconnect` | Desconecta conta Klavi |
| `klavi-webhook` | Recebe webhooks Klavi |

### 7.3 Importação e Processamento

| Função | Descrição |
|--------|-----------|
| `process-import` | Importação OFX/CSV/PDF com parse + deduplicação |
| `financial-core-engine` | Processamento de transações Open Finance com deduplicação hash |

### 7.4 Gestão e Seeds

| Função | Descrição |
|--------|-----------|
| `seed-categories` | Cria categorias padrão para nova organização |
| `seed-reconciliation-rules` | Cria regras de conciliação padrão |
| `manage-user-access` | Gerencia acessos: convidar, alterar role, bloquear |
| `delete-user` | Remove usuário do sistema |
| `get-user-emails` | Busca emails de usuários |
| `background-jobs` | Jobs agendados (sync, cleanup) |

### 7.5 Configuração (`supabase/config.toml`)
Todas as 21 functions com `verify_jwt = false` (validação manual de JWT no código para controle granular).

### 7.6 Modelo de IA
- **Provider:** Lovable AI Gateway (`ai.gateway.lovable.dev`)
- **Modelo:** `google/gemini-3-flash-preview`
- **Secret:** `LOVABLE_API_KEY` (gerenciado pelo Cloud)
- **Nenhuma chave exposta no frontend**

---

## 8. Contextos React (4)

### 8.1 AuthContext
- Gerencia `user`, `session`, `loading`
- Métodos: `signUp`, `signIn`, `signOut`
- Verifica bloqueio de usuário/organização no login e em auth state changes
- Processa dados de registro Google OAuth via `localStorage` (`ibbra_registration`)
- Logout forçado se bloqueado

### 8.2 ThemeContext
- Alterna entre `light` e `dark`
- Persiste em `localStorage`
- Aplica classe no `<html>`

### 8.3 BaseFilterContext
- `selectedOrganizationId`: base selecionada
- `availableOrganizations`: orgs disponíveis
- `viewableOrganizationIds`: IDs de orgs visualizáveis
- `userRole`: role do usuário logado
- `getOrganizationFilter()`: retorna filtro para queries (`single`, `multiple`, `none`)
- `getRequiredOrganizationId()`: retorna org obrigatória para criação
- `requiresBaseSelection`: boolean, true se precisa selecionar base
- Auto-seleciona se user tem apenas 1 org

### 8.4 ValuesVisibilityContext
- `showValues`: boolean
- `toggleValues()`: alterna visibilidade
- `MaskedValue` component: aplica blur se oculto
- Persiste em `localStorage`

---

## 9. Hooks Customizados (50+ hooks)

### Dashboard & Métricas
| Hook | Descrição |
|------|-----------|
| `useDashboardStats` | Estatísticas do dashboard (receitas, despesas, saldo) |
| `useConsolidatedBalance` | Saldo consolidado multi-conta |
| `useMonthlyEvolution` | Evolução mensal receitas/despesas |
| `useDailyEvolution` | Evolução diária |
| `usePatrimonyEvolution` | Evolução patrimonial |
| `useFinancialHealthScore` | Score de saúde financeira |
| `useBankConcentration` | Concentração bancária |
| `useCurrencyExposure` | Exposição cambial |
| `usePersonalRunway` | Runway pessoal (meses de reserva) |
| `useStructuredLiquidity` | Liquidez estruturada |
| `useLifestylePattern` | Padrões de estilo de vida |
| `useRecurringExpenses` | Despesas recorrentes |
| `useAnomalyDetection` | Detecção de anomalias |
| `useCashflowForecast` | Previsão de fluxo de caixa |
| `useFinancialSimulator` | Simulador financeiro |
| `useStrategicInsights` | Insights estratégicos IA |
| `useReconciliationMetrics` | Métricas de conciliação |

### CRUD & Dados
| Hook | Descrição |
|------|-----------|
| `useTransactions` | CRUD de transações com filtros |
| `useAccounts` | CRUD de contas |
| `useCategories` | CRUD de categorias |
| `useCostCenters` | CRUD de centros de custo |
| `useBudgets` | CRUD de orçamentos |
| `useTransfers` | CRUD de transferências |
| `useReconciliationRules` | CRUD de regras de conciliação |

### Classificação & IA
| Hook | Descrição |
|------|-----------|
| `useAIClassification` | Classificação de transação via IA |
| `useTransactionPatterns` | Padrões aprendidos |
| `useTransactionPatternsAdmin` | Gestão admin de padrões |
| `useSeedCategories` | Seed de categorias |
| `useSeedReconciliationRules` | Seed de regras |
| `useClearReconciliationRules` | Limpa regras |

### Relatórios
| Hook | Descrição |
|------|-----------|
| `useReportsData` | Dados gerais de relatórios |
| `useDREReport` | Relatório DRE |
| `useCashFlowReport` | Relatório de fluxo de caixa |
| `useCategoryAnalysisReport` | Análise por categoria |
| `useFinancialTypeReport` | Relatório por tipo financeiro |
| `useBudgetAnalysis` | Análise orçamentária |

### Open Finance
| Hook | Descrição |
|------|-----------|
| `useBankConnections` | Conexões bancárias |
| `useOpenPluggyConnect` | Abre widget Pluggy |
| `useSyncBankConnection` | Sincroniza conexão bancária |
| `useDisconnectBank` | Desconecta banco |
| `useSavePluggyItem` | Salva item Pluggy |
| `useCreditCardSummary` | Resumo de cartões |
| `useCreditCardAdvancedSummary` | Resumo avançado de cartões com dados OF |
| `useCreditCardDetails` | Detalhes de cartão individual |

### Admin & Gestão
| Hook | Descrição |
|------|-----------|
| `useUserRoles` | Roles de usuário |
| `useUserHierarchy` | Hierarquia de usuários |
| `useOrganizations` | Organizações |
| `useUserEmails` | Emails de usuários |
| `useAuditLog` | Log de auditoria |
| `useSubscription` | Assinatura da organização |
| `usePlanLimits` | Limites do plano |
| `usePendingTransactionsCount` | Contagem de pendências |

### Utilitários
| Hook | Descrição |
|------|-----------|
| `useToggleIgnore` | Ignorar/des-ignorar transação |
| `useAutoIgnoreTransfers` | Auto-ignorar transferências |
| `useImportBatches` | Lotes de importação |
| `useFileImports` | Importações de arquivo |
| `useTransactionComments` | Comentários em transações |

---

## 10. Serviços

### 10.1 aiService.ts
Camada de abstração para IA no frontend:
- `callAIAnalysis(request)` → Edge Function `generate-ai-analysis`
- `classifyTransactionWithAI(request)` → Classificação via IA
- Cap de confiança IA: máximo 75%
- `is_transfer` sempre `false`
- Validação de IDs retornados contra categorias/centros de custo disponíveis

### 10.2 ibbraClientValidationService.ts
- Validação de clientes IBBRA externos
- Verificação de CPF com `isValidCPF()`, `formatCPF()`
- `validateClientByCPF(cpf)` → Busca na base de clientes

---

## 11. Páginas e Rotas (29 rotas)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Index | Dashboard / Consolidação Patrimonial |
| `/auth` | Auth | Login, registro com fluxo multi-step e Google OAuth |
| `/admin` | Admin | Gerenciamento de acessos (admin only) |
| `/extrato` | Extrato | Extrato detalhado |
| `/transacoes` | Transacoes | Lista de transações |
| `/receitas` | Receitas | Receitas (entradas) |
| `/despesas` | Despesas | Despesas (saídas) |
| `/movimentacoes` | Movimentacoes | Movimentações (transferências) |
| `/cadastros` | Cadastros | Hub de cadastros |
| `/contas` | Contas | Gerenciamento de contas |
| `/categorias` | Categorias | Gerenciamento de categorias |
| `/centros-custo` | CentrosCusto | Centros de custo |
| `/regras-conciliacao` | RegrasConciliacao | Regras de conciliação |
| `/orcamentos` | Orcamentos | Orçamentos |
| `/pendencias` | Pendencias | Transações pendentes de validação |
| `/analise-orcamento` | AnaliseOrcamento | Análise orçamentária |
| `/relatorios` | Relatorios | Hub de relatórios |
| `/dre` | RelatorioDRE | Demonstração do Resultado |
| `/demonstrativo-financeiro` | DemonstrativoFinanceiro | Demonstrativo financeiro |
| `/fluxo-caixa` | RelatorioFluxoCaixa | Fluxo de caixa |
| `/importacoes` | Importacoes | Importação de extratos |
| `/perfil` | Perfil | Perfil do usuário |
| `/padroes-aprendidos` | PadroesAprendidos | Padrões aprendidos (admin) |
| `/documentacao` | Documentacao | Documentação do sistema |
| `/open-finance` | OpenFinance | Conexões Open Finance |
| `/callback-klavi` | CallbackKlavi | Callback OAuth Klavi |
| `/cartoes` | CartoesCredito | Cartões de crédito (lista) |
| `/cartao/:accountId` | CartaoCredito | Detalhes do cartão |
| `/open-finance-monitor` | OpenFinanceMonitor | Monitor de Open Finance |

**Lazy Loading:** Todas as páginas (exceto Index, Auth, NotFound) são lazy-loaded via `React.lazy()` + `Suspense`.

---

## 12. Componentes (por módulo)

### Layout
- `AppLayout` — Layout principal com sidebar
- `AppSidebar` — Sidebar com navegação, perfil, role badge
- `AppHeader` — Header com seletor de base, tema, visibilidade
- `BaseSelector` / `BaseSelectorEnhanced` — Seletor de organização
- `BrandBackground` — Background da marca
- `InsightsHeaderButton` — Botão de insights no header

### Dashboard (20+ cards)
- `ConsolidatedBalanceSection`, `AccountBalancesSection`, `MultiCurrencyBalanceSection`
- `MonthlyEvolutionChart`, `CategoryDonutChart`, `RecentTransactions`
- `StatCard`, `StatCardHoverTransactions`, `BudgetProgress`
- `CreditCardSummary`, `CreditCardsAdvancedSummary`
- `FinancialHealthCard`, `CashflowForecastCard`, `AnomalyDetectionCard`
- `BankConcentrationCard`, `CurrencyExposureCard`, `PatrimonyEvolutionCard`
- `PersonalRunwayCard`, `StructuredLiquidityCard`, `LifestylePatternCard`
- `RecurringExpensesCard`, `StrategicInsightsCard`, `FinancialSimulatorCard`
- `ReconciliationMetricsCard`, `ConnectedAccountsSection`, `FintechTransactionsList`
- `TransactionsDetailModal`

### Auth
- `RegistrationFlow` — Fluxo de registro multi-step com Google OAuth e familiares

### Admin
- `ClientManagementTab`, `UsersByRoleTab`
- `InviteUserDialog`, `EditUserAccessDialog`, `EditUserHierarchyDialog`, `DeleteUserDialog`
- `HierarchyManager`, `OrganizationBlockManager`, `OrganizationKamManager`, `SettingsDialog`

### IA
- `AIAssistantChat` — Chat com Wealth Advisor IA (streaming SSE)

### Relatórios
- `ExtratoContent`, `DREContent`, `FluxoCaixaContent`, `DemonstrativoContent`
- `CategoryAnalysisContent`, `FinancialTypeReportContent`, `MovimentacoesReportContent`
- `AnaliseOrcamentoContent`, `FinancialStatementReport`, `PeriodSelector`

### Open Finance
- `BankConnectionsManager` — Gerenciador de conexões com popup Pluggy e sync all

### Importação
- `ExtractUploader`, `ImportCard`, `ImportBatchList`, `ImportExtractDialog`

### PWA
- `IOSInstallPrompt` — Prompt de instalação para iOS

---

## 13. Pipeline de Classificação (4 Camadas)

### Camada 1: Normalização
```
"PIX TED SUPERMERCADO EXTRA 2024" → "supermercado extra"
```
- lowercase, remove acentos (NFD), remove números 1-4 dígitos
- Remove stopwords bancárias (pix, ted, doc, tev, transf, deb, cred, etc.)
- Remove caracteres especiais, colapsa espaços

### Camada 2: Regras de Conciliação
- Compara descrição normalizada com `reconciliation_rules`
- Similaridade ≥ 80% → **AUTO-VALIDADO**
- Bônus de +10% se valor é ≈ regra (±1%)
- Source: `rule`

### Camada 3: Padrões Aprendidos
- Compara com `transaction_patterns`
- Confiança efetiva = similaridade × confiança_padrão × 1.2
- Auto-valida se confiança ≥ 85% E ocorrências ≥ 3
- Source: `pattern`

### Camada 4: IA (Fallback)
- Lovable AI Gateway (Gemini 3 Flash)
- **NUNCA auto-valida** → vai para Pendências
- Cap de confiança: 75% máximo
- `is_transfer` sempre `false`
- Cria registro em `ai_suggestions`
- Source: `ai`

### Loop de Aprendizado
Cada validação humana atualiza `transaction_patterns` via `upsert_transaction_pattern`:
- Incrementa ocorrências
- Recalcula valor médio
- Aumenta confiança progressivamente (cap 99%)

---

## 14. Open Finance

### 14.1 Pluggy (Primário)

**Fluxo de Conexão:**
1. `pluggy-connect` → gera accessToken
2. Widget via popup (`/pluggy-connect.html#token`)
3. Popup retorna `postMessage` com `pluggy-success`
4. `useSavePluggyItem` → salva/atualiza `bank_connections` com `external_account_id = itemId`
5. `pluggy-sync` → sincroniza contas + transações

**Fluxo de Sincronização (`pluggy-sync`):**
1. **PATCH /items/{id}** → Trigger de atualização no Pluggy (força refresh do banco)
2. **Polling** → Aguarda item status `UPDATED` (20 tentativas × 5s)
3. **Fetch contas** → GET /accounts?itemId=X (paginado)
4. **Fetch investimentos** → GET /investments?itemId=X
5. **Mapeia contas locais** → cria/atualiza em `accounts`
6. **Fetch transações** → GET /transactions?accountId=X (paginado por conta)
7. **Deduplicação** → `sync_dedup_key` (ext: ou comp:) + `transaction_hash`
8. **Classificação** → Pipeline 4 camadas para cada transação nova
9. **Atualiza metadados** → `bank_connections.metadata`, `sync_audit_logs`

**"Sincronizar Todas"** (`handleSyncAll`):
- Itera sobre TODAS as conexões com `external_account_id` (não apenas ativas)
- Cada conexão dispara `pluggy-sync` sequencialmente
- Reporta total de transações importadas e erros

### 14.2 Klavi (Secundário)
- Fluxo OAuth redirect: `klavi-authorize` → `callback-klavi` → `klavi-sync`
- `klavi-disconnect` / `klavi-webhook`

### 14.3 Deduplicação
- **external_transaction_id**: dedup por ID externo Pluggy
- **sync_dedup_key**: `ext:{externalId}` ou `comp:{date}|{amount}|{normalizedDesc}`
- **transaction_hash**: SHA-256 de `date|amount|normalized_description|account_id`
- Todos verificados antes de inserir

### 14.4 Cartões de Crédito
- Dados prioritários de `open_finance_accounts`: `credit_limit`, `available_credit`, `due_day`, `closing_day`
- Fallback: `raw_data.creditData.creditLimit`
- Permite saldo utilizado > limite (cartão em atraso)
- Porcentagem de uso pode exceder 100%

---

## 15. Importação de Extratos

### Pipeline (9 Etapas)
1. Upload do arquivo (OFX/CSV/PDF)
2. Validação de formato
3. Armazenamento no Supabase Storage (bucket `extratos`)
4. Criação do lote (`import_batches`)
5. Parse + Hash SHA-256 para deduplicação
6. Inserção de transações (batch insert)
7. Classificação automática via pipeline
8. Conclusão do lote com métricas
9. Notificação ao usuário

### PDF via IA
- Usa Lovable AI Gateway com vision mode
- Modelo: `google/gemini-2.5-flash`
- Limite: 500KB por PDF
- Extrai transações com data, descrição, valor

---

## 16. Chat IA (Wealth Advisor)

### Arquitetura
- Frontend: `AIAssistantChat` component
- Backend: Edge Function `ai-chat` com streaming SSE
- Modelo: `google/gemini-3-flash-preview`
- Contexto: dados financeiros via `generate_financial_health_score` RPC

### Diretrizes do Advisor
- Responde em português brasileiro, tom executivo
- Usa dados reais do cliente
- Nunca recomenda investimentos específicos
- Foco em estratégia patrimonial
- Máximo 3 parágrafos por resposta

---

## 17. Relatórios e PDF

### Tipos de Relatório
- **Extrato**: Movimentações detalhadas por período
- **DRE**: Demonstração do Resultado do Exercício
- **Fluxo de Caixa**: Entradas e saídas por período
- **Demonstrativo Financeiro**: Posição patrimonial
- **Análise por Categoria**: Breakdown por categoria
- **Análise Orçamentária**: Real vs. Orçado
- **Relatório por Tipo Financeiro**: Agrupamento por tipo

### Geração de PDF
- Biblioteca: `jspdf` + `jspdf-autotable`
- Logo IBBRA embutido
- Formatação brasileira (R$, dd/mm/yyyy)

---

## 18. PWA (Progressive Web App)

- `vite-plugin-pwa` com service worker
- `manifest.json` com ícones 192x192 e 512x512
- Splash screens para iOS (`public/splash/`)
- `IOSInstallPrompt` component

---

## 19. Segredos / Variáveis de Ambiente

### Edge Functions (Server-side)
| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase (auto) |
| `SUPABASE_ANON_KEY` | Chave anon (auto) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role (auto) |
| `LOVABLE_API_KEY` | Chave do Lovable AI Gateway |
| `PLUGGY_CLIENT_ID` | Client ID do Pluggy |
| `PLUGGY_CLIENT_SECRET` | Client Secret do Pluggy |
| `KLAVI_CLIENT_ID` | Client ID do Klavi |
| `KLAVI_CLIENT_SECRET` | Client Secret do Klavi |

### Frontend (Públicas / .env)
| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável (anon key) |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto |

---

## 20. Segurança

### Camadas de Proteção
1. **RLS em todas as tabelas** — `get_viewable_organizations()` como função central
2. **JWT validado manualmente** em cada Edge Function (não depende de `verify_jwt`)
3. **Bloqueio duplo**: individual (`profiles.is_blocked`) + organização (`organizations.is_blocked`)
4. **Audit log append-only** — sem UPDATE/DELETE
5. **View segura `bank_connections_safe`** — oculta tokens sensíveis
6. **Hash SHA-256** para deduplicação de transações
7. **Rate limiting** via `check_rate_limit()` RPC
8. **Security events** registrados em `security_events`
9. **Nenhuma chave de API no frontend** — tudo via Edge Functions

---

## 21. Terminologia Oficial

| Termo Técnico | Termo IBBRA |
|---------------|-------------|
| Balance | Consolidação Patrimonial |
| Financial Position | Posição Financeira |
| Income | Entradas Financeiras |
| Expenses | Saídas Financeiras |
| Patrimony Evolution | Evolução Patrimonial |
| Budget | Orçamento |
| Dashboard | Consolidação |

---

## 22. Performance e Otimizações

### Lazy Loading
- Todas as páginas (exceto Index, Auth, NotFound) via `React.lazy()`
- `Suspense` com `PageLoader` global

### Query Caching
- React Query com cache padrão
- `materialized_metrics` para métricas pesadas (1h TTL)
- `account_balance_snapshots` para saldos (trigger-based)

### Lógica de Saldo
- Saldo = `initial_balance` + Σ(income + redemption) − Σ(expense + investment)
- Exclui transações com `is_ignored = true`
- Exclui descrições "Saldo inicial -"
- Trigger `update_balance_snapshot` mantém `current_balance` sincronizado

---

## 23. Dependências Principais

| Pacote | Versão | Uso |
|--------|--------|-----|
| `react` | ^18.3.1 | Framework UI |
| `react-router-dom` | ^6.30.1 | Roteamento |
| `@tanstack/react-query` | ^5.83.0 | Data fetching |
| `@supabase/supabase-js` | ^2.95.3 | Cliente Supabase |
| `framer-motion` | ^12.34.0 | Animações avançadas |
| `recharts` | ^2.15.4 | Gráficos |
| `jspdf` / `jspdf-autotable` | ^4.0.0 / ^5.0.7 | Geração PDF |
| `date-fns` | ^3.6.0 | Manipulação de datas |
| `react-hook-form` + `zod` | ^7.61.1 / ^3.25.76 | Forms + validação |
| `sonner` | ^1.7.4 | Toast notifications |
| `lucide-react` | ^0.462.0 | Ícones |
| `react-pluggy-connect` | ^2.12.0 | Widget Pluggy |
| `papaparse` | ^5.5.3 | Parse CSV |
| `vite-plugin-pwa` | ^1.2.0 | PWA |
| `tailwindcss-animate` | ^1.0.7 | Animações Tailwind |
| `class-variance-authority` | ^0.7.1 | Variants de componentes |
| `cmdk` | ^1.1.1 | Command palette |
| `vaul` | ^0.9.9 | Drawer mobile |
| `embla-carousel-react` | ^8.6.0 | Carousel |
| `input-otp` | ^1.4.2 | Input OTP |
| `next-themes` | ^0.3.0 | Theme provider |
| `react-resizable-panels` | ^2.1.9 | Painéis redimensionáveis |

---

*Documento gerado automaticamente — v6.0 — 16 de Fevereiro de 2026*