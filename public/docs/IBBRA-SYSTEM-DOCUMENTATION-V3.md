# IBBRA — Documentação Técnica Completa v3.0

> **Última atualização:** Fevereiro 2026
> **Fonte de verdade** para arquitetura, banco de dados, edge functions, UI e lógica de negócio.

---

## Sumário

1. [Identidade e Visão Geral](#1-identidade-e-visão-geral)
2. [Arquitetura Multi-Tenant](#2-arquitetura-multi-tenant)
3. [Banco de Dados](#3-banco-de-dados)
4. [Funções SQL / RPCs](#4-funções-sql--rpcs)
5. [Políticas RLS](#5-políticas-rls)
6. [Edge Functions](#6-edge-functions)
7. [Contextos React](#7-contextos-react)
8. [Hooks Customizados](#8-hooks-customizados)
9. [Serviços](#9-serviços)
10. [Páginas e Rotas](#10-páginas-e-rotas)
11. [Componentes](#11-componentes)
12. [Pipeline de Classificação](#12-pipeline-de-classificação)
13. [Open Finance](#13-open-finance)
14. [Segredos / Variáveis de Ambiente](#14-segredos--variáveis-de-ambiente)
15. [Terminologia Oficial](#15-terminologia-oficial)

---

## 1. Identidade e Visão Geral

### Nome
**IBBRA**

### Propósito
Plataforma institucional de **wealth strategy** e gestão financeira multi-tenant para operações de BPO financeiro de alta renda.

### Stack Tecnológico
| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| UI | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| IA | Google Gemini 2.5 Flash (via Edge Function segura) |
| Autenticação | Supabase Auth |
| Storage | Supabase Storage |
| Estado | TanStack React Query v5 |
| Roteamento | React Router DOM v6 |
| Gráficos | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Open Finance | Pluggy (primário) + Klavi (secundário) |

### Identidade Visual — IBBRA BrandBook

**Paleta Oficial:**
| Cor | Hex | HSL | Uso |
|---|---|---|---|
| Azul Profundo | `#011E41` | `213 80% 13%` | Sidebar, títulos, fundos escuros |
| Azul Highlight | `#005CB9` | `210 100% 36%` | Botões principais, destaques, links |
| Creme Claro | `#EBE1DC` | `18 24% 89%` | Fundos secundários suaves |
| Azul Claro | `#ECF2FA` | `214 58% 95%` | Fundos secundários, cards alternos |
| Vermelho/Coral | `#FF4614` | `14 100% 54%` | Alertas, valores negativos, pendências |
| Branco | `#FFFFFF` | — | Fundo padrão, cards |

**Tipografia:**
- **Títulos (h1, h2, h3):** Playfair Display (serif) — elegante, corporativo
- **Corpo (h4+, texto):** Plus Jakarta Sans (sans-serif) — moderna, limpa
- Hierarquia com letter-spacing negativo para títulos

**Conceito Visual:** Elegante • Sutil • Segura • Objetiva • Racional

**Evitar:** Gradientes, cores fora da paleta, sombras fortes, elementos chamativos.

---

## 2. Arquitetura Multi-Tenant

### Modelo de Organizações (Bases)
Cada cliente opera dentro de uma "Base" (organização) com **isolamento total** de dados via Row Level Security (RLS). Todas as tabelas de negócio possuem coluna `organization_id`.

### Hierarquia de 5 Níveis
| Nível | Role | Responsabilidade |
|---|---|---|
| 1 | `admin` | Gestão total do sistema, acesso a todas as bases |
| 2 | `supervisor` | Validação e qualidade, supervisiona FAs |
| 3 | `fa` | Financial Analyst — classificação de transações |
| 4 | `kam` | Key Account Manager — relacionamento com cliente |
| 5 | `cliente` | Upload de extratos e visualização restrita |

### Regras de Acesso
- **Seleção de base obrigatória** antes de operar (BaseFilterContext)
- Admins veem todas as organizações
- Supervisores veem organizações dos FAs subordinados
- FAs veem organizações atribuídas
- KAMs veem organizações onde são gestores
- Clientes veem apenas sua própria organização

### Sistema de Bloqueio
- Usuários podem ser bloqueados (`profiles.is_blocked`, `blocked_reason`, `blocked_at`)
- Organizações podem ser bloqueadas (`organizations.is_blocked`, `blocked_reason`, `blocked_at`)

---

## 3. Banco de Dados

### 3.1 organizations
Tabela central de organizações (bases/clientes).

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| name | text | — | Nome da organização |
| slug | text | — | Slug único |
| cpf_cnpj | text | null | CPF/CNPJ |
| phone | text | null | Telefone |
| address | text | null | Endereço |
| logo_url | text | null | URL do logo |
| settings | jsonb | '{}' | Configurações |
| kam_id | uuid | null | KAM responsável |
| is_blocked | boolean | false | Bloqueada? |
| blocked_reason | text | null | Motivo do bloqueio |
| blocked_at | timestamptz | null | Data do bloqueio |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.2 profiles
Perfis de usuário (extensão do auth.users).

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | FK auth.users |
| full_name | text | null | Nome completo |
| avatar_url | text | null | Avatar |
| is_blocked | boolean | false | Bloqueado? |
| blocked_reason | text | null | Motivo |
| blocked_at | timestamptz | null | Data |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.3 user_roles
Roles dos usuários (tabela separada para segurança — **nunca no profile**).

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | FK auth.users |
| role | app_role | 'user' | Enum: admin, supervisor, fa, kam, cliente, projetista, user |
| created_at | timestamptz | now() | |

### 3.4 user_hierarchy
Hierarquia de supervisão entre usuários.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Subordinado |
| supervisor_id | uuid | null | Supervisor |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.5 organization_members
Vínculo usuário ↔ organização.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| organization_id | uuid | — | FK organizations |
| user_id | uuid | — | FK auth.users |
| role | app_role | 'cliente' | Role nesta org |
| created_at | timestamptz | now() | |

### 3.6 accounts
Contas financeiras (corrente, poupança, investimento, cartão de crédito, caixa).

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Proprietário |
| organization_id | uuid | null | FK organizations |
| name | text | — | Nome da conta |
| account_type | account_type | 'checking' | Enum: checking, savings, investment, credit_card, cash |
| bank_name | text | null | Banco |
| initial_balance | numeric | 0 | Saldo inicial |
| current_balance | numeric | 0 | Saldo atual (calculado) |
| official_balance | numeric | null | Saldo oficial (API) |
| last_official_balance_at | timestamptz | null | Data do saldo oficial |
| status | account_status | 'active' | Enum: active, inactive |
| color | text | '#3B82F6' | Cor no UI |
| start_date | date | null | Data de início |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.7 categories
Categorias de transação com hierarquia (parent_id) e classificação DRE.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Criador |
| organization_id | uuid | null | FK organizations |
| name | text | — | Nome |
| type | category_type | — | Enum: income, expense, investment, redemption |
| description | text | null | Descrição |
| icon | text | 'folder' | Ícone Lucide |
| color | text | '#6B7280' | Cor |
| parent_id | uuid | null | Categoria pai |
| dre_group | text | null | Grupo DRE |
| expense_classification | text | null | Fixa/Variável |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.8 cost_centers
Centros de custo por organização.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Criador |
| organization_id | uuid | null | FK organizations |
| name | text | — | Nome |
| description | text | null | Descrição |
| is_active | boolean | true | Ativo? |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.9 transactions
Tabela central de transações financeiras.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Criador |
| account_id | uuid | — | FK accounts |
| organization_id | uuid | null | FK organizations |
| category_id | uuid | null | FK categories |
| cost_center_id | uuid | null | FK cost_centers |
| type | transaction_type | — | Enum: income, expense, transfer, investment, redemption |
| amount | numeric | — | Valor absoluto |
| description | text | null | Descrição |
| raw_description | text | null | Descrição original (importação) |
| normalized_description | text | null | Normalizada para matching |
| date | date | — | Data da transação |
| accrual_date | date | null | Data de competência |
| due_date | date | null | Data de vencimento |
| payment_date | date | null | Data de pagamento |
| paid_amount | numeric | null | Valor pago |
| payment_method | text | null | Método de pagamento |
| notes | text | null | Observações |
| status | transaction_status | 'completed' | Enum: pending, completed, cancelled |
| validation_status | validation_status | 'pending_validation' | Enum: pending_validation, validated, rejected, needs_review |
| classification_source | text | null | Fonte: 'rule', 'pattern', 'ai', 'manual' |
| financial_type | text | null | Tipo financeiro |
| is_ignored | boolean | false | Ignorada? (transferências internas) |
| linked_transaction_id | uuid | null | Transação vinculada |
| import_batch_id | uuid | null | FK import_batches |
| bank_connection_id | uuid | null | FK bank_connections |
| external_transaction_id | text | null | ID externo (Open Finance) |
| sync_dedup_key | text | null | Chave de deduplicação |
| transaction_hash | text | null | Hash SHA-256 |
| validated_by | uuid | null | Quem validou |
| validated_at | timestamptz | null | Quando validou |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.10 transfers
Transferências entre contas.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Criador |
| organization_id | uuid | null | FK organizations |
| origin_account_id | uuid | — | FK accounts (origem) |
| destination_account_id | uuid | — | FK accounts (destino) |
| amount | numeric | — | Valor |
| description | text | null | Descrição |
| transfer_date | date | — | Data |
| status | transaction_status | 'completed' | Status |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.11 budgets
Orçamentos mensais por categoria.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Criador |
| organization_id | uuid | null | FK organizations |
| category_id | uuid | — | FK categories |
| cost_center_id | uuid | null | FK cost_centers |
| amount | numeric | — | Valor orçado |
| month | integer | — | Mês (1-12) |
| year | integer | — | Ano |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.12 reconciliation_rules
Regras manuais de conciliação por organização.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Criador |
| organization_id | uuid | — | FK organizations |
| description | text | — | Texto para matching |
| transaction_type | text | 'expense' | Tipo |
| category_id | uuid | null | FK categories |
| cost_center_id | uuid | null | FK cost_centers |
| amount | numeric | — | Valor de referência |
| due_day | integer | null | Dia de vencimento |
| is_active | boolean | true | Ativa? |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.13 transaction_patterns
Padrões aprendidos automaticamente pela validação humana.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| organization_id | uuid | — | FK organizations |
| normalized_description | text | — | Descrição normalizada (chave) |
| transaction_type | text | 'expense' | Tipo |
| category_id | uuid | null | FK categories |
| cost_center_id | uuid | null | FK cost_centers |
| occurrences | integer | 1 | Quantas vezes validado |
| confidence | numeric | 0.5 | Nível de confiança (0-1) |
| avg_amount | numeric | 0 | Valor médio |
| last_used_at | timestamptz | now() | Última utilização |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.14 import_batches
Lotes de importação de extratos (OFX/CSV/PDF).

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Quem importou |
| organization_id | uuid | — | FK organizations |
| account_id | uuid | — | FK accounts |
| file_name | text | — | Nome do arquivo |
| file_path | text | — | Caminho no storage |
| file_type | text | — | Tipo (ofx, csv, pdf) |
| file_size | integer | null | Tamanho em bytes |
| status | import_status | 'pending' | Enum: pending, processing, awaiting_validation, completed, failed, cancelled |
| total_transactions | integer | 0 | Total de transações |
| imported_count | integer | 0 | Importadas com sucesso |
| duplicate_count | integer | 0 | Duplicadas |
| error_count | integer | 0 | Com erro |
| error_message | text | null | Mensagem de erro |
| period_start | date | null | Início do período |
| period_end | date | null | Fim do período |
| metadata | jsonb | '{}' | Metadados extras |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.15 ai_suggestions
Sugestões de classificação da IA.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| transaction_id | uuid | — | FK transactions |
| suggested_category_id | uuid | null | FK categories |
| suggested_cost_center_id | uuid | null | FK cost_centers |
| suggested_type | text | null | Tipo sugerido |
| suggested_competence_date | date | null | Data de competência sugerida |
| confidence_score | numeric | null | Score de confiança |
| reasoning | text | null | Justificativa |
| model_version | text | null | Modelo utilizado |
| was_accepted | boolean | null | Aceita pelo usuário? |
| accepted_by | uuid | null | Quem aceitou |
| accepted_at | timestamptz | null | Quando aceitou |
| created_at | timestamptz | now() | |

### 3.16 audit_log
Log de auditoria imutável para ações administrativas.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | null | Quem executou |
| organization_id | uuid | null | FK organizations |
| table_name | text | — | Tabela afetada |
| record_id | uuid | null | Registro afetado |
| action | text | — | Ação (create, update, delete) |
| old_values | jsonb | null | Valores anteriores |
| new_values | jsonb | null | Novos valores |
| ip_address | inet | null | IP |
| user_agent | text | null | User Agent |
| created_at | timestamptz | now() | |

**Nota:** audit_log não permite UPDATE ou DELETE (políticas RLS bloqueiam).

### 3.17 bank_connections
Conexões bancárias via Open Finance.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Proprietário |
| organization_id | uuid | — | FK organizations |
| provider | text | 'klavi' | Provider (pluggy, klavi) |
| provider_name | text | null | Nome amigável |
| status | text | 'pending' | Status da conexão |
| access_token_encrypted | text | null | Token de acesso (criptografado) |
| refresh_token_encrypted | text | null | Token de refresh |
| token_expires_at | timestamptz | null | Expiração do token |
| external_consent_id | text | null | ID do consentimento |
| external_account_id | text | null | ID externo da conta |
| last_sync_at | timestamptz | null | Última sincronização |
| sync_error | text | null | Erro de sincronização |
| metadata | jsonb | '{}' | Metadados |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.18 open_finance_items
Itens de conexão do Open Finance (Pluggy).

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| organization_id | uuid | — | FK organizations |
| user_id | uuid | — | Quem conectou |
| pluggy_item_id | text | — | ID do item na Pluggy |
| institution_name | text | — | Nome da instituição |
| institution_type | text | null | Tipo (bank, credit_card, etc.) |
| connector_id | text | null | ID do conector Pluggy |
| status | text | 'pending' | Status |
| execution_status | text | null | Status de execução |
| products | jsonb | '[]' | Produtos disponíveis |
| sync_frequency | text | 'daily' | Frequência de sync |
| last_sync_at | timestamptz | null | Última sync |
| next_sync_at | timestamptz | null | Próxima sync |
| consecutive_failures | integer | 0 | Falhas consecutivas |
| error_code | text | null | Código de erro |
| error_message | text | null | Mensagem de erro |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**Constraint:** UNIQUE (organization_id, institution_name)

### 3.19 open_finance_accounts
Contas do Open Finance vinculadas a itens.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| item_id | uuid | — | FK open_finance_items |
| organization_id | uuid | — | FK organizations |
| pluggy_account_id | text | — | ID da conta na Pluggy |
| name | text | — | Nome da conta |
| account_type | text | null | Tipo (BANK, CREDIT) |
| subtype | text | null | Subtipo |
| account_number | text | null | Número da conta |
| balance | numeric | null | Saldo |
| credit_limit | numeric | null | Limite de crédito |
| available_credit | numeric | null | Crédito disponível |
| closing_day | integer | null | Dia de fechamento |
| due_day | integer | null | Dia de vencimento |
| currency_code | text | 'BRL' | Moeda |
| local_account_id | uuid | null | FK accounts (vinculação local) |
| raw_data | jsonb | null | Dados brutos |
| last_sync_at | timestamptz | null | Última sync |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

**Constraint:** UNIQUE (item_id, pluggy_account_id)

### 3.20 open_finance_sync_logs
Logs de sincronização do Open Finance.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| organization_id | uuid | — | FK organizations |
| item_id | uuid | null | FK open_finance_items |
| sync_type | text | — | Tipo de sync |
| status | text | 'started' | Status |
| started_at | timestamptz | now() | Início |
| completed_at | timestamptz | null | Conclusão |
| duration_ms | integer | null | Duração em ms |
| records_fetched | integer | 0 | Registros obtidos |
| records_imported | integer | 0 | Importados |
| records_skipped | integer | 0 | Ignorados |
| records_failed | integer | 0 | Falharam |
| error_message | text | null | Erro |
| error_details | jsonb | null | Detalhes |
| metadata | jsonb | null | Metadados |
| created_at | timestamptz | now() | |

### 3.21 open_finance_raw_data
Dados brutos recebidos do Open Finance.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| organization_id | uuid | — | FK organizations |
| item_id | uuid | null | FK open_finance_items |
| data_type | text | — | Tipo de dado |
| external_id | text | null | ID externo |
| raw_json | jsonb | — | JSON bruto |
| processed | boolean | false | Processado? |
| processed_at | timestamptz | null | Data de processamento |
| processing_error | text | null | Erro |
| created_at | timestamptz | now() | |

### 3.22 sync_audit_logs
Auditoria de sincronizações.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| organization_id | uuid | — | FK organizations |
| bank_connection_id | uuid | null | FK bank_connections |
| sync_date | timestamptz | now() | Data |
| transactions_total | integer | 0 | Total |
| transactions_imported | integer | 0 | Importadas |
| transactions_skipped | integer | 0 | Ignoradas |
| duplicates_detected | integer | 0 | Duplicatas |
| api_balance | numeric | null | Saldo da API |
| system_balance | numeric | null | Saldo do sistema |
| balance_difference | numeric | null | Diferença |
| details | jsonb | '{}' | Detalhes |
| created_at | timestamptz | now() | |

### 3.23 ai_strategic_insights
Insights estratégicos gerados pela IA.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| organization_id | uuid | — | FK organizations |
| period | text | — | Período |
| insights_json | jsonb | — | Insights |
| metrics_json | jsonb | null | Métricas |
| model | text | 'google/gemini-2.5-flash' | Modelo |
| token_usage | integer | null | Tokens usados |
| created_at | timestamptz | now() | |

### 3.24 integration_logs
Logs de integrações externas.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| organization_id | uuid | null | FK organizations |
| bank_connection_id | uuid | null | FK bank_connections |
| provider | text | 'klavi' | Provider |
| event_type | text | — | Tipo de evento |
| status | text | 'info' | Status |
| message | text | null | Mensagem |
| error_details | text | null | Detalhes de erro |
| payload | jsonb | '{}' | Payload |
| ip_address | inet | null | IP |
| user_agent | text | null | User Agent |
| created_at | timestamptz | now() | |

### 3.25 file_imports
Importações de arquivo legado.

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| id | uuid | gen_random_uuid() | PK |
| user_id | uuid | — | Importador |
| account_id | uuid | — | FK accounts |
| file_name | text | — | Nome do arquivo |
| status | text | 'pending' | Status |
| total_rows | integer | 0 | Total |
| imported_rows | integer | 0 | Importadas |
| failed_rows | integer | 0 | Falharam |
| created_at | timestamptz | now() | |

### Enums

```sql
-- Tipos de conta
CREATE TYPE account_type AS ENUM ('checking', 'savings', 'investment', 'credit_card', 'cash');
CREATE TYPE account_status AS ENUM ('active', 'inactive');

-- Roles
CREATE TYPE app_role AS ENUM ('admin', 'user', 'supervisor', 'fa', 'kam', 'cliente', 'projetista');

-- Categorias
CREATE TYPE category_type AS ENUM ('income', 'expense', 'investment', 'redemption');

-- Transações
CREATE TYPE transaction_type AS ENUM ('income', 'expense', 'transfer', 'investment', 'redemption');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE validation_status AS ENUM ('pending_validation', 'validated', 'rejected', 'needs_review');

-- Importação
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'awaiting_validation', 'completed', 'failed', 'cancelled');
```

---

## 4. Funções SQL / RPCs

### Controle de Acesso

| Função | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `get_viewable_organizations` | `_user_id uuid` | `uuid[]` | Retorna IDs das organizações que o usuário pode ver (baseado em role + hierarchy) |
| `can_view_organization` | `_org_id uuid, _viewer_id uuid` | `boolean` | Verifica se o usuário pode ver a organização |
| `can_view_transaction` | `_transaction_org_id uuid, _viewer_id uuid` | `boolean` | Verifica acesso a transação |
| `can_view_profile` | `_profile_user_id uuid, _viewer_id uuid` | `boolean` | Verifica acesso ao perfil |
| `can_manage_org_members` | `_org_id uuid, _user_id uuid` | `boolean` | Verifica se pode gerenciar membros |
| `can_view_user_data` | `_target_user_id uuid, _viewer_id uuid` | `boolean` | Verifica acesso a dados do usuário |
| `has_role` | `_user_id uuid, _role app_role` | `boolean` | Verifica role (SECURITY DEFINER) |
| `get_user_organizations` | `_user_id uuid` | `uuid[]` | Organizações diretas do usuário |
| `get_user_org_ids` | `_user_id uuid` | `uuid[]` | IDs de organizações |
| `get_subordinates` | `_user_id uuid` | `uuid[]` | Subordinados na hierarquia |
| `user_belongs_to_org` | `_org_id uuid, _user_id uuid` | `boolean` | Pertence à organização? |
| `validate_hierarchy_chain` | `_role text, _user_id uuid` | `json` | Valida cadeia hierárquica |

### Negócio

| Função | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `calculate_account_balance` | `account_uuid uuid` | `numeric` | Calcula saldo da conta (initial_balance + SUM(transactions)) |
| `normalize_transaction_description` | `description text` | `text` | Normaliza: lowercase, sem acentos, sem números, sem stopwords |
| `text_similarity` | `text1 text, text2 text` | `numeric` | Similaridade entre textos (0-1) |
| `upsert_transaction_pattern` | `p_normalized_description, p_category_id, p_cost_center_id, p_organization_id, p_transaction_type, p_amount` | `uuid` | Insere ou atualiza padrão de transação |
| `generate_financial_metrics` | `p_organization_id uuid, p_period text` | `json` | Gera métricas financeiras |
| `cleanup_expired_oauth_states` | — | `integer` | Limpa estados OAuth expirados |

---

## 5. Políticas RLS

Todas as tabelas possuem RLS habilitado. Resumo dos padrões:

### Padrão para tabelas com organization_id
- **SELECT:** `organization_id IN (SELECT get_viewable_organizations(auth.uid()))` ou `has_role(auth.uid(), 'admin')`
- **INSERT:** Mesmo filtro + `user_id = auth.uid()`
- **UPDATE/DELETE:** Mesmo filtro de SELECT

### Tabelas especiais
- **audit_log:** SELECT apenas admin. UPDATE e DELETE bloqueados (`USING false`).
- **user_roles:** Somente admin pode INSERT, UPDATE, DELETE.
- **profiles:** Usuário pode ver/editar o próprio. Admin vê todos.
- **ai_suggestions:** Service role pode INSERT. FA+ pode UPDATE.

---

## 6. Edge Functions

### 6.1 generate-ai-analysis
**Gateway seguro para Gemini 2.5 Flash.** Endpoint genérico para análises de IA.
- Valida autenticação (Bearer token)
- Usa `GEMINI_API_KEY` do ambiente
- Aceita: prompt, context, system_instruction, temperature, max_tokens
- Retorna: text, model, token_usage

### 6.2 generate-ai-insights
**Insights estratégicos** para o dashboard. Gera análise qualitativa de métricas financeiras.
- Chama Gemini 2.5 Flash diretamente
- Salva resultado em `ai_strategic_insights`

### 6.3 classify-transaction
**Pipeline de classificação em 3 camadas:**
1. Regras de conciliação (text_similarity ≥ 80%)
2. Padrões aprendidos (confidence ≥ 85%, occurrences ≥ 3)
3. IA Gemini 2.5 Flash (fallback, nunca auto-valida, cap 75%)
- Retorna: category_id, cost_center_id, confidence, source, validation_status

### 6.4 classify-transactions
**Classificação em lote.** Processa múltiplas transações sequencialmente usando o mesmo pipeline.

### 6.5 financial-core-engine
**Motor de processamento Open Finance.** Processa dados brutos do Pluggy:
- Deduplicação de transações
- Classificação por creditDebitType
- Criação de transações locais
- Atualização de saldos

### 6.6 process-import
**Importação de extratos.** Parse e processamento de arquivos OFX, CSV e PDF:
- Validação de formato
- Hash SHA-256 para deduplicação
- Inserção em lote
- Classificação automática pós-importação

### 6.7 pluggy-connect
**Conexão Pluggy.** Gerencia criação de access tokens e itens do Pluggy.

### 6.8 pluggy-sync
**Sincronização Pluggy.** Busca transações e saldos via API Pluggy e alimenta o financial-core-engine.

### 6.9 pluggy-webhook
**Webhook Pluggy.** Recebe notificações de atualização de itens.

### 6.10 klavi-authorize
**Autorização Klavi.** Inicia fluxo OAuth com Klavi.

### 6.11 klavi-exchange-token
**Troca de token Klavi.** Troca código de autorização por access token.

### 6.12 klavi-sync
**Sincronização Klavi.** Busca dados bancários via API Klavi.

### 6.13 klavi-disconnect
**Desconexão Klavi.** Revoga consentimento e limpa dados.

### 6.14 klavi-webhook
**Webhook Klavi.** Recebe notificações da Klavi.

### 6.15 seed-categories
**Sementes de categorias.** Cria categorias padrão para uma organização (receitas, despesas, investimentos).

### 6.16 seed-reconciliation-rules
**Sementes de regras.** Cria regras de conciliação padrão.

### 6.17 manage-user-access
**Gestão de acesso.** Convida, atualiza role e bloqueia/desbloqueia usuários.

### 6.18 delete-user
**Exclusão de usuário.** Remove usuário do sistema (cascata controlada).

### 6.19 get-user-emails
**Consulta de emails.** Busca emails de usuários pelo ID (via admin API).

---

## 7. Contextos React

### AuthContext
Gerencia autenticação Supabase: login, logout, sessão, recuperação de senha.

### ThemeContext
Controla modo claro/escuro. Persiste no localStorage.

### BaseFilterContext
**Seleção de base obrigatória.** Mantém a organização ativa selecionada pelo usuário. Todas as queries filtram por esta base.

### ValuesVisibilityContext
Controle de visibilidade de valores monetários (botão "olho" para ocultar valores).

---

## 8. Hooks Customizados

| Hook | Descrição |
|---|---|
| `useAccounts` | CRUD de contas financeiras filtrado por base |
| `useAIClassification` | Classificação de transações via IA |
| `useAuditLog` | Consulta e registro de auditoria |
| `useAutoIgnoreTransfers` | Ignora automaticamente transações espelhadas de transferências |
| `useBankConnections` | CRUD de conexões bancárias |
| `useBudgetAnalysis` | Análise orçamentária (realizado vs orçado) |
| `useBudgets` | CRUD de orçamentos |
| `useCashFlowReport` | Dados para relatório de fluxo de caixa |
| `useCategories` | CRUD de categorias filtrado por base |
| `useCategoryAnalysisReport` | Análise por categoria |
| `useClearReconciliationRules` | Limpa regras de conciliação |
| `useCostCenters` | CRUD de centros de custo |
| `useCreditCardAdvancedSummary` | Resumo avançado de cartões |
| `useCreditCardDetails` | Detalhes de um cartão específico |
| `useCreditCardSummary` | Resumo de cartões de crédito |
| `useDREReport` | Dados para DRE |
| `useDailyEvolution` | Evolução diária de saldos |
| `useDashboardStats` | Estatísticas do dashboard (Posição Financeira, Entradas, Saídas, Evolução) |
| `useFileImports` | Consulta importações de arquivo |
| `useFinancialTypeReport` | Relatório por tipo financeiro |
| `useImportBatches` | CRUD de lotes de importação |
| `useMonthlyEvolution` | Evolução mensal |
| `useOrganizations` | CRUD de organizações |
| `usePendingTransactionsCount` | Contagem de transações pendentes |
| `useReconciliationMetrics` | Métricas de conciliação |
| `useReconciliationRules` | CRUD de regras de conciliação |
| `useReportsData` | Dados genéricos de relatórios |
| `useSeedCategories` | Trigger para semear categorias |
| `useSeedReconciliationRules` | Trigger para semear regras |
| `useStrategicInsights` | Insights estratégicos da IA |
| `useToggleIgnore` | Toggle de is_ignored em transações |
| `useTransactionPatterns` | Consulta padrões aprendidos |
| `useTransactionPatternsAdmin` | Gestão admin de padrões |
| `useTransactions` | CRUD de transações com filtros |
| `useTransfers` | CRUD de transferências |
| `useUserEmails` | Consulta emails de usuários |
| `useUserHierarchy` | Gestão de hierarquia |
| `useUserRoles` | Consulta de roles (inclui useIsAdmin) |
| `use-mobile` | Detecção de viewport mobile |
| `use-toast` | Sistema de notificações toast |

---

## 9. Serviços

### aiService.ts
Camada de abstração para chamadas de IA. Nenhuma chave de API exposta no frontend.

**Funções:**
- `callAIAnalysis(request)` — Chamada genérica à Edge Function `generate-ai-analysis`
- `classifyTransactionWithAI(request)` — Classificação de transação:
  - Monta prompt com categorias e centros de custo disponíveis
  - Envia para Gemini 2.5 Flash via Edge Function
  - Parseia resposta JSON
  - Valida IDs retornados contra categorias existentes
  - Cap de confiança em 75% (IA nunca auto-valida)
  - is_transfer sempre false

---

## 10. Páginas e Rotas

| Rota | Página | Descrição |
|---|---|---|
| `/` | Index | Dashboard — Consolidação Patrimonial |
| `/auth` | Auth | Login / Registro |
| `/admin` | Admin | Painel administrativo |
| `/extrato` | Extrato | Extrato bancário |
| `/transacoes` | Transacoes | Lista de transações |
| `/receitas` | Receitas | Entradas financeiras |
| `/despesas` | Despesas | Saídas financeiras |
| `/movimentacoes` | Movimentacoes | Movimentações gerais |
| `/cadastros` | Cadastros | Cadastros (contas, categorias, centros de custo, regras) |
| `/contas` | Contas | Gestão de contas |
| `/categorias` | Categorias | Gestão de categorias |
| `/centros-custo` | CentrosCusto | Gestão de centros de custo |
| `/regras-conciliacao` | RegrasConciliacao | Regras de conciliação |
| `/orcamentos` | Orcamentos | Gestão de orçamentos |
| `/pendencias` | Pendencias | Transações pendentes de validação |
| `/analise-orcamento` | AnaliseOrcamento | Análise orçamentária |
| `/relatorios` | Relatorios | Hub de relatórios |
| `/dre` | RelatorioDRE | DRE — Demonstrativo de Resultados |
| `/demonstrativo-financeiro` | DemonstrativoFinanceiro | Demonstrativo financeiro |
| `/fluxo-caixa` | RelatorioFluxoCaixa | Fluxo de caixa |
| `/importacoes` | Importacoes | Importação de extratos |
| `/perfil` | Perfil | Perfil do usuário |
| `/padroes-aprendidos` | PadroesAprendidos | Padrões aprendidos (admin) |
| `/documentacao` | Documentacao | Documentação do sistema |
| `/open-finance` | OpenFinance | Gestão de conexões Open Finance |
| `/callback-klavi` | CallbackKlavi | Callback OAuth Klavi |
| `/cartoes` | CartoesCredito | Lista de cartões de crédito |
| `/cartao/:accountId` | CartaoCredito | Detalhes de cartão específico |
| `/open-finance-monitor` | OpenFinanceMonitor | Monitor de Open Finance |
| `*` | NotFound | 404 |

---

## 11. Componentes

### Layout
- `AppLayout` — Layout principal com sidebar
- `AppHeader` — Header com seleção de base e controles
- `AppSidebar` — Sidebar azul escuro IBBRA
- `BaseSelector` / `BaseSelectorEnhanced` — Seletor de base
- `InsightsHeaderButton` — Botão de insights no header

### Dashboard
- `StatCard` / `StatCardHoverTransactions` — Cards de métricas (Posição Financeira, Entradas, Saídas, Evolução)
- `ConsolidatedBalanceSection` — Seção de saldo consolidado
- `AccountBalancesSection` — Saldos por conta
- `ConnectedAccountsSection` — Contas Open Finance
- `CreditCardSummary` / `CreditCardsAdvancedSummary` — Resumo de cartões
- `MonthlyEvolutionChart` — Gráfico de evolução mensal
- `CategoryDonutChart` — Gráfico de categorias
- `RecentTransactions` — Transações recentes
- `FintechTransactionsList` — Transações Open Finance
- `ReconciliationMetricsCard` — Métricas de conciliação
- `StrategicInsightsCard` — Card de insights IA
- `BudgetProgress` — Progresso orçamentário
- `TransactionsDetailModal` — Modal de detalhes

### Admin
- `ClientManagementTab` — Gestão de clientes
- `UsersByRoleTab` — Usuários por role
- `InviteUserDialog` — Convite de usuários
- `EditUserAccessDialog` — Edição de acesso
- `EditUserHierarchyDialog` — Edição de hierarquia
- `DeleteUserDialog` — Exclusão de usuário
- `HierarchyManager` — Visualização de hierarquia
- `SettingsDialog` — Configurações
- `OrganizationBlockManager` — Bloqueio de organizações
- `OrganizationKamManager` — Gestão de KAMs

### IA
- `AIAssistantChat` — Chat com assistente IA

### Budget
- `BudgetAlerts` — Alertas de orçamento
- `BudgetAnalysisCard` — Card de análise
- `BudgetVsActualChart` — Gráfico orçado vs realizado

### Categorias
- `CategoriesDialog` — CRUD de categorias
- `DeleteCategoryDialog` — Exclusão

### Centros de Custo
- `CostCenterDialog` — CRUD de centros de custo

### Importação
- `ExtractUploader` — Upload de extratos
- `ImportBatchList` — Lista de lotes
- `ImportCard` — Card de importação
- `ImportExtractDialog` — Dialog de importação

### Open Finance
- `BankConnectionsManager` — Gestão de conexões

### Organizações
- `AddMemberDialog` — Adicionar membro

### Relatórios
- `PeriodSelector` — Seletor de período
- `ExtratoContent` — Conteúdo do extrato
- `DREContent` — Conteúdo DRE
- `FluxoCaixaContent` — Conteúdo fluxo de caixa
- `DemonstrativoContent` — Conteúdo demonstrativo
- `CategoryAnalysisContent` — Análise por categoria
- `AnaliseOrcamentoContent` — Análise orçamentária
- `FinancialTypeReportContent` — Relatório por tipo
- `MovimentacoesReportContent` — Relatório de movimentações
- `FinancialStatementReport` — Relatório financeiro

### Regras
- `RuleDialog` — CRUD de regras de conciliação

### Transações
- `TransactionDialog` — CRUD de transações

### Transferências
- `TransferDialog` — CRUD de transferências

### Contas
- `AccountDialog` — CRUD de contas

### Common
- `BaseRequiredAlert` — Alerta de base obrigatória
- `BaseSelectionDialog` — Dialog de seleção de base

### UI (shadcn/ui)
Componentes shadcn/ui completos: accordion, alert, avatar, badge, button, calendar, card, chart, checkbox, command, dialog, dropdown-menu, form, input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider, switch, table, tabs, textarea, toast, toggle, tooltip, etc.

---

## 12. Pipeline de Classificação

### Fluxo Completo

```
Transação Nova
    │
    ▼
[1] NORMALIZAÇÃO
    │ lowercase, sem acentos, sem números, sem stopwords
    ▼
[2] REGRAS DE CONCILIAÇÃO
    │ text_similarity(normalized, rule.description) ≥ 80%
    │ → classification_source = 'rule'
    │ → validation_status = 'validated' (AUTO-VALIDADO)
    ▼ (se não match)
[3] PADRÕES APRENDIDOS
    │ confidence ≥ 85% + occurrences ≥ 3
    │ → classification_source = 'pattern'
    │ → validation_status = 'validated' (AUTO-VALIDADO)
    ▼ (se não match)
[4] IA GEMINI 2.5 FLASH (Fallback)
    │ → classification_source = 'ai'
    │ → confidence cap = 75%
    │ → validation_status = 'pending_validation' (NUNCA auto-valida)
    │ → Vai para /pendencias
    ▼
[APRENDIZADO]
    Cada validação humana → upsert_transaction_pattern()
    Incrementa occurrences, recalcula avg_amount, aumenta confidence
```

### Regras de Negócio
- IA **nunca** auto-valida transações
- Confiança da IA é limitada a 75%
- is_transfer da IA é sempre false
- Regras e padrões podem auto-validar
- Cada validação humana alimenta o aprendizado contínuo

---

## 13. Open Finance

### Pluggy (Integração Primária)
- Widget de conexão via popup (evita restrições de iframe)
- Pipeline: pluggy-connect → pluggy-sync → financial-core-engine
- Deduplicação por sync_dedup_key
- Classificação automática por creditDebitType (contas correntes) e padrões de descrição (cartões)
- Transações espelhadas no mesmo dia e conta são ignoradas automaticamente

### Klavi (Integração Secundária)
- Fluxo OAuth: klavi-authorize → klavi-exchange-token
- Sincronização via klavi-sync
- Webhook para notificações

### Tabelas do Pipeline
1. `open_finance_items` — Conexões/itens
2. `open_finance_accounts` — Contas sincronizadas
3. `open_finance_sync_logs` — Logs de sync
4. `open_finance_raw_data` — Dados brutos
5. `sync_audit_logs` — Auditoria de sync

### Monitor
Rota `/open-finance-monitor` para acompanhamento em tempo real de conexões e logs.

### Regra de Saldo Disponível (Posição Financeira)
O cálculo do "Posição Financeira" no dashboard consolida **apenas contas correntes**:
- **Excluídas:** contas de investimento, cartões de crédito, contas Open Finance sem vínculo local (local_account_id nulo)
- Cada conta corrente sob Open Finance deve ter sua própria conta local vinculada

---

## 14. Segredos / Variáveis de Ambiente

| Variável | Uso | Onde |
|---|---|---|
| `GEMINI_API_KEY` | API Key do Google Gemini 2.5 Flash | Edge Functions |
| `PLUGGY_CLIENT_ID` | Client ID da Pluggy | Edge Functions |
| `PLUGGY_CLIENT_SECRET` | Client Secret da Pluggy | Edge Functions |
| `SUPABASE_URL` | URL do projeto Supabase | Auto-configurado |
| `SUPABASE_ANON_KEY` | Chave anônima | Auto-configurado |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service role | Auto-configurado |

**Importante:** Nenhuma chave de API é exposta no frontend. Toda comunicação com APIs externas passa por Edge Functions.

---

## 15. Terminologia Oficial

O sistema utiliza terminologia corporativa institucional:

| Termo Antigo | Termo IBBRA |
|---|---|
| Saldo | **Posição Financeira** |
| Resumo / Dashboard | **Consolidação Patrimonial** |
| Receitas | **Entradas Financeiras** |
| Despesas | **Saídas Financeiras** |
| Saldo do Mês | **Evolução Patrimonial** |
| Patrimônio Total | **Consolidação Patrimonial** |

---

## Apêndice: Configuração supabase/config.toml

Todas as 19 Edge Functions estão registradas com `verify_jwt = false` (autenticação gerenciada internamente):

```toml
project_id = "umqehhhpedwqdfjmdjqv"

[functions.pluggy-connect]
verify_jwt = false

[functions.pluggy-sync]
verify_jwt = false

[functions.pluggy-webhook]
verify_jwt = false

[functions.classify-transaction]
verify_jwt = false

[functions.classify-transactions]
verify_jwt = false

[functions.delete-user]
verify_jwt = false

[functions.generate-ai-insights]
verify_jwt = false

[functions.get-user-emails]
verify_jwt = false

[functions.klavi-authorize]
verify_jwt = false

[functions.klavi-disconnect]
verify_jwt = false

[functions.klavi-exchange-token]
verify_jwt = false

[functions.klavi-sync]
verify_jwt = false

[functions.klavi-webhook]
verify_jwt = false

[functions.manage-user-access]
verify_jwt = false

[functions.process-import]
verify_jwt = false

[functions.seed-categories]
verify_jwt = false

[functions.seed-reconciliation-rules]
verify_jwt = false

[functions.financial-core-engine]
verify_jwt = false

[functions.generate-ai-analysis]
verify_jwt = false
```

---

*Documento gerado automaticamente — IBBRA v3.0 — Fevereiro 2026*
