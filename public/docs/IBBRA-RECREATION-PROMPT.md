# PROMPT COMPLETO PARA RECRIAR O SISTEMA IBBRA

## Instruções de Uso

Cole este prompt na primeira mensagem de uma nova conta Lovable. O sistema será criado em 5 etapas progressivas para economizar créditos.

---

# ETAPA 1 - ESTRUTURA BASE (Cole este bloco primeiro)

```
Crie um sistema completo de gestão financeira multi-tenant chamado "Ibbra" usando React, TypeScript, Tailwind CSS, shadcn/ui e Supabase.

## DESIGN
- Estética "Wealth Management" profissional
- Paleta: Navy #011e40, Bege #eae1dc, Neutros
- Desktop-first, elegante e minimalista

## ARQUITETURA MULTI-TENANT

### Organizações (Bases)
- Cada cliente = 1 organização isolada
- Todos os dados filtrados por organization_id
- Logo customizável por organização

### Hierarquia de Usuários (5 níveis)
1. Admin: Gestão total
2. Supervisor: Validação e qualidade  
3. FA (Financial Analyst): Classificação e análise
4. KAM (Key Account Manager): Relacionamento e relatórios
5. Cliente: Upload e visualização restrita

### Vinculações
- Cliente → KAM responsável
- KAM → FA supervisor
- FA → Supervisor
- Clientes nunca excluídos, apenas bloqueados

## BANCO DE DADOS - TABELAS

### organizations
id uuid PK, name text, slug text, logo_url text, kam_id uuid FK nullable,
is_blocked boolean, blocked_at timestamp, blocked_reason text,
cpf_cnpj text, phone text, address text, settings jsonb,
created_at timestamp, updated_at timestamp

### profiles
id uuid PK, user_id uuid FK auth.users, full_name text, avatar_url text,
is_blocked boolean, blocked_at timestamp, blocked_reason text,
created_at timestamp, updated_at timestamp

### user_roles
id uuid PK, user_id uuid, role app_role (enum: admin, supervisor, fa, kam, cliente),
created_at timestamp

### user_hierarchy
id uuid PK, user_id uuid, supervisor_id uuid FK nullable,
created_at timestamp, updated_at timestamp

### organization_members
id uuid PK, organization_id uuid FK, user_id uuid, role app_role,
created_at timestamp

### accounts
id uuid PK, user_id uuid, organization_id uuid FK, name text, bank_name text,
account_type enum (checking, savings, investment, credit_card, cash),
initial_balance numeric, current_balance numeric, color text,
status enum (active, inactive), created_at timestamp, updated_at timestamp

### categories
id uuid PK, user_id uuid, organization_id uuid FK, name text,
type enum (income, expense, investment, redemption),
parent_id uuid FK categories nullable (hierarquia pai/filho),
icon text, color text, description text, dre_group text,
created_at timestamp, updated_at timestamp

### cost_centers
id uuid PK, user_id uuid, organization_id uuid FK, name text, description text,
is_active boolean default true, created_at timestamp, updated_at timestamp

### transactions
id uuid PK, user_id uuid, organization_id uuid FK, account_id uuid FK,
type enum (income, expense, transfer, investment, redemption),
amount numeric, date date, accrual_date date, description text, raw_description text,
normalized_description text, category_id uuid FK, cost_center_id uuid FK,
import_batch_id uuid FK nullable, status enum (pending, completed, cancelled),
validation_status enum (pending_validation, validated, rejected, needs_review),
classification_source text (rule, pattern, ai, manual),
validated_at timestamp, validated_by uuid, transaction_hash text, notes text,
created_at timestamp, updated_at timestamp

### transfers
id uuid PK, user_id uuid, organization_id uuid FK,
origin_account_id uuid FK, destination_account_id uuid FK,
amount numeric, transfer_date date, description text,
status enum (pending, completed, cancelled),
created_at timestamp, updated_at timestamp

### budgets
id uuid PK, user_id uuid, organization_id uuid FK, category_id uuid FK,
amount numeric, month integer, year integer, cost_center_id uuid FK nullable,
created_at timestamp, updated_at timestamp

### reconciliation_rules
id uuid PK, user_id uuid, organization_id uuid FK, description text,
category_id uuid FK, cost_center_id uuid FK, transaction_type text,
amount numeric, due_day integer, is_active boolean default true,
created_at timestamp, updated_at timestamp

### transaction_patterns (AUTO-LEARNING)
id uuid PK, organization_id uuid FK, normalized_description text,
category_id uuid FK, cost_center_id uuid FK, transaction_type text,
avg_amount numeric, confidence numeric (0-1), occurrences integer,
last_used_at timestamp, created_at timestamp, updated_at timestamp

### import_batches
id uuid PK, user_id uuid, organization_id uuid FK, account_id uuid FK,
file_name text, file_path text, file_type text, file_size integer,
status enum (pending, processing, awaiting_validation, completed, failed, cancelled),
total_transactions integer, imported_count integer, duplicate_count integer, error_count integer,
period_start date, period_end date, error_message text, metadata jsonb,
created_at timestamp, updated_at timestamp

### ai_suggestions
id uuid PK, transaction_id uuid FK, suggested_category_id uuid FK,
suggested_cost_center_id uuid FK, suggested_type text, suggested_competence_date date,
confidence_score numeric, reasoning text, model_version text,
was_accepted boolean, accepted_at timestamp, accepted_by uuid,
created_at timestamp

### audit_log
id uuid PK, user_id uuid, organization_id uuid FK, table_name text,
action text, record_id uuid, old_values jsonb, new_values jsonb,
ip_address inet, user_agent text, created_at timestamp

## FUNÇÕES SQL ESSENCIAIS

1. get_viewable_organizations(_user_id uuid) RETURNS uuid[]
   - Admin: todas organizações
   - Supervisor/FA/KAM: baseado em hierarquia
   - Cliente: apenas sua organização

2. calculate_account_balance(account_uuid uuid) RETURNS numeric

3. has_role(_role app_role, _user_id uuid) RETURNS boolean

4. get_subordinates(_user_id uuid) RETURNS uuid[]

5. normalize_transaction_description(description text) RETURNS text

6. text_similarity(text1 text, text2 text) RETURNS numeric

## RLS POLICIES
Todas tabelas com RLS habilitado usando get_viewable_organizations(auth.uid())

## TRIGGER handle_new_user
- Primeiro usuário → role 'admin'
- Demais → role 'cliente'
- Cria profile automaticamente

## STORAGE BUCKET
Nome: "extratos", Public: false

## ROTAS
/, /auth, /transacoes, /receitas, /despesas, /contas, /categorias,
/centros-custo, /regras-conciliacao, /importacoes, /orcamentos,
/pendencias, /analise-orcamento, /relatorios, /dre,
/demonstrativo-financeiro, /fluxo-caixa, /perfil, /admin, /padroes-aprendidos

## REGRA DE OURO: SELEÇÃO DE BASE
- Usuários multi-base têm seletor no header
- "Todas bases" = apenas visualização (Dashboard, Pendências)
- Criar/Editar/Excluir = requer base selecionada
- Sem base = alerta + estado vazio + ações bloqueadas

## CONTEXTOS REACT
1. AuthContext: user, session, signUp, signIn, signOut + verificação bloqueio
2. ThemeContext: dark/light mode
3. BaseFilterContext: selectedOrganizationId, availableOrganizations, viewableOrganizationIds

Comece criando:
1. Configuração Supabase client
2. Contextos Auth, Theme, BaseFilter
3. Layout (AppLayout, AppSidebar, AppHeader)
4. Página de login (sem cadastro público)
5. Dashboard básico
6. Migração SQL completa
```

---

# ETAPA 2 - CRUDs FINANCEIROS

```
Continue o sistema Ibbra adicionando:

1. CRUD de Contas Bancárias:
   - Dialog criação/edição
   - Tipos: Corrente, Poupança, Investimento, Cartão Crédito, Dinheiro
   - Cálculo automático de saldo

2. CRUD de Categorias:
   - Hierarquia pai/filho
   - Ícones e cores
   - Mapeamento DRE (receita_operacional, despesas_operacionais, etc)
   - Botão "Criar Categorias Iniciais" (42 categorias padrão)

3. CRUD de Centros de Custo

4. Hook useTransactions com filtros (type, date, category, account, status)

5. Telas Receitas e Despesas (filtradas por type)

6. CRUD de Regras de Conciliação
   - Descrição, categoria, centro custo, tipo, valor, dia vencimento
   - Botão "Criar Regras Iniciais" (17 grupos padrão)

Aplicar regra de base obrigatória em todas as telas.
```

---

# ETAPA 3 - IMPORTAÇÃO E CLASSIFICAÇÃO

```
Continue adicionando:

1. Sistema de Importação de Extratos:
   - Upload OFX, CSV, PDF
   - Edge function process-import:
     - Parse OFX (regex STMTTRN)
     - Parse CSV (detecta separador, colunas)
     - Parse PDF com Lovable AI Gateway (gemini-2.5-flash)
   - Hash SHA-256 para duplicatas
   - Lista de batches com status

2. Motor de Conciliação Automática (classify-transaction):
   
   PIPELINE FIXO (ordem obrigatória):
   a) Normalizar descrição (lowercase, sem acentos, sem números curtos, sem stopwords)
   b) Buscar em reconciliation_rules:
      - Se similarity ≥ 80% → AUTO-VALIDAR, classification_source = "rule"
   c) Buscar em transaction_patterns:
      - Se confidence ≥ 85% E occurrences ≥ 3 → AUTO-VALIDAR, classification_source = "pattern"
   d) Fallback IA:
      - NUNCA auto-validar, apenas sugerir
      - Salvar em ai_suggestions
      - classification_source = "ai"

3. Tela de Pendências:
   - Lista transações validation_status='pending_validation'
   - Exibir badge da origem (Regra, Aprendido, IA)
   - Exibir confiança (%)
   - Seletores tipo, categoria, centro custo
   - Botões validar/rejeitar
   - Badge no menu com contagem

4. Aprendizado Contínuo:
   - Quando validar manualmente → upsert em transaction_patterns
   - Incrementar occurrences, recalcular avg_amount, aumentar confidence
```

---

# ETAPA 4 - ORÇAMENTOS E RELATÓRIOS

```
Continue com:

1. Sistema de Orçamentos:
   - CRUD por categoria, mês, ano
   - Progress bar gasto vs orçado
   - Alertas 80% e 100%

2. Relatórios com exportação PDF (jspdf + jspdf-autotable):
   - DRE (Demonstrativo de Resultados)
   - Fluxo de Caixa
   - Demonstrativo Financeiro por período
   - Logo Ibbra no cabeçalho
   - Cores: Navy #011e40, Beige #eae1dc
   - Page breaks inteligentes

3. Análise de Orçamento (Budget vs Actual Chart com Recharts)

4. Dashboard completo:
   - StatCards (Saldo Total, Receitas, Despesas, Economia)
   - BudgetAlerts
   - MonthlyEvolutionChart
   - RecentTransactions
   - ImportCard
   - BudgetProgress
   - ReconciliationMetricsCard (ADMIN ONLY):
     - % auto-validação
     - Por fonte (Regra, Padrão, IA)
     - Tempo economizado
     - Padrões confiáveis
```

---

# ETAPA 5 - ADMINISTRAÇÃO E SEGURANÇA

```
Finalize com:

1. Tela /admin (apenas admins):
   - Tabs por perfil: Cliente, KAM, FA, Supervisor, Admin
   - Tabela com email visível
   - Invite dialog
   - Editar acesso (email, reset senha, bloquear)
   - Editar hierarquia (FA e KAM)
   - Excluir (com reatribuição de subordinados)

2. Tab Cliente especial:
   - CRUD de organizações
   - Upload logo
   - Atribuir KAM
   - Bloquear/desbloquear base

3. Tela /padroes-aprendidos (admin only):
   - Tabela com todos transaction_patterns
   - Filtros por tipo, organização
   - Estatísticas: total, alta confiança, ocorrências
   - Opção excluir padrão

4. Edge functions:
   - manage-user-access (update_email, reset_password, toggle_block)
   - delete-user (com reatribuição obrigatória)
   - get-user-emails

5. Audit log via trigger de banco (log_audit_event)

6. AuthContext com verificação de bloqueio:
   - Bloquear login se usuário bloqueado
   - Bloquear login se TODAS organizações bloqueadas
```

---

## DICAS PARA ECONOMIZAR CRÉDITOS

1. Cole cada etapa completa de uma vez
2. Aguarde conclusão antes da próxima
3. Use "continue" sem repetir contexto
4. Agrupe correções em uma única mensagem
5. Seja específico: "No arquivo X, linha Y, altere Z"

## ASSETS NECESSÁRIOS (Upload após criação)

- /public/ibbra-logo.jpeg (logo sidebar)
- /public/ibbra-logo-pdf.png (logo PDFs)

---

**Versão**: 1.0
**Data**: Janeiro 2026
