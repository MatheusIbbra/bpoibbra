# IBBRA — Prompt de Recriação v2.0

> **Objetivo:** Recriar o sistema IBBRA do zero em 5 etapas.
> **Uso:** Backup e disaster recovery.
> **Última atualização:** Fevereiro 2026

---

## ETAPA 1 — Fundação (Banco de Dados + Auth)

### 1.1 Criar projeto Supabase

Stack: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase + TanStack React Query v5

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

### 1.3 Tabelas Principais

Criar as seguintes tabelas (ver documentação V3 para schema completo):

1. `organizations` — Multi-tenant, com bloqueio
2. `profiles` — Extensão de auth.users, com bloqueio
3. `user_roles` — Roles separados (CRÍTICO: nunca no profile)
4. `user_hierarchy` — Hierarquia supervisor → subordinado
5. `organization_members` — Vínculo user ↔ org com role
6. `accounts` — Contas financeiras (5 tipos)
7. `categories` — Categorias hierárquicas com DRE
8. `cost_centers` — Centros de custo
9. `transactions` — Transações (tabela central, 30+ colunas)
10. `transfers` — Transferências entre contas
11. `budgets` — Orçamentos mensais
12. `reconciliation_rules` — Regras de conciliação manuais
13. `transaction_patterns` — Padrões aprendidos automaticamente
14. `import_batches` — Lotes de importação
15. `ai_suggestions` — Sugestões da IA
16. `audit_log` — Log imutável de auditoria
17. `bank_connections` — Conexões bancárias
18. `open_finance_items` — Itens Open Finance (UNIQUE org + institution)
19. `open_finance_accounts` — Contas OF (UNIQUE item + pluggy_account_id)
20. `open_finance_sync_logs` — Logs de sync
21. `open_finance_raw_data` — Dados brutos
22. `sync_audit_logs` — Auditoria de syncs
23. `ai_strategic_insights` — Insights IA salvos
24. `integration_logs` — Logs de integrações
25. `file_imports` — Importações legado

### 1.4 Funções SQL (SECURITY DEFINER)

```sql
-- Função crítica: verificar role sem recursão RLS
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Organizações visíveis (lógica de hierarquia)
CREATE OR REPLACE FUNCTION get_viewable_organizations(_user_id uuid)
RETURNS uuid[] ...

-- Normalização de texto para matching
CREATE OR REPLACE FUNCTION normalize_transaction_description(description text)
RETURNS text ...
-- lowercase, remove acentos, remove números, remove stopwords

-- Similaridade de texto
CREATE OR REPLACE FUNCTION text_similarity(text1 text, text2 text)
RETURNS numeric ...

-- Cálculo de saldo
CREATE OR REPLACE FUNCTION calculate_account_balance(account_uuid uuid)
RETURNS numeric ...
-- initial_balance + SUM(income) - SUM(expense) + SUM(redemption) - SUM(investment)

-- Upsert de padrão
CREATE OR REPLACE FUNCTION upsert_transaction_pattern(...)
RETURNS uuid ...

-- Subordinados
CREATE OR REPLACE FUNCTION get_subordinates(_user_id uuid)
RETURNS uuid[] ...
```

### 1.5 RLS

Habilitar RLS em TODAS as tabelas. Padrão:
- SELECT: `get_viewable_organizations(auth.uid())` ou `has_role(admin)`
- INSERT: mesmo + `user_id = auth.uid()`
- UPDATE/DELETE: mesmo filtro
- audit_log: SELECT admin only, UPDATE/DELETE bloqueados
- user_roles: admin only para CUD

---

## ETAPA 2 — Identidade Visual + Layout

### 2.1 Fontes
```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
```

### 2.2 Paleta IBBRA (CSS Variables em HSL)
```css
:root {
  --brand-deep: 213 80% 13%;       /* #011E41 */
  --brand-highlight: 210 100% 36%;  /* #005CB9 */
  --brand-light-blue: 214 58% 95%;  /* #ECF2FA */
  --brand-cream: 18 24% 89%;        /* #EBE1DC */
  --brand-coral: 14 100% 54%;       /* #FF4614 */

  --background: 0 0% 99%;
  --foreground: 213 80% 13%;
  --primary: 213 80% 13%;
  --accent: 210 100% 36%;
  --destructive: 14 100% 54%;
  --success: 160 60% 38%;
  --warning: 38 92% 50%;

  --sidebar-background: 213 80% 13%;
  --sidebar-foreground: 214 40% 90%;
  --sidebar-primary: 210 100% 50%;
  --sidebar-accent: 213 60% 20%;
}
```

### 2.3 Tipografia
- h1, h2, h3: `font-family: 'Playfair Display', Georgia, serif`
- h4+, body: `font-family: 'Plus Jakarta Sans', system-ui, sans-serif`
- Letter-spacing negativo para títulos (-0.03em, -0.025em, -0.02em)

### 2.4 Conceito Visual
- Elegante, sutil, segura, objetiva, racional
- Cards brancos com sombra suave (`shadow-executive`)
- Sidebar azul escuro com gradiente sutil
- Bordas discretas, espaçamento generoso
- **EVITAR:** gradientes, cores fora da paleta, sombras fortes, elementos chamativos

### 2.5 Layout Principal
- AppLayout: Sidebar + Content area
- AppSidebar: Azul escuro IBBRA, logo, navegação, perfil no footer
- AppHeader: Seletor de base, controles, visibilidade de valores
- Cards com classe `card-executive` (bg-card, rounded-xl, border sutil, shadow suave)

---

## ETAPA 3 — Funcionalidades Core

### 3.1 Contextos React (4)
1. **AuthContext** — Login, logout, sessão, recuperação
2. **ThemeContext** — Modo claro/escuro, localStorage
3. **BaseFilterContext** — Seleção de base obrigatória (organization_id)
4. **ValuesVisibilityContext** — Ocultar/mostrar valores

### 3.2 Dashboard (Consolidação Patrimonial)
Rota `/` — 4 StatCards no topo:
- **Posição Financeira** — Saldo das contas correntes (exclui investimento, cartão, OF sem vínculo)
- **Entradas Financeiras** — Receitas do mês
- **Saídas Financeiras** — Despesas do mês
- **Evolução Patrimonial** — Diferença (entradas - saídas)

Seções:
- Saldos por conta
- Gráfico de evolução mensal (Recharts)
- Gráfico de categorias (donut)
- Transações recentes
- Métricas de conciliação
- Insights estratégicos (IA)
- Resumo de cartões de crédito
- Progresso orçamentário

### 3.3 Transações
- CRUD completo com filtros por período, tipo, categoria, conta
- Validação (pending_validation → validated/rejected)
- Classificação automática pós-criação
- Histórico de classificação (source: rule, pattern, ai, manual)

### 3.4 Importação de Extratos
Fluxo de 9 etapas:
1. Upload (OFX/CSV/PDF) para Supabase Storage
2. Validação de formato
3. Criação do lote (import_batches)
4. Edge Function process-import:
   - Parse do arquivo
   - Hash SHA-256 para deduplicação
   - Inserção de transações
   - Classificação automática
5. Atualização do status do lote
6. Notificação ao usuário

### 3.5 Pipeline de Classificação
4 camadas sequenciais (ver Edge Function classify-transaction):
1. Normalização → normalize_transaction_description()
2. Regras de conciliação → text_similarity ≥ 80% → AUTO-VALIDADO
3. Padrões aprendidos → confidence ≥ 85% + occurrences ≥ 3 → AUTO-VALIDADO
4. IA Gemini 2.5 Flash → NUNCA auto-valida, cap 75%, vai para Pendências

Aprendizado: cada validação humana → upsert_transaction_pattern()

### 3.6 Orçamentos
- Cadastro mensal por categoria + centro de custo
- Análise orçamentária (realizado vs orçado)
- Alertas de orçamento (>80%, >100%)

### 3.7 Relatórios
- DRE (Demonstrativo de Resultados)
- Fluxo de Caixa
- Demonstrativo Financeiro
- Extrato
- Análise por Categoria
- Análise Orçamentária
- Relatório por Tipo Financeiro
- Movimentações
- Exportação PDF (jsPDF + jspdf-autotable)

---

## ETAPA 4 — Integrações

### 4.1 IA (Gemini 2.5 Flash)

**Arquitetura segura:**
- Edge Function `generate-ai-analysis` → Gateway seguro
- `GEMINI_API_KEY` configurada como secret no Supabase
- Frontend chama via `aiService.ts` → supabase.functions.invoke()
- Nenhuma chave exposta no cliente

**Funções:**
- `callAIAnalysis()` — Chamada genérica
- `classifyTransactionWithAI()` — Classificação com validação de IDs

**Edge Functions de IA:**
- `generate-ai-analysis` — Gateway genérico
- `generate-ai-insights` — Insights estratégicos do dashboard
- `classify-transaction` — Pipeline de classificação (camada 3 = IA)
- `classify-transactions` — Classificação em lote

### 4.2 Open Finance — Pluggy (Primária)

**Fluxo:**
1. `pluggy-connect` — Gera access token e abre widget via popup
2. Usuário conecta banco no widget
3. `pluggy-webhook` — Recebe notificação de item criado/atualizado
4. `pluggy-sync` — Busca contas e transações via API Pluggy
5. `financial-core-engine` — Processa dados:
   - Cria/atualiza open_finance_items e open_finance_accounts
   - Deduplicação por sync_dedup_key
   - Classificação por creditDebitType
   - Criação de transações locais
   - Ignora transações espelhadas

**Tabelas:** open_finance_items, open_finance_accounts, open_finance_sync_logs, open_finance_raw_data, sync_audit_logs

**Constraints:**
- open_finance_items: UNIQUE (organization_id, institution_name)
- open_finance_accounts: UNIQUE (item_id, pluggy_account_id)

### 4.3 Open Finance — Klavi (Secundária)

**Fluxo OAuth:**
1. `klavi-authorize` — Inicia autorização
2. Redirect para Klavi
3. `/callback-klavi` — Recebe código
4. `klavi-exchange-token` — Troca por access token
5. `klavi-sync` — Sincroniza dados
6. `klavi-disconnect` — Revoga consentimento

### 4.4 Secrets necessários
```
GEMINI_API_KEY
PLUGGY_CLIENT_ID
PLUGGY_CLIENT_SECRET
```

---

## ETAPA 5 — Administração + Polish

### 5.1 Painel Admin (/admin)
- Gestão de usuários por role
- Convite de novos usuários
- Edição de acesso e hierarquia
- Bloqueio/desbloqueio de usuários e organizações
- Gestão de KAMs
- Audit log

### 5.2 Cadastros (/cadastros)
Hub unificado para:
- Contas (/contas)
- Categorias (/categorias)
- Centros de Custo (/centros-custo)
- Regras de Conciliação (/regras-conciliacao)

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
- Exclui: contas de investimento, cartões de crédito
- Exclui: contas Open Finance sem local_account_id
- Cada conta corrente Open Finance precisa de conta local vinculada

### 5.7 Configuração Edge Functions (supabase/config.toml)
Todas as 19 funções com `verify_jwt = false` (autenticação gerenciada internamente via Authorization header).

---

## Checklist de Validação

- [ ] Todas as 25 tabelas criadas com RLS
- [ ] Todas as 12+ funções SQL criadas como SECURITY DEFINER
- [ ] 19 Edge Functions deployadas
- [ ] Identidade visual IBBRA aplicada (paleta, tipografia, sidebar)
- [ ] Terminologia corporativa em todas as telas
- [ ] Pipeline de classificação funcional (regras → padrões → IA)
- [ ] Open Finance Pluggy conectando e sincronizando
- [ ] Secrets configurados (GEMINI_API_KEY, PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET)
- [ ] Dashboard com 4 métricas (Posição Financeira, Entradas, Saídas, Evolução)
- [ ] Importação OFX/CSV/PDF funcional
- [ ] Relatórios com exportação PDF
- [ ] Painel admin com gestão de acessos e hierarquia
- [ ] Audit log imutável
- [ ] Cartões de crédito com resumo avançado

---

*Prompt de recriação — IBBRA v2.0 — Fevereiro 2026*
