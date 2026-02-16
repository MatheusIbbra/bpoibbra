# IBBRA — Documentação Técnica Completa v4.0

> **Última atualização:** 16 de Fevereiro de 2026
> **Fonte de verdade** para arquitetura, banco de dados, edge functions, UI, lógica de negócio e layout do dashboard.

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
12. [Dashboard — Layout e Lógica](#12-dashboard--layout-e-lógica)
13. [Pipeline de Classificação](#13-pipeline-de-classificação)
14. [Open Finance](#14-open-finance)
15. [Segredos / Variáveis de Ambiente](#15-segredos--variáveis-de-ambiente)
16. [Terminologia Oficial](#16-terminologia-oficial)
17. [Configuração supabase/config.toml](#17-configuração-supabaseconfig-toml)

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
| Backend | Supabase (PostgreSQL + Edge Functions) via Lovable Cloud |
| IA | Google Gemini 2.5 Flash (via Edge Function segura) |
| Autenticação | Supabase Auth |
| Storage | Supabase Storage |
| Estado | TanStack React Query v5 |
| Roteamento | React Router DOM v6 |
| Gráficos | Recharts |
| PDF | jsPDF + jspdf-autotable |
| Open Finance | Pluggy (primário) + Klavi (secundário) |
| PWA | vite-plugin-pwa |

### Identidade Visual — IBBRA BrandBook

**Paleta Oficial (HSL):**
| Cor | Hex | HSL | CSS Variable | Uso |
|---|---|---|---|---|
| Azul Profundo | `#011E41` | `213 80% 13%` | `--brand-deep` | Sidebar, títulos, fundos escuros |
| Azul Highlight | `#005CB9` | `210 100% 36%` | `--brand-highlight` | Botões principais, destaques, links |
| Creme Claro | `#EBE1DC` | `18 24% 89%` | `--brand-cream` | Fundos secundários suaves |
| Creme Sofisticado | `#CEC3BE` | `18 14% 77%` | `--brand-cream-deep` | Variante de creme |
| Azul Claro | `#ECF2FA` | `214 58% 95%` | `--brand-light-blue` | Fundos secundários, cards alternos |
| Vermelho/Coral | `#FF4614` | `14 100% 54%` | `--brand-coral` | Alertas, valores negativos, pendências |
| Branco | `#FFFFFF` | — | — | Fundo padrão, cards |

**Tokens Semânticos (index.css):**
| Token | HSL Light | Uso |
|---|---|---|
| `--background` | `30 15% 98%` | Fundo principal (warm off-white) |
| `--foreground` | `213 80% 13%` | Texto principal |
| `--primary` | `213 80% 13%` | Cor primária |
| `--accent` | `210 100% 36%` | Cor de destaque |
| `--destructive` | `14 100% 54%` | Erros e alertas |
| `--success` | `160 60% 36%` | Positivo |
| `--warning` | `38 92% 50%` | Atenção |
| `--info` | `210 100% 36%` | Informativo |
| `--muted` | `220 12% 95%` | Neutros refinados |
| `--sidebar-background` | `213 80% 13%` | Fundo sidebar |

**Tipografia:**
- **Títulos (h1, h2, h3):** Playfair Display (serif) — elegante, corporativo
- **Corpo (h4+, texto):** Plus Jakarta Sans (sans-serif) — moderna, limpa
- Letter-spacing negativo para títulos (-0.03em, -0.025em, -0.02em)

**Conceito Visual:** Elegante • Sutil • Segura • Objetiva • Racional

**EVITAR:** Gradientes, cores fora da paleta, sombras fortes, elementos chamativos, cores hardcoded em componentes (usar tokens semânticos).

---

## 2. Arquitetura Multi-Tenant

### Modelo de Organizações (Bases)
Cada cliente opera dentro de uma "Base" (organização) com **isolamento total** de dados via Row Level Security (RLS). Todas as tabelas de negócio possuem coluna `organization_id`.

### Hierarquia de 7 Roles
| Nível | Role | Responsabilidade |
|---|---|---|
| 1 | `admin` | Gestão total do sistema, acesso a todas as bases |
| 2 | `supervisor` | Validação e qualidade, supervisiona FAs |
| 3 | `fa` | Financial Analyst — classificação de transações |
| 4 | `kam` | Key Account Manager — relacionamento com cliente |
| 5 | `cliente` | Upload de extratos e visualização restrita |
| 6 | `projetista` | Acesso de projeto |
| 7 | `user` | Usuário padrão |

### Regras de Acesso
- **Seleção de base obrigatória** antes de operar (BaseFilterContext)
- Admins veem todas as organizações
- Supervisores veem organizações dos FAs subordinados
- FAs veem organizações atribuídas
- KAMs veem organizações onde são gestores
- Clientes veem apenas sua própria organização

### Sistema de Bloqueio
- Usuários: `profiles.is_blocked`, `blocked_reason`, `blocked_at`
- Organizações: `organizations.is_blocked`, `blocked_reason`, `blocked_at`

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
| base_currency | text | 'BRL' | Moeda base |
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
| currency_code | text | 'BRL' | Moeda |
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
Tabela central de transações financeiras (30+ colunas).

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
| is_anomaly | boolean | null | Anomalia detectada? |
| anomaly_score | numeric | null | Score de anomalia |
| linked_transaction_id | uuid | null | Transação vinculada |
| import_batch_id | uuid | null | FK import_batches |
| bank_connection_id | uuid | null | FK bank_connections |
| external_transaction_id | text | null | ID externo (Open Finance) |
| sync_dedup_key | text | null | Chave de deduplicação |
| transaction_hash | text | null | Hash SHA-256 |
| converted_amount | numeric | null | Valor convertido |
| exchange_rate_used | numeric | null | Taxa de câmbio usada |
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

**Nota:** audit_log não permite UPDATE ou DELETE (políticas RLS bloqueiam com `USING false`).

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

### 3.25 file_imports (legado)
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

### 3.26 Tabelas adicionais
- **account_balance_snapshots** — Snapshots de saldo por conta (service role + users read)
- **cashflow_forecasts** — Previsões de fluxo de caixa
- **exchange_rates** — Taxas de câmbio
- **financial_simulations** — Simulações financeiras
- **organization_subscriptions** — Assinaturas (com Stripe)
- **plans** — Planos disponíveis
- **recurring_expenses** — Despesas recorrentes detectadas
- **transaction_comments** — Comentários em transações
- **api_usage_logs** — Logs de uso de API

### Enums

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

---

## 4. Funções SQL / RPCs

### Controle de Acesso (SECURITY DEFINER)

| Função | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `has_role` | `_user_id uuid, _role app_role` | `boolean` | Verifica role sem recursão RLS |
| `get_viewable_organizations` | `_user_id uuid` | `uuid[]` | Organizações visíveis (role + hierarchy) |
| `can_view_organization` | `_org_id uuid, _viewer_id uuid` | `boolean` | Pode ver organização? |
| `can_view_transaction` | `_transaction_org_id uuid, _viewer_id uuid` | `boolean` | Pode ver transação? |
| `can_view_profile` | `_profile_user_id uuid, _viewer_id uuid` | `boolean` | Pode ver perfil? |
| `can_manage_org_members` | `_org_id uuid, _user_id uuid` | `boolean` | Pode gerenciar membros? |
| `can_view_user_data` | `_target_user_id uuid, _viewer_id uuid` | `boolean` | Pode ver dados do user? |
| `get_user_organizations` | `_user_id uuid` | `uuid[]` | Organizações diretas |
| `get_user_org_ids` | `_user_id uuid` | `uuid[]` | IDs de organizações |
| `get_subordinates` | `_user_id uuid` | `uuid[]` | Subordinados hierárquicos |
| `user_belongs_to_org` | `_org_id uuid, _user_id uuid` | `boolean` | Pertence à org? |
| `validate_hierarchy_chain` | `_role text, _user_id uuid` | `json` | Valida cadeia hierárquica |

### Negócio

| Função | Parâmetros | Retorno | Descrição |
|---|---|---|---|
| `calculate_account_balance` | `account_uuid uuid` | `numeric` | initial_balance + SUM(income) - SUM(expense) + SUM(redemption) - SUM(investment) |
| `normalize_transaction_description` | `description text` | `text` | lowercase, sem acentos, sem números, sem stopwords |
| `text_similarity` | `text1 text, text2 text` | `numeric` | Similaridade (0-1) via pg_trgm |
| `upsert_transaction_pattern` | `p_normalized_description, p_category_id, p_cost_center_id, p_organization_id, p_transaction_type, p_amount` | `uuid` | Insert ou update de padrão |
| `generate_financial_metrics` | `p_organization_id uuid, p_period text` | `json` | Métricas financeiras |
| `generate_financial_health_score` | `p_organization_id uuid` | `json` | Score de saúde financeira (retorna NULL se sem dados) |
| `generate_cashflow_forecast` | `p_organization_id uuid, p_days integer` | `json` | Previsão de fluxo de caixa |
| `detect_recurring_expenses` | `p_organization_id uuid` | `json` | Detecta despesas recorrentes |
| `get_consolidated_balance` | `p_organization_id uuid, p_target_currency text` | `json` | Saldo consolidado multimoeda |
| `convert_currency` | `p_amount numeric, p_from_currency text, p_to_currency text, p_rate_date text` | `numeric` | Conversão de moeda |
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
- **profiles:** Usuário pode ver/editar o próprio. Admin vê todos. Ninguém deleta.
- **ai_suggestions:** Service role pode INSERT. FA+ pode UPDATE. Ninguém deleta.
- **organizations:** Admin pode INSERT. Membros e admin podem UPDATE. Ninguém deleta.

---

## 6. Edge Functions (19 total)

### IA
| Função | Descrição |
|---|---|
| `generate-ai-analysis` | Gateway seguro para Gemini 2.5 Flash (genérico) |
| `generate-ai-insights` | Insights estratégicos para o dashboard |
| `classify-transaction` | Pipeline de classificação em 3 camadas |
| `classify-transactions` | Classificação em lote |

### Open Finance — Pluggy
| Função | Descrição |
|---|---|
| `pluggy-connect` | Gera access token e abre widget |
| `pluggy-sync` | Busca contas e transações |
| `pluggy-webhook` | Recebe notificações de item |
| `financial-core-engine` | Processa dados brutos (dedup, classificação, criação) |

### Open Finance — Klavi
| Função | Descrição |
|---|---|
| `klavi-authorize` | Inicia fluxo OAuth |
| `klavi-exchange-token` | Troca código por token |
| `klavi-sync` | Sincroniza dados |
| `klavi-disconnect` | Revoga consentimento |
| `klavi-webhook` | Recebe notificações |

### Gestão
| Função | Descrição |
|---|---|
| `manage-user-access` | Convite, update role, block/unblock |
| `delete-user` | Exclusão com cascata controlada |
| `get-user-emails` | Consulta emails (admin API) |
| `seed-categories` | Categorias iniciais para nova org |
| `seed-reconciliation-rules` | Regras iniciais para nova org |
| `process-import` | Parse e importação de extratos (OFX/CSV/PDF) |

**Configuração:** Todas com `verify_jwt = false` (autenticação gerenciada internamente via Authorization header).

---

## 7. Contextos React (4)

| Contexto | Descrição |
|---|---|
| **AuthContext** | Login, logout, sessão, recuperação de senha |
| **ThemeContext** | Modo claro/escuro, persiste no localStorage |
| **BaseFilterContext** | Seleção de base obrigatória (organization_id) — todas as queries filtram por esta base |
| **ValuesVisibilityContext** | Ocultar/mostrar valores monetários (botão "olho") |

---

## 8. Hooks Customizados (40+)

| Hook | Descrição |
|---|---|
| `useAccounts` | CRUD de contas financeiras filtrado por base |
| `useAIClassification` | Classificação de transações via IA |
| `useAuditLog` | Consulta e registro de auditoria |
| `useAutoIgnoreTransfers` | Ignora automaticamente transações espelhadas |
| `useBankConnections` | CRUD de conexões bancárias |
| `useBudgetAnalysis` | Análise orçamentária (realizado vs orçado) |
| `useBudgets` | CRUD de orçamentos |
| `useCashFlowReport` | Dados para relatório de fluxo de caixa |
| `useCashflowForecast` | Previsão de fluxo de caixa |
| `useCategories` | CRUD de categorias filtrado por base |
| `useCategoryAnalysisReport` | Análise por categoria |
| `useClearReconciliationRules` | Limpa regras de conciliação |
| `useConsolidatedBalance` | Saldo consolidado |
| `useCostCenters` | CRUD de centros de custo |
| `useCreditCardAdvancedSummary` | Resumo avançado de cartões |
| `useCreditCardDetails` | Detalhes de um cartão |
| `useCreditCardSummary` | Resumo de cartões |
| `useDREReport` | Dados para DRE |
| `useDailyEvolution` | Evolução diária de saldos |
| `useDashboardStats` | Estatísticas do dashboard |
| `useFileImports` | Consulta importações legado |
| `useFinancialHealthScore` | Score de saúde financeira |
| `useFinancialSimulator` | Simulador financeiro |
| `useFinancialTypeReport` | Relatório por tipo financeiro |
| `useImportBatches` | CRUD de lotes de importação |
| `useMonthlyEvolution` | Evolução mensal |
| `useOrganizations` | CRUD de organizações |
| `usePendingTransactionsCount` | Contagem de pendências |
| `usePlanLimits` | Limites do plano |
| `useReconciliationMetrics` | Métricas de conciliação |
| `useReconciliationRules` | CRUD de regras de conciliação |
| `useRecurringExpenses` | Despesas recorrentes |
| `useReportsData` | Dados genéricos de relatórios |
| `useSeedCategories` | Trigger para semear categorias |
| `useSeedReconciliationRules` | Trigger para semear regras |
| `useStrategicInsights` | Insights estratégicos da IA |
| `useSubscription` | Assinatura da organização |
| `useToggleIgnore` | Toggle de is_ignored |
| `useTransactionComments` | Comentários em transações |
| `useTransactionPatterns` | Consulta padrões |
| `useTransactionPatternsAdmin` | Gestão admin de padrões |
| `useTransactions` | CRUD de transações com filtros |
| `useTransfers` | CRUD de transferências |
| `useUserEmails` | Consulta emails |
| `useUserHierarchy` | Gestão de hierarquia |
| `useUserRoles` | Roles (inclui useIsAdmin) |
| `use-mobile` | Detecção de viewport mobile |
| `use-toast` | Notificações toast |

---

## 9. Serviços

### aiService.ts
Camada de abstração para chamadas de IA. **Nenhuma chave de API exposta no frontend.**

- `callAIAnalysis(request)` — Chamada genérica à Edge Function `generate-ai-analysis`
- `classifyTransactionWithAI(request)` — Classificação de transação:
  - Monta prompt com categorias e centros de custo
  - Envia para Gemini 2.5 Flash via Edge Function
  - Parseia resposta JSON
  - Valida IDs contra categorias existentes
  - Cap de confiança em 75%
  - is_transfer sempre false

### Utilitários
- `formatters.ts` — Formatação de moeda, data, porcentagem
- `category-icons.ts` — Mapeamento de ícones Lucide para categorias
- `legacy-initial-balance.ts` — Migração de saldo inicial legado
- `pdf-generator.ts` — Geração de PDFs com jsPDF + jspdf-autotable
- `utils.ts` — Utilidades (cn, etc.)

---

## 10. Páginas e Rotas (30)

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
| `/cadastros` | Cadastros | Hub de cadastros |
| `/contas` | Contas | Gestão de contas |
| `/categorias` | Categorias | Gestão de categorias |
| `/centros-custo` | CentrosCusto | Gestão de centros de custo |
| `/regras-conciliacao` | RegrasConciliacao | Regras de conciliação |
| `/orcamentos` | Orcamentos | Gestão de orçamentos |
| `/pendencias` | Pendencias | Transações pendentes de validação |
| `/analise-orcamento` | AnaliseOrcamento | Análise orçamentária |
| `/relatorios` | Relatorios | Hub de relatórios |
| `/dre` | RelatorioDRE | DRE |
| `/demonstrativo-financeiro` | DemonstrativoFinanceiro | Demonstrativo financeiro |
| `/fluxo-caixa` | RelatorioFluxoCaixa | Fluxo de caixa |
| `/importacoes` | Importacoes | Importação de extratos |
| `/perfil` | Perfil | Perfil do usuário |
| `/padroes-aprendidos` | PadroesAprendidos | Padrões aprendidos (admin) |
| `/documentacao` | Documentacao | Documentação do sistema |
| `/open-finance` | OpenFinance | Gestão de conexões |
| `/callback-klavi` | CallbackKlavi | Callback OAuth Klavi |
| `/cartoes` | CartoesCredito | Lista de cartões |
| `/cartao/:accountId` | CartaoCredito | Detalhes do cartão |
| `/open-finance-monitor` | OpenFinanceMonitor | Monitor Open Finance |
| `*` | NotFound | 404 |

**Lazy Loading:** Todas as páginas exceto Index, Auth e NotFound usam `React.lazy()` com Suspense.

---

## 11. Componentes

### Layout
- `AppLayout` — Layout principal com sidebar
- `AppHeader` — Header com seleção de base e controles
- `AppSidebar` — Sidebar azul escuro IBBRA com gradiente
- `BaseSelector` / `BaseSelectorEnhanced` — Seletor de base
- `BrandBackground` — Background branded
- `InsightsHeaderButton` — Botão de insights no header

### Dashboard
- `StatCard` / `StatCardHoverTransactions` — Cards de métricas do topo
- `CategoryDonutChart` — Gráfico de categorias (donut)
- `MonthlyEvolutionChart` — Gráfico de evolução mensal
- `FinancialHealthCard` — Score de saúde financeira
- `BudgetProgress` — Progresso orçamentário (Orçamentos do Mês)
- `FintechTransactionsList` — Últimas Movimentações (minimalista)
- `RecurringExpensesCard` — Despesas recorrentes
- `CashflowForecastCard` — Previsão de caixa
- `FinancialSimulatorCard` — Simulador financeiro
- `ReconciliationMetricsCard` — Métricas de conciliação
- `ConnectedAccountsSection` — Contas conectadas Open Finance
- `MultiCurrencyBalanceSection` — Saldo multimoeda
- `StrategicInsightsCard` — Insights IA
- `CreditCardSummary` / `CreditCardsAdvancedSummary` — Resumo cartões
- `ConsolidatedBalanceSection` — Saldo consolidado
- `AccountBalancesSection` — Saldos por conta
- `RecentTransactions` — Transações recentes
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

### Categorias / Centros de Custo / Contas
- `CategoriesDialog`, `DeleteCategoryDialog`
- `CostCenterDialog`
- `AccountDialog`

### Importação
- `ExtractUploader`, `ImportBatchList`, `ImportCard`, `ImportExtractDialog`

### Open Finance
- `BankConnectionsManager`

### Relatórios
- `PeriodSelector`, `ExtratoContent`, `DREContent`, `FluxoCaixaContent`, `DemonstrativoContent`, `CategoryAnalysisContent`, `AnaliseOrcamentoContent`, `FinancialTypeReportContent`, `MovimentacoesReportContent`, `FinancialStatementReport`

### Transações / Transferências / Regras
- `TransactionDialog`, `TransactionComments`
- `TransferDialog`
- `RuleDialog`

### Common
- `BaseRequiredAlert`, `BaseSelectionDialog`

### UI (shadcn/ui)
Componentes completos: accordion, alert, avatar, badge, button, calendar, card, chart, checkbox, command, dialog, dropdown-menu, form, input, label, popover, progress, radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, slider, switch, table, tabs, textarea, toast, toggle, tooltip, etc.

---

## 12. Dashboard — Layout e Lógica

### Estrutura do Dashboard (Index.tsx)

O dashboard é a **Consolidação Patrimonial** — visão macro da organização selecionada.

**Layout atual (de cima para baixo):**

```
┌──────────────────────────────────────────────────────┐
│  4 StatCards (grid 2x2 mobile / 4 colunas desktop)   │
│  Posição Financeira | Entradas | Saídas | Evolução   │
├──────────────────────────────────────────────────────┤
│  MultiCurrencyBalanceSection (se aplicável)           │
├──────────────────────────────────────────────────────┤
│  BudgetAlerts (alertas de orçamento)                  │
├──────────────────┬───────────────────────────────────┤
│  CategoryDonut   │  MonthlyEvolutionChart             │
│  (gráfico donut) │  (gráfico de barras/linhas)        │
├──────────────────┴───────────────────────────────────┤
│  FinancialHealthCard (saúde financeira)               │
├──────────────────┬───────────────────────────────────┤
│  BudgetProgress  │  FintechTransactionsList           │
│  (Orçamentos     │  (Últimas Movimentações —          │
│   do Mês)        │   minimalista, mesmo tamanho)      │
├──────────────────┴───────────────────────────────────┤
│  RecurringExpensesCard (despesas recorrentes)         │
├──────────────────┬───────────────────────────────────┤
│  CashflowForecast│  FinancialSimulatorCard            │
│  (Previsão Caixa)│  (Simulador — card menor)          │
├──────────────────┴───────────────────────────────────┤
│  ReconciliationMetricsCard (conciliação)             │
├──────────────────────────────────────────────────────┤
│  ConnectedAccountsSection (Open Finance)             │
└──────────────────────────────────────────────────────┘
│  AIAssistantChat (flutuante, canto inferior)         │
```

### Regras de Layout
- **BudgetProgress + FintechTransactionsList**: Lado a lado em `lg:grid-cols-2`, mesma altura
- **CashflowForecastCard + FinancialSimulatorCard**: Lado a lado em `lg:grid-cols-2`
- **CategoryDonutChart + MonthlyEvolutionChart**: Lado a lado em `lg:grid-cols-2`
- **FintechTransactionsList**: Card minimalista, compacto, nunca maior que BudgetProgress
- **FinancialHealthCard**: Retorna NULL se não há contas/transações (não mostra score falso)

### StatCards (4 métricas do topo)
| Métrica | Ícone | Variante | Cálculo |
|---|---|---|---|
| Posição Financeira | Wallet | default | Saldo contas correntes (exclui investimento, cartão, OF sem vínculo) |
| Entradas Financeiras | ArrowUpRight | success | Receitas do mês atual (com trend vs mês anterior) |
| Saídas Financeiras | ArrowDownRight | destructive | Despesas do mês atual (com trend vs mês anterior) |
| Evolução Patrimonial | TrendingUp | success/warning | Entradas - Saídas do mês |

### Banda colorida mobile
No mobile, os StatCards ficam sobre uma banda azul escuro (`sidebar-background`) que se estende do header até abaixo dos cards.

---

## 13. Pipeline de Classificação

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

## 14. Open Finance

### Pluggy (Integração Primária)
- Widget de conexão via popup (evita restrições de iframe)
- Pipeline: `pluggy-connect` → `pluggy-sync` → `financial-core-engine`
- Deduplicação por `sync_dedup_key`
- Classificação automática por creditDebitType (contas correntes) e padrões de descrição (cartões)
- Transações espelhadas no mesmo dia e conta são ignoradas automaticamente

### Klavi (Integração Secundária)
- Fluxo OAuth: `klavi-authorize` → `klavi-exchange-token`
- Sincronização via `klavi-sync`
- Webhook para notificações
- Página de callback: `/callback-klavi`

### Tabelas do Pipeline
1. `open_finance_items` — Conexões/itens (UNIQUE org + institution)
2. `open_finance_accounts` — Contas sincronizadas (UNIQUE item + pluggy_account_id)
3. `open_finance_sync_logs` — Logs de sync
4. `open_finance_raw_data` — Dados brutos
5. `sync_audit_logs` — Auditoria de sync

### Monitor
Rota `/open-finance-monitor` para acompanhamento em tempo real.

### Regra de Saldo Disponível (Posição Financeira)
- **Incluídas:** Contas correntes (checking) ativas com vínculo local
- **Excluídas:** Contas de investimento, cartões, contas OF sem `local_account_id`

---

## 15. Segredos / Variáveis de Ambiente

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

## 16. Terminologia Oficial

| Termo Genérico | Termo IBBRA |
|---|---|
| Saldo | **Posição Financeira** |
| Resumo / Dashboard | **Consolidação Patrimonial** |
| Receitas | **Entradas Financeiras** |
| Despesas | **Saídas Financeiras** |
| Saldo do Mês | **Evolução Patrimonial** |
| Patrimônio Total | **Consolidação Patrimonial** |

---

## 17. Configuração supabase/config.toml

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

## Checklist de Validação

- [ ] 30+ tabelas criadas com RLS
- [ ] 15+ funções SQL criadas como SECURITY DEFINER
- [ ] 19 Edge Functions deployadas
- [ ] Identidade visual IBBRA (paleta HSL, tipografia Playfair + Jakarta Sans, sidebar)
- [ ] Terminologia corporativa em todas as telas
- [ ] Pipeline de classificação funcional (regras → padrões → IA)
- [ ] Open Finance Pluggy conectando e sincronizando
- [ ] Secrets configurados (GEMINI_API_KEY, PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET)
- [ ] Dashboard com 4 StatCards + layout correto
- [ ] Importação OFX/CSV/PDF funcional
- [ ] Relatórios com exportação PDF
- [ ] Painel admin com gestão de acessos e hierarquia
- [ ] Audit log imutável
- [ ] Cartões de crédito com resumo avançado
- [ ] Score de saúde financeira retorna NULL sem dados
- [ ] Simulador financeiro ao lado de previsão de caixa
- [ ] Últimas Movimentações ao lado de Orçamentos do Mês (mesmo tamanho)

---

*Documento gerado — IBBRA v4.0 — 16 de Fevereiro de 2026*
