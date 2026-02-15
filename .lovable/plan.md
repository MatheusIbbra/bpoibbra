

# Documentacao Completa e Prompt de Backup do Sistema IBBRA

## Objetivo

Gerar dois arquivos de documentacao completos:

1. **`public/docs/IBBRA-SYSTEM-DOCUMENTATION-V3.md`** -- Documentacao tecnica completa e atualizada do sistema (substituindo V2)
2. **`public/docs/IBBRA-RECREATION-PROMPT-V2.md`** -- Prompt de recriacao atualizado para backup e disaster recovery

---

## Conteudo da Documentacao Tecnica (V3)

O documento cobrira todos os aspectos do sistema atual:

### 1. Identidade e Visao Geral
- Nome: IBBRA
- Proposito: Plataforma institucional de wealth strategy e gestao financeira multi-tenant para BPO
- Stack: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase
- Identidade visual: Paleta oficial (#011E41, #005CB9, #EBE1DC, #ECF2FA, #FF4614), tipografia Playfair Display + Plus Jakarta Sans

### 2. Arquitetura Multi-Tenant
- Modelo de organizacoes (bases) com isolamento por organization_id
- 5 niveis hierarquicos: Admin, Supervisor, FA, KAM, Cliente
- Regra de selecao de base obrigatoria
- Sistema de bloqueio de usuarios e organizacoes

### 3. Banco de Dados (21+ tabelas)
- Documentar todas as tabelas com colunas, tipos, defaults
- Tabelas: organizations, profiles, user_roles, user_hierarchy, organization_members, accounts, categories, cost_centers, transactions, transfers, budgets, reconciliation_rules, transaction_patterns, import_batches, ai_suggestions, audit_log, bank_connections, open_finance_items, open_finance_accounts, open_finance_sync_logs, open_finance_raw_data, sync_audit_logs, ai_strategic_insights, integration_logs, file_imports

### 4. Funcoes SQL / RPCs
- get_viewable_organizations, can_view_organization, can_view_transaction, has_role, get_user_organizations, get_user_org_ids, can_view_profile, can_manage_org_members, normalize_transaction_description, text_similarity, calculate_account_balance, get_subordinates

### 5. Politicas RLS
- Resumo das politicas por tabela

### 6. Edge Functions (19 funcoes)
- generate-ai-analysis: Gateway seguro para Gemini 2.5 Flash
- generate-ai-insights: Insights estrategicos via Gemini
- classify-transaction: Pipeline de classificacao em 3 camadas (regras > padroes > IA)
- classify-transactions: Classificacao em lote
- financial-core-engine: Processamento de transacoes Open Finance
- process-import: Importacao OFX/CSV/PDF
- pluggy-connect / pluggy-sync / pluggy-webhook: Integracao Pluggy
- klavi-authorize / klavi-exchange-token / klavi-sync / klavi-disconnect / klavi-webhook: Integracao Klavi
- seed-categories / seed-reconciliation-rules: Dados iniciais
- manage-user-access / delete-user / get-user-emails: Gestao de usuarios

### 7. Contextos React (4)
- AuthContext, ThemeContext, BaseFilterContext, ValuesVisibilityContext

### 8. Hooks Customizados (39 hooks)
- Lista completa com descricao funcional

### 9. Servicos
- aiService.ts: Camada de abstracao para IA (Gemini 2.5 Flash)

### 10. Paginas e Rotas (30 rotas)
- Mapeamento completo de rotas para paginas

### 11. Componentes (organizados por modulo)
- layout, dashboard, accounts, admin, ai, budget, categories, cost-centers, import, open-finance, organizations, reports, rules, transactions, transfers, common, ui

### 12. Pipeline de Classificacao
- Camada 1: Normalizacao de texto
- Camada 2: Regras de conciliacao (similaridade >= 80%)
- Camada 3: Padroes aprendidos (confianca >= 85%, ocorrencias >= 3)
- Camada 4: IA Gemini 2.5 Flash (nunca auto-valida, cap 75%)

### 13. Open Finance
- Integracao Pluggy (primaria)
- Integracao Klavi (secundaria)
- Pipeline de sincronizacao e deduplicacao

### 14. Segredos / Variaveis de Ambiente
- GEMINI_API_KEY, PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, etc.

### 15. Terminologia Oficial
- Consolidacao Patrimonial, Posicao Financeira, Entradas Financeiras, Saidas Financeiras, Evolucao Patrimonial

---

## Conteudo do Prompt de Recriacao (V2)

Prompt atualizado em 5 etapas com todas as mudancas recentes:

- Integracao Gemini 2.5 Flash via Edge Function segura
- Identidade visual IBBRA atualizada (serif + sans-serif)
- Terminologia corporativa atualizada
- Logica de saldo excluindo investimentos
- Open Finance com Pluggy
- 19 Edge Functions documentadas
- Todas as 30 rotas
- Regra de calculo de saldo disponivel

---

## Detalhes Tecnicos de Implementacao

### Arquivos a criar:
1. **`public/docs/IBBRA-SYSTEM-DOCUMENTATION-V3.md`** (~1500 linhas)
   - Documentacao tecnica completa em Markdown
   - Servira como fonte de verdade do sistema

2. **`public/docs/IBBRA-RECREATION-PROMPT-V2.md`** (~800 linhas)
   - Prompt dividido em 5 etapas para recriar o sistema do zero
   - Inclui todas as especificacoes de banco, edge functions, UI e logica de negocio
   - Atualizado com Gemini 2.5 Flash, identidade visual IBBRA e terminologia corporativa

### Pagina /documentacao
- Verificar se a pagina ja referencia o arquivo correto e atualizar se necessario

### Nao sera alterado:
- Nenhum codigo funcional
- Nenhuma migracao
- Nenhuma edge function
- Nenhum componente ou hook

