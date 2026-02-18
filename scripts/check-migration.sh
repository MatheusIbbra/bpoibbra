#!/bin/bash
# Validates that new migration files contain a ROLLBACK comment.
# Usage: ./scripts/check-migration.sh [file1.sql file2.sql ...]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

FILES="${@:-$(git diff --cached --name-only -- 'supabase/migrations/*.sql' | grep -v '_template.sql')}"

if [ -z "$FILES" ]; then
  echo -e "${GREEN}No migration files to check.${NC}"
  exit 0
fi

ERRORS=0
for file in $FILES; do
  if [ ! -f "$file" ]; then continue; fi
  if ! grep -q "-- ROLLBACK:" "$file"; then
    echo -e "${RED}❌ Missing '-- ROLLBACK:' in $file${NC}"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}Found $ERRORS migration(s) without rollback documentation.${NC}"
  echo "Add a '-- ROLLBACK:' section to each migration before pushing."
  exit 1
fi

echo -e "${GREEN}✅ All migrations have rollback comments.${NC}"
