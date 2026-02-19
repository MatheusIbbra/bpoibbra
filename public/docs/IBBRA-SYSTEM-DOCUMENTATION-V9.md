# IBBRA — Documentação Técnica Completa V9.0

> **Última atualização**: 19 de Fevereiro de 2026  
> **Versão**: 9.0  
> **Autor**: Equipe IBBRA / Lovable AI  

---

## 1. Visão Geral

**IBBRA** é uma plataforma SaaS (PWA) de gestão financeira e estratégia patrimonial, construída para consultoria de wealth management. Atende clientes individuais e family offices com rastreamento financeiro multi-organização, integração Open Finance, classificação por IA e conformidade LGPD.

### 1.1 Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Framer Motion |
| **Backend** | Supabase (PostgreSQL 15, Auth, Edge Functions Deno, Storage, RLS) |
| **IA** | Lovable AI Gateway → Google Gemini 3 Flash Preview |
| **Open Finance** | Pluggy (primário) + Klavi (legado) |
| **Monitoramento** | Sentry (error tracking + performance) |
| **CI/CD** | GitHub Actions (test, lint, build, migration validation) |
| **PWA** | vite-plugin-pwa, iOS-ready com splash screens |
| **Testes** | Vitest + React Testing Library |

### 1.2 Projeto Supabase

- **Project ID**: `umqehhhpedwqdfjmdjqv`
- **URL Publicada**: `https://bpoibbra.lovable.app`

---

## 2. Arquitetura

### 2.1 Estrutura do Frontend

```
src/
├── assets/              # Logos e imagens da marca
├── components/
│   ├── admin/           # Painel admin (ClientManagement, UsersByRole, Hierarchy, Plans, BI)
│   │   └── client-management/  # Subcomponentes refatorados
│   ├── ai/              # Chat assistente IA
│   ├── auth/            # Fluxo de auth, Onboarding, Registration
│   │   └── registration/       # Steps de registro (CPF, SignupMethod, ClientQuestion)
│   ├── budget/          # Alertas, análise e gráficos de orçamento
│   ├── categories/      # Diálogos de gestão de categorias
│   ├── common/          # UI compartilhada (ConfirmDialog, SkeletonCard, BaseRequiredAlert)
│   ├── cost-centers/    # Diálogos de centros de custo
│   ├── dashboard/       # 25+ cards e widgets do dashboard
│   ├── import/          # Importação de arquivos (CSV/OFX/PDF)
│   ├── layout/          # AppLayout, Sidebar, Header, BaseSelector, BaseSelectorEnhanced
│   ├── open-finance/    # Gerenciador de conexões bancárias
│   ├── organizations/   # Gestão de membros
│   ├── profile/         # Privacidade, Push Notifications
│   ├── pwa/             # iOS install prompt
│   ├── reports/         # DRE, Fluxo de Caixa, Demonstrativo, Extrato, Análise de Categorias
│   ├── rules/           # Diálogo de regras de conciliação
│   ├── subscription/    # Modal de upgrade de plano
│   ├── transactions/    # Diálogos e comentários de transações
│   ├── transfers/       # Diálogo de transferências
│   └── ui/              # Componentes shadcn/ui (40+)
├── contexts/            # 5 contextos React
├── hooks/               # 64 hooks customizados
├── lib/                 # Utilitários (formatters, audit, PDF, error handler, Sentry, supabase-helpers)
├── pages/               # 35 páginas de rota (lazy-loaded)
├── services/            # AI service, client validation
└── test/                # Testes Vitest
```

### 2.2 Contextos React (5)

| Contexto | Responsabilidade |
|----------|-----------------|
| `AuthContext` | Sessão do usuário, login, logout, roles |
| `BaseFilterContext` | Seleção de organização ativa (base), filtro multi-org |
| `ThemeContext` | Light/Dark mode |
| `ValuesVisibilityContext` | Ocultação de valores financeiros (privacidade) |
| `UpgradeModalContext` | Controle do modal de upgrade de plano |

### 2.3 Hooks Customizados (64)

| Hook | Função |
|------|--------|
| `useAccounts` | CRUD de contas bancárias |
| `useAIClassification` | Classificação IA de transações |
| `useAnomalyDetection` | Detecção de anomalias financeiras |
| `useAuditLog` | Consulta de audit trail |
| `useAutoIgnoreTransfers` | Auto-ignore de transferências internas |
| `useBankConcentration` | Concentração bancária |
| `useBankConnections` | Conexões Open Finance (CRUD + sync + disconnect) |
| `useBudgetAnalysis` | Análise orçamentária |
| `useBudgets` | CRUD de orçamentos |
| `useCashFlowReport` | Relatório de fluxo de caixa |
| `useCashflowForecast` | Previsão de fluxo de caixa |
| `useCategories` | CRUD de categorias |
| `useCategoryAnalysisReport` | Relatório por categoria |
| `useClearReconciliationRules` | Limpeza de regras |
| `useConsentLogs` | Logs de consentimento LGPD |
| `useConsolidatedBalance` | Saldo consolidado |
| `useCostCenters` | CRUD de centros de custo |
| `useCreditCardAdvancedSummary` | Resumo avançado de cartões |
| `useCreditCardDetails` | Detalhes de cartão |
| `useCreditCardSummary` | Resumo de cartões |
| `useCurrencyExposure` | Exposição cambial |
| `useDREReport` | Relatório DRE |
| `useDailyEvolution` | Evolução diária |
| `useDashboardStats` | Estatísticas do dashboard |
| `useDataExport` | Exportação de dados |
| `useFeatureFlags` | Feature flags |
| `useFileImports` | Importações de arquivo |
| `useFinancialHealthScore` | Score de saúde financeira |
| `useFinancialSimulator` | Simulador financeiro |
| `useFinancialTypeReport` | Relatório por tipo financeiro |
| `useImportBatches` | Lotes de importação |
| `useLifestylePattern` | Padrões de estilo de vida |
| `useMacroSimulation` | Simulação macroeconômica |
| `useMonthlyEvolution` | Evolução mensal |
| `useOnboardingGuard` | Guarda de onboarding |
| `useOpenFinanceStatus` | Status do Open Finance |
| `useOrganizations` | CRUD de organizações |
| `usePatrimonyEvolution` | Evolução patrimonial |
| `usePendingTransactionsCount` | Contagem de pendências |
| `usePersonalRunway` | Runway pessoal |
| `usePlanLimits` | Limites do plano |
| `usePushNotifications` | Push notifications |
| `useReconciliationMetrics` | Métricas de conciliação |
| `useReconciliationRules` | CRUD de regras de conciliação |
| `useRecurringExpenses` | Despesas recorrentes |
| `useReportsData` | Dados de relatórios |
| `useRoleView` | Visualização por role |
| `useSeedCategories` | Seed de categorias |
| `useSeedReconciliationRules` | Seed de regras |
| `useStrategicHistory` | Histórico estratégico |
| `useStrategicInsights` | Insights estratégicos IA |
| `useStructuredLiquidity` | Liquidez estruturada |
| `useSubscription` | Gestão de assinatura |
| `useToggleIgnore` | Toggle is_ignored |
| `useTransactionComments` | Comentários de transações |
| `useTransactionPatterns` | Padrões de transação |
| `useTransactionPatternsAdmin` | Admin de padrões |
| `useTransactions` | CRUD de transações |
| `useTransfers` | CRUD de transferências |
| `useUserEmails` | Lookup de emails |
| `useUserHierarchy` | Hierarquia de usuários |
| `useUserRoles` | Roles de usuários |
| `use-mobile` | Detecção de mobile |
| `use-toast` | Sistema de toasts |

---

## 3. Rotas (35)

| Rota | Página | Carregamento |
|------|--------|-------------|
| `/` | `Index` (Dashboard) | Eager |
| `/auth` | `Auth` | Eager |
| `/onboarding` | `Onboarding` | Eager |
| `/admin` | `Admin` | Lazy |
| `/transacoes` | `Transacoes` | Lazy |
| `/receitas` | `Receitas` | Lazy |
| `/despesas` | `Despesas` | Lazy |
| `/orcamentos` | `Orcamentos` | Lazy |
| `/pendencias` | `Pendencias` | Lazy |
| `/relatorios` | `Relatorios` | Lazy |
| `/relatorio-dre` | `RelatorioDRE` | Lazy |
| `/relatorio-fluxo-caixa` | `RelatorioFluxoCaixa` | Lazy |
| `/demonstrativo-financeiro` | `DemonstrativoFinanceiro` | Lazy |
| `/contas` | `Contas` | Lazy |
| `/centros-custo` | `CentrosCusto` | Lazy |
| `/analise-orcamento` | `AnaliseOrcamento` | Lazy |
| `/categorias` | `Categorias` | Lazy |
| `/importacoes` | `Importacoes` | Lazy |
| `/perfil` | `Perfil` | Lazy |
| `/regras-conciliacao` | `RegrasConciliacao` | Lazy |
| `/padroes-aprendidos` | `PadroesAprendidos` | Lazy |
| `/documentacao` | `Documentacao` | Lazy |
| `/extrato` | `Extrato` | Lazy |
| `/movimentacoes` | `Movimentacoes` | Lazy |
| `/cadastros` | `Cadastros` | Lazy |
| `/open-finance` | `OpenFinance` | Lazy |
| `/callback-klavi` | `CallbackKlavi` | Lazy |
| `/cartao-credito` | `CartaoCredito` | Lazy |
| `/cartoes-credito` | `CartoesCredito` | Lazy |
| `/cartoes` | `CartoesCredito` (alias) | Lazy |
| `/open-finance-monitor` | `OpenFinanceMonitor` | Lazy |
| `/termos-de-uso` | `TermosDeUso` | Lazy |
| `/politica-de-privacidade` | `PoliticaPrivacidade` | Lazy |
| `/lgpd` | `Lgpd` | Lazy |
| `/consent-reaccept` | `ConsentReaccept` | Lazy |

---

## 4. Banco de Dados

### 4.1 Tabelas Principais (30+)

| Tabela | Descrição |
|--------|-----------|
| `organizations` | Base multi-tenant com bloqueio, KAM, moeda base, slug |
| `organization_members` | Membros por org com role (admin, supervisor, fa, kam, cliente) |
| `organization_subscriptions` | Assinatura da org vinculada a plano |
| `plans` | Planos disponíveis com limites |
| `accounts` | Contas (checking, savings, investment, cash, credit_card) |
| `transactions` | Movimentações financeiras com categoria, centro de custo, data competência |
| `categories` | Categorias hierárquicas com DRE group e financial_type |
| `cost_centers` | Centros de custo por org |
| `budgets` | Orçamentos mensais por categoria/centro |
| `bank_connections` | Conexões Open Finance (Pluggy/Klavi) |
| `open_finance_items` | Items sincronizados (instituições) |
| `open_finance_accounts` | Contas via Open Finance |
| `open_finance_raw_data` | Dados brutos para auditoria |
| `open_finance_sync_logs` | Logs de sincronização |
| `reconciliation_rules` | Regras de conciliação automática |
| `transaction_patterns` | Padrões aprendidos de transações |
| `ai_suggestions` | Sugestões da IA para classificação |
| `ai_strategic_insights` | Insights estratégicos gerados por IA |
| `materialized_metrics` | Métricas computadas (cache) |
| `cashflow_forecasts` | Previsões de fluxo de caixa |
| `financial_simulations` | Simulações financeiras |
| `import_batches` | Lotes de importação (CSV/OFX/PDF) |
| `file_imports` | Importações de arquivo (legado) |
| `audit_log` | Log de auditoria imutável |
| `integration_logs` | Logs de integração Open Finance |
| `sync_audit_logs` | Auditoria de sincronização (saldos) |
| `consent_logs` | Logs de consentimento LGPD |
| `legal_documents` | Documentos legais (termos, privacidade) |
| `data_deletion_requests` | Solicitações de exclusão LGPD |
| `data_export_requests` | Solicitações de exportação |
| `exchange_rates` | Taxas de câmbio |
| `family_members` | Membros familiares |
| `feature_flags` | Feature flags |
| `api_usage_logs` | Logs de uso de API |
| `push_subscriptions` | Assinaturas de push notification |
| `pending_registrations` | Registros pendentes |
| `account_balance_snapshots` | Snapshots de saldo |
| `bank_connections_safe` | View segura (sem tokens) |

### 4.2 Funções SQL (RPCs)

| Função | Tipo | Descrição |
|--------|------|-----------|
| `get_viewable_organizations(user_id)` | SECURITY DEFINER | Retorna IDs de orgs visíveis (own + subordinados) |
| `get_user_organizations(user_id)` | SECURITY DEFINER | Retorna orgs do usuário |
| `get_user_org_ids(user_id)` | SECURITY DEFINER | IDs de orgs simplificado |
| `can_view_organization(org_id, user_id)` | SECURITY DEFINER | Verifica acesso à org |
| `has_role(user_id, role)` | SECURITY DEFINER | Verifica se usuário tem role |
| `can_manage_org_members(user_id, org_id)` | SECURITY DEFINER | Pode gerenciar membros |
| `can_view_profile(profile_user_id, requesting_user_id)` | SECURITY DEFINER | Pode ver perfil |
| `calculate_account_balance(account_uuid)` | SECURITY DEFINER | Calcula saldo de conta |
| `get_subordinates(user_id)` | SECURITY DEFINER | Retorna subordinados |
| `normalize_transaction_description(text)` | IMMUTABLE | Normaliza texto para matching |

### 4.3 Segurança (RLS)

- **Todas as tabelas** possuem RLS habilitado
- Acesso baseado em `get_viewable_organizations(auth.uid())` para dados financeiros
- `has_role()` para verificação de admin
- `audit_log` é imutável (DELETE e UPDATE bloqueados)
- `bank_connections_safe` é uma view com `security_invoker=on` que herda RLS
- Tokens de banco criptografados com AES-256-GCM (`access_token_encrypted`, `refresh_token_encrypted`)

---

## 5. Edge Functions (24)

| Função | Descrição |
|--------|-----------|
| `ai-chat` | Chat conversacional com IA |
| `background-jobs` | Jobs agendados (métricas, push notifications) |
| `check-plan-limits` | Verificação de limites do plano |
| `classify-transaction` | Pipeline 4 camadas: regras → padrões → IA (individual) |
| `classify-transactions` | Classificação em lote |
| `delete-client` | Exclusão de cliente (admin) |
| `delete-user` | Exclusão de usuário (admin) |
| `financial-core-engine` | Motor financeiro core |
| `generate-ai-analysis` | Análise IA de dados financeiros |
| `generate-ai-insights` | Insights estratégicos via Gemini |
| `get-user-emails` | Lookup de emails (admin) |
| `klavi-authorize` | OAuth Klavi (legado) |
| `klavi-disconnect` | Desconexão Klavi (legado) |
| `klavi-exchange-token` | Exchange token Klavi (legado) |
| `klavi-sync` | Sincronização Klavi (legado) |
| `klavi-webhook` | Webhook Klavi (legado) |
| `manage-user-access` | Gestão de acesso de usuários |
| `pluggy-connect` | Obtenção de token para widget Pluggy |
| `pluggy-sync` | Sincronização completa Pluggy (10 steps) |
| `pluggy-webhook` | Webhook Pluggy para sync automático |
| `process-import` | Processamento de importação CSV/OFX/PDF |
| `seed-categories` | Seed de categorias iniciais |
| `seed-reconciliation-rules` | Seed de regras de conciliação |
| `send-push-notification` | Envio de push notification |

### 5.1 Pipeline de Sincronização Pluggy (`pluggy-sync`)

```
1. TRIGGER: PATCH item → força refresh do banco
2. POLL: Aguarda item status = UPDATED (max 20 tentativas × 5s)
3. FETCH ACCOUNTS: Busca todas as contas do item
4. FETCH INVESTMENTS: Busca investimentos
5. SAVE METADATA: Atualiza bank_connection com dados do connector
6. CREATE/UPDATE LOCAL ACCOUNTS: Mapeia contas Pluggy → contas locais
7. FETCH TRANSACTIONS: Busca transações de todas as contas
8. IMPORT WITH DEDUP: Deduplicação em 3 camadas (external_id, dedup_key, fuzzy 90%)
9. CLASSIFY: Pipeline 3 camadas (regras → padrões → IA Gemini)
10. MIRROR DETECTION: Detecta movimentos espelhados (entrada+saída mesmo valor/dia)
11. RECONCILIATION: Compara saldos API vs sistema
12. POPULATE OF TABLES: Atualiza open_finance_items, open_finance_accounts, sync_logs
```

### 5.2 Pipeline de Classificação (4 Camadas)

```
Camada 1: NORMALIZAÇÃO
  → Remove acentos, stopwords bancárias, números, caracteres especiais

Camada 2: REGRAS DE CONCILIAÇÃO (similaridade ≥ 80%)
  → Match por keyword + similaridade de palavras
  → Auto-validação se match único ≥ 80%
  → Fonte: "rule"

Camada 3: PADRÕES APRENDIDOS (confiança ≥ 60%, match ≥ 80%)
  → Similaridade de descrição normalizada
  → Auto-validação se confiança ≥ 85% E ocorrências ≥ 3
  → Fonte: "pattern"

Camada 4: IA (Lovable AI Gateway → Gemini 3 Flash)
  → Recebe categorias e centros de custo como contexto
  → Confiança capped em 75% (nunca auto-valida)
  → Grava em ai_suggestions para audit trail
  → Fonte: "ai"
```

### 5.3 Lógica de Cartão de Crédito

- **Compras**: Classificadas como `expense` (regime de competência)
- **Pagamento de fatura**: Reclassificado como `transfer` com `is_ignored = true`
- **Padrões de detecção**: "pagamento recebido", "pagamento da fatura", "pgto fatura", etc.
- **Estornos/Devoluções**: Detectados por padrões ("estorno", "devolucao", "reembolso")

### 5.4 Deduplicação de Transações

```
1. External ID: Busca por external_transaction_id na organização
2. Dedup Key: SHA baseado em data + valor + descrição normalizada
3. Fuzzy Match: Similaridade ≥ 90% com mesmo dia/valor/conta/tipo
   → IMPORTANTE: Inclui type (income/expense) para evitar falso-positivo em PIX recíproco
```

---

## 6. Comunicação com Backend

### 6.1 Helper Centralizado (`src/lib/supabase-helpers.ts`)

```typescript
import { supabase } from "@/integrations/supabase/client";

export function getSupabaseFunctionsUrl(): string {
  const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1`;
}

export async function callEdgeFunction(
  functionName: string,
  body?: Record<string, unknown>,
  method: string = "POST"
): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const url = `${getSupabaseFunctionsUrl()}/${functionName}`;
  return fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
```

**Regra**: Nunca usar URLs hardcoded. Sempre usar `callEdgeFunction()` ou `supabase.functions.invoke()`.

---

## 7. Design System

### 7.1 Identidade Visual

| Token | HSL | Hex | Uso |
|-------|-----|-----|-----|
| `--brand-deep` | 213 80% 13% | #011E41 | Azul Profundo (primary) |
| `--brand-highlight` | 210 100% 36% | #005CB9 | Azul Highlight (accent) |
| `--brand-cream` | 18 24% 89% | #EBE1DC | Creme Claro (background) |
| `--brand-cream-deep` | 18 14% 77% | #CEC3BE | Creme Sofisticado |
| `--brand-coral` | 14 100% 54% | #FF4614 | Vermelho pontual (destructive) |
| `--brand-light-blue` | 214 58% 95% | #ECF2FA | Azul Claro |

### 7.2 Tipografia

- **Headings**: Playfair Display (serif) — peso 400-700
- **Body**: Plus Jakarta Sans (sans-serif) — peso 300-800

### 7.3 Tokens Semânticos

Todos os tokens estão definidos em `src/index.css` usando HSL. O dark mode usa tons de azul profundo.

**Sidebar**: Gradiente em Deep Blue com acentos mais claros.

---

## 8. Autenticação e Autorização

### 8.1 Fluxo de Auth

1. Login por email/senha ou Google OAuth
2. Validação de CPF para clientes IBBRA (via `ibbraClientValidationService`)
3. Onboarding obrigatório na primeira entrada
4. `OnboardingGuard` redireciona para `/onboarding` se necessário

### 8.2 Hierarquia de Roles

```
admin (Super Admin)
  └── supervisor
        └── fa (Financial Advisor)
              └── kam (Key Account Manager)
                    └── cliente
```

- **Admin**: Acesso total + gestão de usuários e planos
- **Supervisor**: Vê todas as orgs dos subordinados
- **FA**: Vê orgs dos clientes atribuídos
- **KAM**: Vê orgs atribuídas
- **Cliente**: Vê apenas sua própria org

---

## 9. Open Finance

### 9.1 Pluggy (Provedor Primário)

- Widget de conexão via popup (`react-pluggy-connect`)
- Token obtido via `pluggy-connect` edge function
- Sincronização via `pluggy-sync` (10 etapas)
- Webhook `pluggy-webhook` para sync automático em background
- Logos oficiais dos bancos com fallback para bancos brasileiros comuns

### 9.2 Klavi (Legado)

- Edge functions `klavi-*` mantidas para compatibilidade
- Não é mais o provedor ativo

### 9.3 Secrets Necessários

| Secret | Descrição |
|--------|-----------|
| `PLUGGY_CLIENT_ID` | Client ID Pluggy |
| `PLUGGY_CLIENT_SECRET` | Client Secret Pluggy |
| `LOVABLE_API_KEY` | Chave do AI Gateway (classificação IA) |

---

## 10. Monitoramento e Qualidade

### 10.1 Sentry

- Integrado via `@sentry/react`
- `tracesSampleRate: 0.2` (production only)
- Error boundary global com captura automática

### 10.2 CI/CD (GitHub Actions)

- **Push/PR**: test → lint → build → migration validation
- **Migration rollback**: script `check-migration.sh`

### 10.3 Testes (Vitest)

- `errorHandler.test.ts` — Error handling
- `formatters.test.ts` — Formatação de valores
- `useBudgetAnalysis.test.ts` — Análise orçamentária
- `useCashFlowReport.test.ts` — Relatório fluxo caixa
- `useDREReport.test.ts` — DRE
- `useFinancialHealthScore.test.ts` — Score de saúde
- `planLimits.test.ts` — Limites de plano
- `reconciliation.test.ts` — Regras de conciliação

---

## 11. PWA

- **Service Worker**: vite-plugin-pwa com precaching
- **Manifest**: `public/manifest.json`
- **iOS**: Splash screens customizados, `IOSInstallPrompt` component
- **Ícones**: 192x192 e 512x512

---

## 12. Conformidade LGPD

- `consent_logs`: Registro de todos os consentimentos
- `data_deletion_requests`: Solicitações de exclusão de dados
- `data_export_requests`: Solicitações de exportação
- `legal_documents`: Termos de uso e política de privacidade versionados
- `audit_log`: Imutável (sem UPDATE/DELETE)
- Página `/lgpd` com gestão de consentimentos
- Página `/consent-reaccept` para re-aceitar termos atualizados

---

## 13. Terminologia Oficial

| Termo Sistema | Significado |
|--------------|------------|
| Consolidação Patrimonial | Dashboard principal com visão consolidada |
| Posição Financeira | Saldo atual das contas |
| Entradas Financeiras | Receitas |
| Saídas Financeiras | Despesas |
| Evolução Patrimonial | Gráfico de evolução do patrimônio |
| Base / Organização | Entidade multi-tenant do cliente |
| FA | Financial Advisor |
| KAM | Key Account Manager |

---

## 14. Dependências Principais

```json
{
  "@sentry/react": "^10.39.0",
  "@supabase/supabase-js": "^2.95.3",
  "@tanstack/react-query": "^5.83.0",
  "date-fns": "^3.6.0",
  "framer-motion": "^12.34.0",
  "jspdf": "^4.0.0",
  "jspdf-autotable": "^5.0.7",
  "papaparse": "^5.5.3",
  "react": "^18.3.1",
  "react-pluggy-connect": "^2.12.0",
  "react-router-dom": "^6.30.1",
  "recharts": "^2.15.4",
  "sonner": "^1.7.4",
  "zod": "^3.25.76",
  "vite-plugin-pwa": "^1.2.0"
}
```

---

## 15. Variáveis de Ambiente

| Variável | Escopo | Descrição |
|----------|--------|-----------|
| `VITE_SUPABASE_URL` | Frontend | URL do Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Anon key |
| `VITE_SUPABASE_PROJECT_ID` | Frontend | Project ID |
| `VITE_SENTRY_DSN` | Frontend | DSN do Sentry |
| `SUPABASE_URL` | Edge Functions | URL (auto-injetada) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Service role (auto-injetada) |
| `SUPABASE_ANON_KEY` | Edge Functions | Anon key (auto-injetada) |
| `PLUGGY_CLIENT_ID` | Edge Functions | Pluggy Client ID |
| `PLUGGY_CLIENT_SECRET` | Edge Functions | Pluggy Client Secret |
| `LOVABLE_API_KEY` | Edge Functions | Lovable AI Gateway |

---

## 16. Checklist de Segurança

- [x] RLS habilitado em TODAS as tabelas
- [x] `bank_connections_safe` view com `security_invoker=on`
- [x] AES-256-GCM para tokens bancários
- [x] Audit logging para operações críticas
- [x] CSP meta tags no index.html
- [x] JWT validation manual em todas as edge functions
- [x] Extensões (`unaccent`, `pg_trgm`) em schema `extensions`
- [x] Helper centralizado para chamadas de Edge Functions (sem URLs hardcoded)
- [x] Error boundary global com Sentry
- [x] Migration rollback documentation
