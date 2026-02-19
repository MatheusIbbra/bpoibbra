# IBBRA — Prompt de Recriação V8.0

> **Propósito**: Recriar o sistema IBBRA completo a partir do zero em um novo projeto Lovable.  
> **Última atualização**: 19 de Fevereiro de 2026  
> **Referência**: IBBRA-SYSTEM-DOCUMENTATION-V9.md  

---

## ETAPA 1: Setup Inicial

### 1.1 Projeto
1. Criar projeto React + Vite + TypeScript no Lovable
2. Conectar ao Supabase existente: `umqehhhpedwqdfjmdjqv`
3. Instalar dependências:
   ```
   @sentry/react @supabase/supabase-js @tanstack/react-query framer-motion recharts
   date-fns jspdf jspdf-autotable papaparse react-router-dom react-pluggy-connect
   zod react-hook-form @hookform/resolvers vite-plugin-pwa sonner
   ```

### 1.2 Design System (index.css)

Configurar tokens HSL em `src/index.css`:

```css
:root {
  --brand-deep: 213 80% 13%;       /* #011E41 */
  --brand-highlight: 210 100% 36%;  /* #005CB9 */
  --brand-cream: 18 24% 89%;        /* #EBE1DC */
  --brand-cream-deep: 18 14% 77%;   /* #CEC3BE */
  --brand-coral: 14 100% 54%;       /* #FF4614 */
  --brand-light-blue: 214 58% 95%;  /* #ECF2FA */

  --background: 18 24% 89%;
  --foreground: 213 80% 13%;
  --primary: 213 80% 13%;
  --primary-foreground: 0 0% 100%;
  --accent: 210 100% 36%;
  --accent-foreground: 0 0% 100%;
  --destructive: 14 100% 54%;
  --success: 160 60% 36%;
  --warning: 38 92% 50%;

  --sidebar-background: 213 80% 13%;
  --sidebar-foreground: 214 30% 88%;
}
```

**Fontes**: Playfair Display (headings) + Plus Jakarta Sans (body)

### 1.3 Assets

Copiar logos da marca:
- `src/assets/ibbra-logo-full.png`
- `src/assets/ibbra-logo-full-white.png`
- `src/assets/ibbra-logo-icon.png`
- `src/assets/ibbra-logo-white.png`
- `public/ibbra-logo.jpeg`
- `public/ibbra-grafismo.svg`
- `public/icons/icon-192.png`, `icon-512.png`
- `public/splash/*` (iOS splash screens)

---

## ETAPA 2: Banco de Dados

### 2.1 Tabelas Core

Recriar todas as tabelas documentadas na V9 com:

- **RLS habilitado** em todas as tabelas
- Funções SECURITY DEFINER:
  - `get_viewable_organizations(user_id)` — retorna orgs visíveis (incluindo subordinados)
  - `get_user_organizations(user_id)` — orgs diretas do usuário
  - `has_role(user_id, role)` — verifica role
  - `can_view_organization(org_id, user_id)` — acesso à org
  - `calculate_account_balance(account_uuid)` — saldo calculado
  - `get_subordinates(user_id)` — hierarquia

- **Políticas RLS** usando `get_viewable_organizations()` para dados financeiros
- `audit_log` imutável (DELETE/UPDATE bloqueados)
- `bank_connections_safe` view com `security_invoker=on`
- Extensões `unaccent` e `pg_trgm` no schema `extensions`

### 2.2 Tabelas Essenciais (ordem de criação)

1. `organizations` (com slug, base_currency, blocking, kam_id)
2. `organization_members` (user_id, org_id, role)
3. `plans` + `organization_subscriptions`
4. `accounts` (6 tipos: checking, savings, investment, cash, credit_card, other)
5. `categories` (hierárquicas com parent_id, dre_group, expense_classification)
6. `cost_centers`
7. `transactions` (com external_transaction_id, sync_dedup_key, classification_source, financial_type)
8. `budgets`
9. `reconciliation_rules` + `transaction_patterns`
10. `bank_connections` (com encryption_version, access_token_encrypted)
11. `open_finance_items` + `open_finance_accounts` + `open_finance_raw_data` + `open_finance_sync_logs`
12. `sync_audit_logs`
13. `ai_suggestions` + `ai_strategic_insights`
14. `materialized_metrics` + `cashflow_forecasts` + `financial_simulations`
15. `import_batches` + `file_imports`
16. `audit_log` + `integration_logs`
17. `consent_logs` + `legal_documents` + `data_deletion_requests` + `data_export_requests`
18. `exchange_rates` + `family_members`
19. `feature_flags` + `api_usage_logs`
20. `push_subscriptions` + `pending_registrations`
21. `account_balance_snapshots`

---

## ETAPA 3: Edge Functions (24)

Todas com `verify_jwt = false` em `supabase/config.toml` (validação manual no código).

### 3.1 Funções Críticas

#### `pluggy-connect`
- Autentica com Pluggy API (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`)
- Retorna `accessToken` para o widget Pluggy Connect
- Valida sessão do usuário

#### `pluggy-sync` (815+ linhas, 10 etapas)
1. Trigger PATCH no item Pluggy (força refresh)
2. Poll status até UPDATED (max 20 × 5s)
3. Fetch accounts + investments
4. Save metadata na bank_connection
5. Create/update local accounts (com rename de contas legadas)
6. Fetch all transactions (paginado)
7. Import com deduplicação 3 camadas
8. **Classificação automática** (regras → padrões → IA Gemini)
9. Mirror detection (movimentos espelhados)
10. Reconciliação de saldos + audit log

#### `pluggy-webhook`
- Recebe evento `transactions/created` da Pluggy
- Dispara sync automático via service_role
- Permite importação mesmo com navegador fechado

#### `classify-transaction`
Pipeline de 4 camadas:
1. Normalização de texto
2. Regras de conciliação (≥80%)
3. Padrões aprendidos (≥80% sim, ≥60% conf)
4. IA Gemini 3 Flash (cap 75%, nunca auto-valida)

#### `process-import`
- Processa CSV, OFX e PDF (≤500KB)
- Auto-classificação obrigatória pós-importação

#### `background-jobs`
- Computa métricas materializadas
- Envia push notifications para alertas de saúde financeira

### 3.2 Secrets Necessários

| Secret | Descrição |
|--------|-----------|
| `PLUGGY_CLIENT_ID` | Pluggy Client ID |
| `PLUGGY_CLIENT_SECRET` | Pluggy Client Secret |
| `LOVABLE_API_KEY` | Lovable AI Gateway (auto-configurado) |

---

## ETAPA 4: Frontend

### 4.1 Estrutura de Contextos

```typescript
<GlobalErrorBoundary>
  <QueryClientProvider>
    <ThemeProvider>
      <AuthProvider>
        <BaseFilterProvider>
          <ValuesVisibilityProvider>
            <UpgradeModalProvider>
              <TooltipProvider>
                {/* Toasters, IOSInstallPrompt, UpgradeModal */}
                <BrowserRouter>
                  <OnboardingGuard>
                    <Routes>...</Routes>
                  </OnboardingGuard>
                </BrowserRouter>
              </TooltipProvider>
            </UpgradeModalProvider>
          </ValuesVisibilityProvider>
        </BaseFilterProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
</GlobalErrorBoundary>
```

### 4.2 Rotas (35)

Implementar todas as rotas documentadas na V9. Páginas críticas (Index, Auth, NotFound, Onboarding) com carregamento eager; demais lazy.

### 4.3 Componentes Chave

- **AppLayout**: Layout base com sidebar, header, base selector
- **AppSidebar**: Navegação lateral com ícones Lucide, links contextuais por role
- **AppHeader**: Header com busca, notificações, perfil
- **BaseSelector / BaseSelectorEnhanced**: Seletor de organização ativa
- **Dashboard Cards** (25+): StatCard, CategoryDonutChart, MonthlyEvolutionChart, FinancialHealthCard, CashflowForecastCard, StrategicInsightsCard, etc.
- **BankConnectionsManager**: Interface de conexão Open Finance
- **TransactionDialog**: CRUD de transação com classificação automática
- **UpgradeModal**: Modal responsivo de upgrade de plano

### 4.4 Helper de API

```typescript
// src/lib/supabase-helpers.ts
export function getSupabaseFunctionsUrl(): string {
  const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1`;
}

export async function callEdgeFunction(functionName: string, body?: Record<string, unknown>): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(`${getSupabaseFunctionsUrl()}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
```

**REGRA**: Todas as chamadas de edge function devem usar este helper ou `supabase.functions.invoke()`. NUNCA URLs hardcoded.

---

## ETAPA 5: Funcionalidades

### 5.1 Autenticação
- Email/senha + Google OAuth
- Validação CPF para clientes IBBRA (`ibbraClientValidationService`)
- Onboarding obrigatório (`OnboardingGuard`)
- Registro em 3 steps (CPF → Método → Dados)

### 5.2 Multi-Organização
- Seletor de base obrigatório
- Hierarquia: admin > supervisor > fa > kam > cliente
- `get_viewable_organizations()` para acesso em cascata
- Bloqueio de organizações por admin

### 5.3 Dashboard (25+ widgets)
- StatCards (receitas, despesas, saldo, investimentos)
- Gráficos: CategoryDonut, MonthlyEvolution, PatrimonyEvolution
- IA: StrategicInsights, AnomalyDetection, FinancialHealth
- Previsão: CashflowForecast, PersonalRunway
- Crédito: CreditCardSummary, CreditCardsAdvancedSummary
- Multi-moeda: MultiCurrencyBalance, CurrencyExposure

### 5.4 Transações
- CRUD completo com categoria, centro de custo, data competência
- Importação: CSV, OFX, PDF (via `process-import`)
- Classificação automática obrigatória (4 camadas)
- Toggle `is_ignored` para transferências internas
- Comentários por transação

### 5.5 Relatórios (PDF export via jsPDF)
- DRE (Demonstração de Resultado)
- Fluxo de Caixa
- Demonstrativo Financeiro
- Extrato
- Análise Orçamentária
- Análise por Categoria
- Relatório por Tipo Financeiro

### 5.6 Open Finance
- Widget Pluggy Connect (popup)
- Sincronização completa com classificação automática
- Webhook para sync em background
- Deduplicação em 3 camadas
- Lógica especial para cartão de crédito
- Mirror detection para movimentos espelhados

### 5.7 Orçamentos
- Mensal por categoria + centro de custo
- Análise de variância (real vs orçado)
- Alertas de ultrapassagem

### 5.8 IA
- Classificação de transações (Gemini 3 Flash)
- Insights estratégicos com histórico
- Chat assistente
- Sugestões salvas em `ai_suggestions`

### 5.9 Push Notifications
- Web Push API com VAPID keys
- `push_subscriptions` table
- Background-jobs para alertas de saúde
- Gestão no perfil do usuário

### 5.10 Admin
- Gestão de clientes (criar, editar, bloquear, deletar)
- Gestão de usuários (invite, roles, hierarquia)
- KAM assignment
- Gestão de planos
- BI tab
- Feature flags

### 5.11 LGPD
- Consent logging
- Exportação de dados
- Solicitação de exclusão
- Documentos legais versionados
- Re-aceite de termos

### 5.12 PWA
- Service worker com precaching
- iOS install prompt
- Splash screens customizados
- Manifest com ícones

---

## ETAPA 6: Monitoramento

### 6.1 Sentry
```typescript
// src/lib/sentry.ts
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0.2,
  enabled: import.meta.env.PROD,
});
```

### 6.2 Error Boundary
```typescript
class GlobalErrorBoundary extends Component {
  componentDidCatch(error, errorInfo) {
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }
}
```

### 6.3 CI/CD
GitHub Actions:
- `ci.yml`: test → lint → build → migration check
- Script `check-migration.sh` para validação de rollback

---

## Checklist Final

- [ ] Todas as 30+ tabelas criadas com RLS
- [ ] 24 edge functions deployadas
- [ ] 35 rotas implementadas
- [ ] 64 hooks customizados
- [ ] 5 contextos React
- [ ] Design system com tokens HSL
- [ ] Sentry configurado
- [ ] PWA com manifest e service worker
- [ ] Testes Vitest rodando
- [ ] CI/CD GitHub Actions
- [ ] Secrets configurados (Pluggy, Lovable AI)
- [ ] LGPD compliance (consent, export, deletion)
- [ ] Classificação automática em todas as importações
- [ ] Deduplicação de transações
- [ ] Mirror detection
- [ ] Helper centralizado para Edge Functions
