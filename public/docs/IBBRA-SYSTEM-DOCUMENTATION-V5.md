# IBBRA — Documentação Técnica Completa v5.0

> **Data:** Fevereiro 2026  
> **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase (Lovable Cloud)  
> **Propósito:** Plataforma institucional de wealth strategy e gestão financeira multi-tenant para BPO

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

### 1.4 Design System
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

### 2.2 Hierarquia de Usuários (5 Níveis)

| Nível | Role | Permissões |
|-------|------|------------|
| 1 | **Admin** | Gestão total: criar bases, convidar, bloquear, ver tudo |
| 2 | **Supervisor** | Validação e qualidade, ver subordinados |
| 3 | **FA** (Financial Analyst) | Classificação, importação, edição |
| 4 | **KAM** (Key Account Manager) | Relacionamento, ver bases atribuídas |
| 5 | **Cliente** | Upload, visualização restrita da própria base |

### 2.3 Regra de Seleção de Base Obrigatória
- Perfis com múltiplas bases (Admin, Supervisor, FA, KAM) precisam selecionar uma base antes de criar itens
- Clientes com apenas 1 base são auto-selecionados
- Componente `BaseSelectorEnhanced` no header

### 2.4 Sistema de Bloqueio
- **Usuários individuais:** `profiles.is_blocked`, `blocked_reason`, `blocked_at`
- **Organizações:** `organizations.is_blocked`, `blocked_reason`, `blocked_at`
- Se TODAS as orgs do usuário estão bloqueadas → logout forçado

---

## 3. Banco de Dados (30+ Tabelas)

### 3.1 Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `organizations` | Bases/clientes com nome, slug, moeda, KAM, bloqueio |
| `profiles` | Perfil do usuário (nome, CPF, telefone, bloqueio) |
| `user_roles` | Role global do usuário (1 por user) |
| `user_hierarchy` | Relação supervisor→subordinado |
| `organization_members` | Vínculo user↔org com role local |
| `accounts` | Contas bancárias (checking, savings, credit_card, investment, wallet) |
| `categories` | Categorias de receita/despesa com subcategorias (parent_id) |
| `cost_centers` | Centros de custo |
| `transactions` | Transações financeiras (core) |
| `transfers` | Transferências entre contas (legacy) |
| `budgets` | Orçamentos por categoria/mês |
| `reconciliation_rules` | Regras de conciliação automática |
| `transaction_patterns` | Padrões aprendidos de classificação |
| `import_batches` | Lotes de importação (OFX/CSV/PDF) |
| `ai_suggestions` | Sugestões de classificação da IA |
| `audit_log` | Log de auditoria (append-only) |
| `bank_connections` | Conexões Open Finance (Pluggy/Klavi) |
| `open_finance_items` | Itens do Pluggy (instituições conectadas) |
| `open_finance_accounts` | Contas Open Finance mapeadas |
| `open_finance_raw_data` | Dados brutos do Open Finance |
| `open_finance_sync_logs` | Logs de sincronização |
| `sync_audit_logs` | Auditoria de sincronização |
| `ai_strategic_insights` | Insights estratégicos da IA |
| `integration_logs` | Logs de integração |
| `file_imports` | Importações de arquivo (legacy) |
| `account_balance_snapshots` | Snapshots de saldo por conta |
| `cashflow_forecasts` | Projeções de fluxo de caixa |
| `recurring_expenses` | Despesas recorrentes detectadas |
| `financial_simulations` | Simulações financeiras |
| `exchange_rates` | Taxas de câmbio |
| `materialized_metrics` | Métricas materializadas (cache) |
| `organization_subscriptions` | Assinaturas de plano |
| `plans` | Planos disponíveis |
| `api_usage_logs` | Logs de uso da API |
| `security_events` | Eventos de segurança |

### 3.2 Campos-Chave da Tabela `transactions`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | PK |
| `organization_id` | uuid | FK → organizations |
| `account_id` | uuid | FK → accounts |
| `user_id` | uuid | FK → auth.users |
| `description` | text | Descrição original |
| `normalized_description` | text | Descrição normalizada |
| `amount` | numeric | Valor (sempre positivo) |
| `type` | enum | income, expense, transfer, investment, redemption |
| `date` | date | Data da transação |
| `accrual_date` | date | Data de competência |
| `category_id` | uuid | FK → categories |
| `cost_center_id` | uuid | FK → cost_centers |
| `status` | enum | pending, completed, cancelled |
| `validation_status` | text | pending_validation, validated, rejected |
| `classification_source` | text | rule, pattern, ai, manual |
| `transaction_hash` | text | SHA-256 para deduplicação |
| `external_transaction_id` | text | ID externo (Open Finance) |
| `linked_transaction_id` | uuid | Self-ref para pares (transferências) |
| `import_batch_id` | uuid | FK → import_batches |
| `is_ignored` | boolean | Ignorar no cálculo de saldo |
| `financial_type` | text | Tipo financeiro |
| `notes` | text | Observações |
| `paid_amount` | numeric | Valor pago |
| `payment_method` | text | Método de pagamento |
| `due_date` | date | Data de vencimento |
| `payment_date` | date | Data de pagamento |

### 3.3 Campos-Chave da Tabela `accounts`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `account_type` | enum | checking, savings, credit_card, investment, wallet |
| `currency_code` | text | BRL, USD, EUR, etc. |
| `initial_balance` | numeric | Saldo inicial |
| `current_balance` | numeric | Saldo atual calculado |
| `official_balance` | numeric | Saldo oficial do banco |
| `start_date` | date | Data início para cálculo de saldo |
| `status` | enum | active, inactive |

---

## 4. Funções SQL / RPCs

| Função | Descrição |
|--------|-----------|
| `get_viewable_organizations(user_id)` | Retorna IDs das orgs que o usuário pode ver |
| `can_view_organization(org_id, user_id)` | Boolean: user pode ver esta org? |
| `can_view_transaction(tx_id, user_id)` | Boolean: user pode ver esta transação? |
| `has_role(user_id, role)` | Boolean: user tem este role global? |
| `get_user_organizations(user_id)` | Retorna orgs onde user é membro |
| `get_user_org_ids(user_id)` | Retorna apenas IDs |
| `can_view_profile(target_user_id, viewer_id)` | Boolean: viewer pode ver perfil? |
| `can_manage_org_members(user_id, org_id)` | Boolean: user pode gerenciar membros? |
| `normalize_transaction_description(text)` | Normaliza descrição de transação |
| `text_similarity(text1, text2)` | Calcula similaridade entre textos |
| `calculate_account_balance(account_id)` | Calcula saldo da conta |
| `get_subordinates(user_id)` | Retorna subordinados na hierarquia |
| `generate_financial_health_score(org_id)` | Calcula score de saúde financeira |

---

## 5. Políticas RLS (Resumo)

### Padrão de Isolamento
Todas as tabelas com `organization_id` usam:
```sql
-- SELECT: user pode ver se é admin OU org está em get_viewable_organizations()
-- INSERT: org deve estar em get_viewable_organizations()
-- UPDATE: org deve estar em get_viewable_organizations()
-- DELETE: org deve estar em get_viewable_organizations()
```

### Tabelas com Regras Especiais
- **`audit_log`**: Append-only (no UPDATE, no DELETE), SELECT apenas admin
- **`profiles`**: SELECT via `can_view_profile()`, UPDATE apenas próprio
- **`organizations`**: INSERT apenas admin, DELETE não permitido
- **`plans`**: Todos veem planos ativos, apenas admin gerencia
- **`materialized_metrics`**: Apenas SELECT (service_role insere)

---

## 6. Edge Functions (20 funções)

### 6.1 IA e Classificação

| Função | Descrição |
|--------|-----------|
| `generate-ai-analysis` | Gateway seguro para Lovable AI (Gemini 3 Flash) — chamadas genéricas |
| `generate-ai-insights` | Insights estratégicos via IA com contexto financeiro |
| `ai-chat` | Chat streaming com Wealth Advisor IA (SSE) |
| `classify-transaction` | Pipeline de classificação em 4 camadas (regras → padrões → IA) |
| `classify-transactions` | Classificação em lote |

### 6.2 Open Finance

| Função | Descrição |
|--------|-----------|
| `pluggy-connect` | Gera access token Pluggy para widget |
| `pluggy-sync` | Sincroniza contas e transações via Pluggy |
| `pluggy-webhook` | Recebe webhooks do Pluggy |
| `klavi-authorize` | Inicia fluxo OAuth Klavi |
| `klavi-exchange-token` | Troca código por token Klavi |
| `klavi-sync` | Sincroniza dados Klavi |
| `klavi-disconnect` | Desconecta conta Klavi |
| `klavi-webhook` | Recebe webhooks Klavi |

### 6.3 Importação e Processamento

| Função | Descrição |
|--------|-----------|
| `process-import` | Importação OFX/CSV/PDF com parse + deduplicação |
| `financial-core-engine` | Processamento de transações Open Finance com deduplicação hash |

### 6.4 Gestão e Seeds

| Função | Descrição |
|--------|-----------|
| `seed-categories` | Cria categorias padrão para nova organização |
| `seed-reconciliation-rules` | Cria regras de conciliação padrão |
| `manage-user-access` | Gerencia acessos: convidar, alterar role, bloquear |
| `delete-user` | Remove usuário do sistema |
| `get-user-emails` | Busca emails de usuários |
| `background-jobs` | Jobs agendados (sync, cleanup) |

### 6.5 Modelo de IA
- **Provider:** Lovable AI Gateway (`ai.gateway.lovable.dev`)
- **Modelo:** `google/gemini-3-flash-preview`
- **Secret:** `LOVABLE_API_KEY` (gerenciado pelo Cloud)
- **Nenhuma chave exposta no frontend**

---

## 7. Contextos React (4)

### 7.1 AuthContext
- Gerencia `user`, `session`, `loading`
- Métodos: `signUp`, `signIn`, `signOut`
- Verifica bloqueio de usuário/organização no login e em auth state changes
- Logout forçado se bloqueado

### 7.2 ThemeContext
- Alterna entre `light` e `dark`
- Persiste em `localStorage`
- Aplica classe no `<html>`

### 7.3 BaseFilterContext
- `selectedOrganizationId`: base selecionada
- `availableOrganizations`: orgs disponíveis
- `viewableOrganizationIds`: IDs de orgs visualizáveis
- `userRole`: role do usuário logado
- `getOrganizationFilter()`: retorna filtro para queries (`single`, `multiple`, `none`)
- `getRequiredOrganizationId()`: retorna org obrigatória para criação
- `requiresBaseSelection`: boolean, true se precisa selecionar base
- Auto-seleciona se user tem apenas 1 org

### 7.4 ValuesVisibilityContext
- `showValues`: boolean
- `toggleValues()`: alterna visibilidade
- `MaskedValue` component: aplica blur se oculto
- Persiste em `localStorage`

---

## 8. Hooks Customizados (45+ hooks)

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

## 9. Serviços

### 9.1 aiService.ts
Camada de abstração para IA no frontend:
- `callAIAnalysis(request)` → Edge Function `generate-ai-analysis`
- `classifyTransactionWithAI(request)` → Classificação via IA
- Cap de confiança IA: máximo 75%
- `is_transfer` sempre `false`
- Validação de IDs retornados contra categorias/centros de custo disponíveis

### 9.2 ibbraClientValidationService.ts
- Validação de clientes IBBRA externos
- Verificação de CPF/CNPJ

---

## 10. Páginas e Rotas (29 rotas)

| Rota | Página | Descrição |
|------|--------|-----------|
| `/` | Index | Dashboard / Consolidação Patrimonial |
| `/auth` | Auth | Login e registro |
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

---

## 11. Componentes (por módulo)

### Layout
- `AppLayout` — Layout principal com sidebar
- `AppSidebar` — Sidebar com navegação, perfil, role badge
- `AppHeader` — Header com seletor de base, tema, visibilidade
- `BaseSelector` / `BaseSelectorEnhanced` — Seletor de organização
- `BrandBackground` — Background da marca
- `InsightsHeaderButton` — Botão de insights no header

### Dashboard (20+ cards)
- `ConsolidatedBalanceSection` — Saldo consolidado
- `AccountBalancesSection` — Saldos por conta
- `MultiCurrencyBalanceSection` — Saldos multimoeda
- `MonthlyEvolutionChart` — Gráfico de evolução mensal
- `CategoryDonutChart` — Donut por categoria
- `RecentTransactions` — Transações recentes
- `StatCard` / `StatCardHoverTransactions` — Cards de estatísticas
- `BudgetProgress` — Progresso orçamentário
- `CreditCardSummary` / `CreditCardsAdvancedSummary` — Cartões
- `FinancialHealthCard` — Score de saúde financeira
- `CashflowForecastCard` — Previsão de fluxo de caixa
- `AnomalyDetectionCard` — Detecção de anomalias
- `BankConcentrationCard` — Concentração bancária
- `CurrencyExposureCard` — Exposição cambial
- `PatrimonyEvolutionCard` — Evolução patrimonial
- `PersonalRunwayCard` — Runway pessoal
- `StructuredLiquidityCard` — Liquidez estruturada
- `LifestylePatternCard` — Padrões de estilo de vida
- `RecurringExpensesCard` — Despesas recorrentes
- `StrategicInsightsCard` — Insights estratégicos
- `FinancialSimulatorCard` — Simulador financeiro
- `ReconciliationMetricsCard` — Métricas de conciliação
- `ConnectedAccountsSection` — Contas conectadas
- `FintechTransactionsList` — Transações fintech

### Admin
- `ClientManagementTab` — Gestão de clientes
- `UsersByRoleTab` — Usuários por role
- `InviteUserDialog` — Convidar usuário
- `EditUserAccessDialog` — Editar acesso
- `EditUserHierarchyDialog` — Editar hierarquia
- `DeleteUserDialog` — Excluir usuário
- `HierarchyManager` — Gerenciador de hierarquia
- `OrganizationBlockManager` — Bloqueio de organizações
- `OrganizationKamManager` — Atribuição de KAM
- `SettingsDialog` — Configurações

### IA
- `AIAssistantChat` — Chat com Wealth Advisor IA (streaming SSE)

### Relatórios
- `ExtratoContent` — Conteúdo do extrato
- `DREContent` — Conteúdo do DRE
- `FluxoCaixaContent` — Conteúdo do fluxo de caixa
- `DemonstrativoContent` — Conteúdo do demonstrativo
- `CategoryAnalysisContent` — Análise por categoria
- `FinancialTypeReportContent` — Relatório por tipo financeiro
- `MovimentacoesReportContent` — Relatório de movimentações
- `AnaliseOrcamentoContent` — Análise orçamentária
- `FinancialStatementReport` — Relatório demonstrativo
- `PeriodSelector` — Seletor de período

### Importação
- `ExtractUploader` — Upload de extratos
- `ImportCard` — Card de importação
- `ImportBatchList` — Lista de lotes
- `ImportExtractDialog` — Dialog de importação

### Open Finance
- `BankConnectionsManager` — Gerenciador de conexões

### Transações
- `TransactionDialog` — Dialog de criação/edição
- `TransactionComments` — Comentários

### Outros
- `AccountDialog` — Dialog de conta
- `CategoriesDialog` / `DeleteCategoryDialog` — Categorias
- `CostCenterDialog` — Centro de custo
- `RuleDialog` — Regra de conciliação
- `TransferDialog` — Transferência
- `BudgetAlerts` / `BudgetAnalysisCard` / `BudgetVsActualChart` — Orçamento
- `RegistrationFlow` — Fluxo de registro
- `IOSInstallPrompt` — Prompt PWA iOS

---

## 12. Pipeline de Classificação (4 Camadas)

### Camada 1: Normalização
```
"PIX TED SUPERMERCADO EXTRA 2024" → "supermercado extra"
```
- lowercase
- Remove acentos (NFD)
- Remove números de 1-4 dígitos
- Remove stopwords bancárias (pix, ted, doc, tev, transf, deb, cred, etc.)
- Remove caracteres especiais
- Colapsa espaços

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
Cada validação humana atualiza `transaction_patterns`:
- Incrementa ocorrências
- Recalcula valor médio
- Aumenta confiança

---

## 13. Open Finance

### 13.1 Pluggy (Primário)
- Widget `react-pluggy-connect`
- `pluggy-connect`: gera access token
- `pluggy-sync`: sincroniza contas + transações
- `pluggy-webhook`: recebe notificações
- Mapeia `open_finance_items` → `open_finance_accounts` → `accounts`

### 13.2 Klavi (Secundário)
- Fluxo OAuth redirect
- `klavi-authorize` → `klavi-exchange-token` → `klavi-sync`
- `klavi-disconnect` / `klavi-webhook`

### 13.3 Deduplicação
- **external_transaction_id**: dedup por ID externo
- **transaction_hash**: SHA-256 de `date|amount|normalized_description|account_id`
- Ambos verificados antes de inserir

### 13.4 Cartões de Crédito
- Dados prioritários de `open_finance_accounts`:
  - `credit_limit`, `available_credit`, `due_day`, `closing_day`
  - Fallback: `raw_data.creditData.creditLimit`
- Permite saldo utilizado > limite (cartão em atraso)
- Porcentagem de uso pode exceder 100%
- Barra visual capped em 100% width

---

## 14. Importação de Extratos

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

## 15. Chat IA (Wealth Advisor)

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

### Rate Limiting
- 429: Limite de requisições excedido
- 402: Créditos de IA esgotados

---

## 16. Relatórios e PDF

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

## 17. PWA (Progressive Web App)

### Configuração
- `vite-plugin-pwa` com service worker
- `manifest.json` com ícones 192x192 e 512x512
- Splash screens para iOS
- `IOSInstallPrompt` para instalação em Safari

---

## 18. Segredos / Variáveis de Ambiente

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

### Frontend (Públicas)
| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave publicável |

---

## 19. Terminologia Oficial

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

## 20. Performance e Otimizações

### Lazy Loading
- Todas as páginas (exceto Index, Auth, NotFound) são lazy-loaded via `React.lazy()`
- `Suspense` com `PageLoader` global

### Query Caching
- React Query com cache padrão
- `materialized_metrics` para métricas pesadas (1h TTL)
- `account_balance_snapshots` para saldos

### Lógica de Saldo
- Saldo = `initial_balance` + Σ(receitas) − Σ(despesas)
- Exclui transações com `is_ignored = true`
- Exclui contas de investimento do saldo disponível
- `start_date` controla a partir de quando contar transações

---

## 21. Dependências Principais

| Pacote | Versão | Uso |
|--------|--------|-----|
| `react` | ^18.3.1 | Framework UI |
| `react-router-dom` | ^6.30.1 | Roteamento |
| `@tanstack/react-query` | ^5.83.0 | Data fetching |
| `@supabase/supabase-js` | ^2.95.3 | Cliente Supabase |
| `tailwindcss-animate` | ^1.0.7 | Animações |
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

---

*Documento gerado automaticamente — v5.0 — Fevereiro 2026*
