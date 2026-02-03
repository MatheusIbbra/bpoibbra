
# Prompt Completo para Recriar o Sistema Ibbra - Gestão Financeira Multi-Tenant

## Instruções de Uso

Para economizar créditos ao máximo, copie este prompt inteiro e cole na nova conta Lovable como primeira mensagem. O sistema será criado em etapas progressivas.

---

# PROMPT INICIAL (Cole este bloco na primeira mensagem)

```
Crie um sistema completo de gestão financeira multi-tenant chamado "Ibbra" usando React, TypeScript, Tailwind CSS, shadcn/ui e Supabase. O sistema deve ter as seguintes características:

## ARQUITETURA CORE

### 1. Multi-Tenancy com Organizações
- Cada cliente tem uma "Base" (organização) 
- Isolamento total de dados por organization_id em todas as tabelas
- Logo customizável por organização

### 2. Hierarquia de Usuários (5 níveis)
- Admin: Gestão total do sistema
- Supervisor: Validação e qualidade
- FA (Financial Analyst): Classificação e análise
- KAM (Key Account Manager): Relacionamento e relatórios
- Cliente: Upload e visualização restrita

### 3. Regras de Vinculação Hierárquica
- Clientes devem ter um KAM responsável
- KAMs devem ter um FA supervisor
- FAs devem ter um Supervisor
- Alteração de vínculos recalcula acessos imediatamente

## TABELAS DO BANCO DE DADOS

### organizations
- id (uuid), name, slug, logo_url, kam_id (uuid FK nullable)
- is_blocked, blocked_at, blocked_reason
- cpf_cnpj, phone, address, settings (jsonb)
- created_at, updated_at

### profiles
- id, user_id (uuid FK auth.users), full_name, avatar_url
- is_blocked, blocked_at, blocked_reason
- created_at, updated_at

### user_roles
- id, user_id, role (enum: admin, supervisor, fa, kam, cliente)
- created_at

### user_hierarchy
- id, user_id, supervisor_id (FK user_id nullable)
- created_at, updated_at

### organization_members
- id, organization_id, user_id, role (enum)
- created_at

### accounts (Contas Bancárias)
- id, user_id, organization_id, name, bank_name
- account_type (enum: checking, savings, investment, credit_card, cash)
- initial_balance, current_balance, color
- status (enum: active, inactive)
- created_at, updated_at

### categories
- id, user_id, organization_id, name, type (enum: income, expense, investment, redemption)
- parent_id (FK categories - hierarquia pai/filho)
- icon, color, description, dre_group
- created_at, updated_at

### cost_centers
- id, user_id, organization_id, name, description
- is_active (default true)
- created_at, updated_at

### transactions
- id, user_id, organization_id, account_id
- type (enum: income, expense, transfer, investment, redemption)
- amount, date, accrual_date, description, raw_description
- category_id, cost_center_id, import_batch_id
- status (enum: pending, completed, cancelled)
- validation_status (enum: pending_validation, validated, rejected, needs_review)
- validated_at, validated_by, transaction_hash, notes
- created_at, updated_at

### transfers
- id, user_id, organization_id
- origin_account_id, destination_account_id
- amount, transfer_date, description
- status (enum)
- created_at, updated_at

### budgets
- id, user_id, organization_id, category_id
- amount, month, year, cost_center_id
- created_at, updated_at

### reconciliation_rules
- id, user_id, organization_id, description
- category_id, cost_center_id, transaction_type
- amount, due_day, is_active
- created_at, updated_at

### import_batches
- id, user_id, organization_id, account_id
- file_name, file_path, file_type, file_size
- status (enum: pending, processing, awaiting_validation, completed, failed, cancelled)
- total_transactions, imported_count, duplicate_count, error_count
- period_start, period_end, error_message, metadata
- created_at, updated_at

### ai_suggestions
- id, transaction_id, suggested_category_id, suggested_cost_center_id
- suggested_type, suggested_competence_date
- confidence_score, reasoning, model_version
- was_accepted, accepted_at, accepted_by
- created_at

### audit_log
- id, user_id, organization_id, table_name
- action, record_id, old_values, new_values
- ip_address, user_agent
- created_at

## FUNÇÕES SQL ESSENCIAIS

1. get_viewable_organizations(_user_id uuid) RETURNS uuid[]
   - Admin: todas organizações
   - Supervisor/FA/KAM: baseado em hierarquia
   - Cliente: apenas sua organização

2. calculate_account_balance(account_uuid uuid) RETURNS numeric
   - Calcula saldo considerando transações e transferências

3. has_role(_role app_role, _user_id uuid) RETURNS boolean

4. get_subordinates(_user_id uuid) RETURNS uuid[]

5. can_view_user_data(_target_user_id, _viewer_id) RETURNS boolean

## RLS POLICIES

Todas as tabelas devem ter RLS habilitado com políticas baseadas em:
- get_viewable_organizations(auth.uid()) para SELECT
- Verificação de organization_id para INSERT/UPDATE/DELETE

## TRIGGER

handle_new_user: 
- Primeiro usuário recebe role 'admin'
- Demais recebem 'cliente'
- Cria profile automaticamente

## PÁGINAS E ROTAS

1. /auth - Login (sem cadastro público, sem botão admin)
2. / - Dashboard com stats, gráfico evolução, transações recentes, orçamentos
3. /transacoes - Lista consolidada
4. /receitas - Filtro type=income
5. /despesas - Filtro type=expense  
6. /contas - Contas bancárias
7. /categorias - Hierarquia pai/filho, criar categorias iniciais (42 categorias padrão com DRE)
8. /centros-custo - Centros de custo
9. /regras-conciliacao - Regras automáticas
10. /importacoes - Upload OFX/CSV/PDF
11. /orcamentos - Orçamento por categoria/mês
12. /pendencias - Transações pendentes de validação
13. /analise-orcamento - Budget vs Realizado
14. /relatorios - Relatórios diversos
15. /dre - Demonstrativo de Resultados
16. /demonstrativo-financeiro - Demonstrativo por período
17. /fluxo-caixa - Fluxo de caixa
18. /admin - Gerenciamento de usuários por role (apenas admin)
19. /perfil - Perfil do usuário

## REGRA DE OURO: SELEÇÃO DE BASE OBRIGATÓRIA

- Usuários com múltiplas bases (Admin, Supervisor, FA, KAM) devem ter seletor de base no header
- "Todas as bases" permite apenas visualização no Dashboard e Pendências
- Todas as outras telas (Categorias, Contas, etc) exigem base selecionada
- Sem base selecionada: mostrar alerta + estado vazio, bloquear criar/editar/excluir

## EDGE FUNCTIONS

1. process-import: Parse OFX/CSV/PDF, detecção duplicatas via hash
2. classify-transaction: Classificação por regras + IA (Lovable AI Gateway)
3. seed-categories: Criar 42 categorias iniciais com mapeamento DRE
4. seed-reconciliation-rules: Criar regras de conciliação padrão
5. manage-user-access: Update email, reset password, block/unblock (admin only)
6. delete-user: Exclusão com reatribuição de subordinados
7. get-user-emails: Buscar emails de usuários (admin only)

## COMPONENTES REUTILIZÁVEIS

- BaseRequiredAlert: Alerta quando base não selecionada
- useCanCreate(): Hook que retorna {canCreate, requiresBaseSelection}
- BaseSelector: Dropdown de seleção de base no header
- AppLayout: Layout com sidebar + header
- StatCard, BudgetProgress, MonthlyEvolutionChart

## EXPORTAÇÃO PDF

- Logo Ibbra no cabeçalho
- Design profissional minimalista
- Cores: Navy #011e40, Beige #eae1dc
- Page breaks inteligentes (não cortar tabelas)
- jspdf + jspdf-autotable

## CONTEXTOS REACT

1. AuthContext: user, session, signUp, signIn, signOut + verificação bloqueio
2. ThemeContext: dark/light mode
3. BaseFilterContext: selectedOrganizationId, availableOrganizations, viewableOrganizationIds, userRole, getOrganizationFilter, requiresBaseSelection, getRequiredOrganizationId

## STORAGE BUCKET

- Nome: "extratos"
- Public: false
- Para armazenar arquivos de importação

Comece criando a estrutura base do projeto com:
1. Configuração Supabase client
2. Contextos Auth, Theme, BaseFilter
3. Layout principal (AppLayout, AppSidebar, AppHeader)
4. Página de login (sem cadastro)
5. Dashboard básico
6. Migração SQL com todas as tabelas, enums, funções e RLS
```

---

## ETAPA 2 (Segunda mensagem após criação inicial)

```
Continue o sistema Ibbra adicionando:

1. CRUD completo de Contas Bancárias com:
   - Dialog de criação/edição
   - Tipos: Corrente, Poupança, Investimento, Cartão Crédito, Dinheiro
   - Cálculo automático de saldo

2. CRUD de Categorias com:
   - Hierarquia pai/filho
   - Ícones e cores
   - Mapeamento DRE (receita_operacional, despesas_operacionais, etc)
   - Botão "Criar Categorias Iniciais" (42 categorias padrão)

3. CRUD de Centros de Custo

4. Hook useTransactions com filtros (type, date, category, account, status)

5. Telas de Receitas e Despesas (filtradas por type)

Lembre-se: aplicar regra de base obrigatória em todas as telas
```

---

## ETAPA 3 (Terceira mensagem)

```
Continue adicionando:

1. Sistema de Importação de Extratos:
   - Upload de arquivos OFX, CSV, PDF
   - Edge function process-import que:
     - Parse OFX (regex STMTTRN)
     - Parse CSV (detecta separador, colunas data/descrição/valor)
     - Parse PDF com Lovable AI Gateway (gemini-2.5-flash)
   - Detecção de duplicatas via SHA-256 hash
   - Lista de batches com status

2. Tela de Pendências:
   - Lista transações com validation_status='pending_validation'
   - Seletores para tipo, categoria, centro de custo
   - Botões validar/rejeitar
   - Sugestões da IA exibidas

3. Edge function classify-transaction:
   - Primeiro tenta match com reconciliation_rules (70% similarity)
   - Fallback para IA com contexto de categorias existentes
```

---

## ETAPA 4 (Quarta mensagem)

```
Continue com:

1. Sistema de Orçamentos:
   - CRUD por categoria, mês, ano
   - Progress bar de gasto vs orçado
   - Alertas quando ultrapassar 80% e 100%

2. Relatórios:
   - DRE (Demonstrativo de Resultados)
   - Fluxo de Caixa
   - Demonstrativo Financeiro por período
   - Exportação PDF profissional com logo Ibbra

3. Análise de Orçamento (Budget vs Actual Chart)

4. Dashboard completo:
   - StatCards (Saldo Total, Receitas, Despesas, Economia)
   - BudgetAlerts
   - MonthlyEvolutionChart (Recharts)
   - RecentTransactions
   - ImportCard com regra de base
   - BudgetProgress
```

---

## ETAPA 5 (Quinta mensagem - Admin)

```
Finalize com o módulo de Administração:

1. Tela /admin (apenas admins):
   - Tabs por perfil: Cliente, KAM, FA, Supervisor, Admin
   - Tabela de usuários com email visível
   - Invite dialog para novos usuários
   - Botão editar acesso (email, reset senha, bloquear)
   - Botão editar hierarquia (FA e KAM)
   - Botão excluir (com reatribuição de subordinados)

2. Tab Cliente especial:
   - CRUD de bases/organizações
   - Upload de logo
   - Atribuir KAM responsável
   - Bloquear/desbloquear base
   - Clientes não podem ser excluídos, apenas bloqueados

3. Edge functions:
   - manage-user-access (update_email, reset_password, toggle_block)
   - delete-user (com reatribuição obrigatória)
   - get-user-emails

4. Audit log para todas as ações administrativas

5. Verificação de bloqueio no AuthContext:
   - Bloquear login se usuário bloqueado
   - Bloquear login se TODAS as organizações do usuário bloqueadas
```

---

## DICAS PARA ECONOMIZAR CRÉDITOS

1. Cole o prompt inicial completo de uma vez
2. Aguarde a criação completa antes de enviar a próxima etapa
3. Use "continue" para prosseguir sem repetir contexto
4. Agrupe correções de bugs em uma única mensagem
5. Seja específico nas correções ("No arquivo X, linha Y, altere Z")

## ASSETS NECESSÁRIOS

Após criar o sistema, faça upload de:
- /public/ibbra-logo.jpeg (logo principal)
- /public/ibbra-logo-pdf.png (logo para PDFs)

