# IBBRA - Sistema de Gestão Financeira Multi-Tenant
## Documentação Técnica Completa

---

## 1. VISÃO GERAL

**Ibbra** é um SaaS de BPO Financeiro para pessoas físicas tratadas como empresas, com estética de "Wealth Management".

### Paleta de Cores
- **Azul Navy**: #011e40
- **Bege**: #eae1dc
- **Neutros**: Escala de cinzas

### Stack Tecnológico
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (Auth, Postgres, Storage, Edge Functions)
- **Gráficos**: Recharts
- **PDFs**: jsPDF + jspdf-autotable

---

## 2. ARQUITETURA MULTI-TENANT

```
┌─────────────────────────────────────────────────────────────────┐
│                         ORGANIZAÇÕES                             │
│  (Cada cliente = 1 "Base" com dados isolados por organization_id)│
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ Base A  │          │ Base B  │          │ Base C  │
   │ Cliente │          │ Cliente │          │ Cliente │
   └─────────┘          └─────────┘          └─────────┘
```

### Isolamento de Dados
- **RLS (Row Level Security)** em todas as tabelas
- Função `get_viewable_organizations(user_id)` controla acesso
- Nenhum dado cruza fronteiras de organização

---

## 3. HIERARQUIA DE USUÁRIOS (5 NÍVEIS)

```
┌─────────────────────────────────────────────────────────────────┐
│                           ADMIN                                  │
│                    (Gestão total do sistema)                     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                         SUPERVISOR                               │
│                   (Validação e qualidade)                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    FA (Financial Analyst)                        │
│                  (Classificação e análise)                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                  KAM (Key Account Manager)                       │
│                 (Relacionamento e relatórios)                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                          CLIENTE                                 │
│                (Upload e visualização restrita)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Regras de Vinculação
- Cliente → deve ter KAM responsável
- KAM → deve ter FA supervisor
- FA → deve ter Supervisor
- Clientes não podem ser excluídos, apenas bloqueados

---

## 4. FLUXO DE IMPORTAÇÃO (9 ETAPAS)

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. UPLOAD DO ARQUIVO                                              │
│    Formatos: OFX, CSV, PDF                                        │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. VALIDAÇÃO DE FORMATO E PERÍODO                                 │
│    Edge Function: process-import                                  │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. ARMAZENAMENTO NO SUPABASE STORAGE                             │
│    Bucket: "extratos" (privado)                                   │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. CRIAÇÃO DO LOTE (import_batches)                              │
│    Status: "processing"                                           │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. PARSING E HASH SHA-256                                         │
│    Prevenção de duplicatas por transaction_hash                   │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 6. INSERÇÃO DAS TRANSAÇÕES                                        │
│    validation_status: "pending_validation"                        │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 7. CLASSIFICAÇÃO AUTOMÁTICA                                       │
│    Edge Function: classify-transaction                            │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 8. CONCLUSÃO DO LOTE                                              │
│    Status: "completed" + métricas                                 │
└─────────────────────────────┬────────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ 9. NOTIFICAÇÃO AO USUÁRIO                                         │
│    Badge no menu "Pendências"                                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 5. MOTOR DE CONCILIAÇÃO AUTOMÁTICA

### Pipeline de Classificação (Ordem Fixa)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSAÇÃO IMPORTADA                           │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
              ┌───────────────────────────┐
              │     1. NORMALIZAÇÃO       │
              │  • lowercase              │
              │  • remover acentos        │
              │  • remover números        │
              │  • remover stopwords      │
              └───────────────┬───────────┘
                              ▼
              ┌───────────────────────────┐
              │  2. REGRAS DE CONCILIAÇÃO │
              │  Tabela: reconciliation_  │
              │  rules                    │
              │                           │
              │  Match ≥ 80%? ───────────────▶ AUTO-VALIDADO ✓
              │                           │    classification_source: "rule"
              └───────────────┬───────────┘
                              │ < 80%
                              ▼
              ┌───────────────────────────┐
              │  3. PADRÕES APRENDIDOS    │
              │  Tabela: transaction_     │
              │  patterns                 │
              │                           │
              │  Confidence ≥ 85%         │
              │  + 3 ocorrências? ───────────▶ AUTO-VALIDADO ✓
              │                           │    classification_source: "pattern"
              └───────────────┬───────────┘
                              │ < 85%
                              ▼
              ┌───────────────────────────┐
              │     4. IA (FALLBACK)      │
              │  Lovable AI Gateway       │
              │  (gemini-2.5-flash)       │
              │                           │
              │  NUNCA auto-valida ───────────▶ PENDÊNCIAS
              │                           │    classification_source: "ai"
              └───────────────────────────┘
```

### Aprendizado Contínuo

```
┌─────────────────────────────────────────────────────────────────┐
│              VALIDAÇÃO HUMANA EM PENDÊNCIAS                      │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
              ┌───────────────────────────┐
              │  ATUALIZAR PADRÃO         │
              │  (transaction_patterns)   │
              │                           │
              │  • Incrementar ocorrências│
              │  • Recalcular avg_amount  │
              │  • Aumentar confidence    │
              │  • Atualizar last_used_at │
              └───────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────┐
              │  PRÓXIMAS IMPORTAÇÕES     │
              │  Usarão o padrão aprendido│
              │  para classificar         │
              │  automaticamente          │
              └───────────────────────────┘
```

---

## 6. ESTRUTURA DE TABELAS

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `organizations` | Bases/clientes (multi-tenant) |
| `profiles` | Perfis de usuários |
| `user_roles` | Papéis (admin, supervisor, fa, kam, cliente) |
| `user_hierarchy` | Vínculos hierárquicos |
| `organization_members` | Membros por organização |
| `accounts` | Contas bancárias |
| `categories` | Categorias (pai/filho) com DRE |
| `cost_centers` | Centros de custo |
| `transactions` | Transações financeiras |
| `transfers` | Transferências entre contas |
| `budgets` | Orçamentos por categoria/mês |
| `reconciliation_rules` | Regras de conciliação |
| `transaction_patterns` | Padrões aprendidos (auto-learning) |
| `import_batches` | Lotes de importação |
| `ai_suggestions` | Sugestões da IA |
| `audit_log` | Log de auditoria |

### Enums

```sql
-- Tipos de conta
account_type: checking, savings, investment, credit_card, cash

-- Tipos de transação
transaction_type: income, expense, transfer, investment, redemption

-- Status de validação
validation_status: pending_validation, validated, rejected, needs_review

-- Papéis de usuário
app_role: admin, supervisor, fa, kam, cliente

-- Status de importação
import_status: pending, processing, awaiting_validation, completed, failed, cancelled
```

---

## 7. PÁGINAS E ROTAS

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Dashboard | Todos |
| `/auth` | Login | Público |
| `/transacoes` | Lista consolidada | Todos |
| `/receitas` | Receitas (type=income) | Todos |
| `/despesas` | Despesas (type=expense) | Todos |
| `/contas` | Contas bancárias | Todos |
| `/categorias` | Categorias hierárquicas | Todos |
| `/centros-custo` | Centros de custo | Todos |
| `/regras-conciliacao` | Regras automáticas | Todos |
| `/importacoes` | Upload de extratos | Todos |
| `/orcamentos` | Orçamentos | Todos |
| `/pendencias` | Validação de transações | Todos |
| `/analise-orcamento` | Budget vs Realizado | Todos |
| `/relatorios` | Relatórios diversos | Todos |
| `/dre` | Demonstrativo de Resultados | Todos |
| `/demonstrativo-financeiro` | Por período | Todos |
| `/fluxo-caixa` | Fluxo de caixa | Todos |
| `/perfil` | Perfil do usuário | Todos |
| `/admin` | Gerenciar acessos | Admin |
| `/padroes-aprendidos` | Padrões do motor | Admin |

---

## 8. REGRA DE OURO: SELEÇÃO DE BASE

```
┌─────────────────────────────────────────────────────────────────┐
│  USUÁRIO COM MÚLTIPLAS BASES (Admin, Supervisor, FA, KAM)       │
└─────────────────────────────┬───────────────────────────────────┘
                              ▼
              ┌───────────────────────────┐
              │  SELETOR DE BASE NO       │
              │  HEADER                   │
              └───────────────┬───────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ "Todas Bases" │     │   Base A      │     │   Base B      │
│               │     │               │     │               │
│ • Dashboard ✓ │     │ • Tudo ✓      │     │ • Tudo ✓      │
│ • Pendências ✓│     │ • Criar ✓     │     │ • Criar ✓     │
│ • Criar ✗     │     │ • Editar ✓    │     │ • Editar ✓    │
│ • Editar ✗    │     │ • Excluir ✓   │     │ • Excluir ✓   │
└───────────────┘     └───────────────┘     └───────────────┘
```

---

## 9. EDGE FUNCTIONS

| Função | Descrição |
|--------|-----------|
| `process-import` | Parse OFX/CSV/PDF, detecção duplicatas |
| `classify-transaction` | Pipeline de classificação (regras → padrões → IA) |
| `classify-transactions` | Classificação em lote |
| `seed-categories` | 42 categorias iniciais com DRE |
| `seed-reconciliation-rules` | 17 grupos de regras padrão |
| `manage-user-access` | Email, reset senha, bloqueio |
| `delete-user` | Exclusão com reatribuição |
| `get-user-emails` | Buscar emails (admin) |

---

## 10. MÉTRICAS DO MOTOR (ADMIN)

O Dashboard exibe para admins:

- **Taxa de Auto-Validação**: % transações classificadas automaticamente
- **Por Fonte**: Quantas por Regra, Padrão ou IA
- **Tempo Economizado**: 2 min × transações auto-validadas
- **Padrões Confiáveis**: Com confidence ≥ 85%
- **Pendentes**: Aguardando validação

---

## 11. EXPORTAÇÃO PDF

- **Logo**: /ibbra-logo-pdf.png
- **Cores**: Navy #011e40, Beige #eae1dc
- **Biblioteca**: jsPDF + jspdf-autotable
- **Page breaks**: Inteligentes (não corta tabelas)
- **Relatórios**: DRE, Fluxo de Caixa, Demonstrativo Financeiro

---

## 12. CONTEXTOS REACT

| Contexto | Responsabilidade |
|----------|------------------|
| `AuthContext` | Autenticação, bloqueio de usuário |
| `ThemeContext` | Dark/light mode |
| `BaseFilterContext` | Seleção de base, permissões |

---

**Versão**: 1.0
**Data**: Janeiro 2026
**Sistema**: Ibbra - Gestão Financeira Multi-Tenant
