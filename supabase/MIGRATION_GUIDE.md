# Guia de Migrations — IBBRA

## Processo Obrigatório

1. **Crie a migration** usando o template `_template.sql`
2. **Documente o rollback** — toda migration DEVE conter `-- ROLLBACK:` com os comandos para reverter
3. **Teste localmente** antes de submeter (se possível)
4. **Valide no CI** — o pipeline verifica automaticamente a presença do rollback
5. **Atualize o índice** em `MIGRATIONS_INDEX.md`

## Regras

- Nunca altere migrations já aplicadas em produção
- Use transações quando possível (`BEGIN; ... COMMIT;`)
- Sempre habilite RLS em novas tabelas
- Não use `ALTER DATABASE`
- Prefira triggers de validação em vez de CHECK constraints com `now()`
- Não modifique schemas reservados: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`

## Template

```sql
-- Migration: [DESCRIÇÃO CURTA]
-- Date: [DATA]
-- Author: [NOME]
-- Tables affected: [TABELAS]

-- FORWARD MIGRATION
[SQL]

-- ROLLBACK:
-- [SQL para reverter]
```

## Validação Automática

O script `scripts/check-migration.sh` e o job `migration-check` no CI validam que todas as migrations possuem comentário de rollback.
