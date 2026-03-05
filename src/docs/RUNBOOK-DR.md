# IBBRA — Runbook de Disaster Recovery

> **Classificação:** Confidencial — Apenas equipe técnica e administradores.
> **Última atualização:** 2026-03-05

---

## 1. Falha Total do Supabase

### Sintomas
- API retorna 503/502; dashboard Supabase inacessível.
- Frontend exibe "Erro ao carregar dados" em todas as páginas.

### Procedimento
1. **Verificar status page:** Acesse [https://status.supabase.com](https://status.supabase.com) e confirme se há incidente ativo no projeto `umqehhhpedwqdfjmdjqv`.
2. **Ativar modo read-only no frontend:**
   - No Supabase Dashboard > Edge Functions > `background-jobs`, pause a execução.
   - Oriente usuários que dados estão temporariamente indisponíveis via banner no app (componente `CircuitBreakerBanner`).
3. **Cache local:** O React Query mantém cache de 2 minutos. Dados recentes continuam visíveis brevemente.
4. **Contato de suporte:** Abra ticket em [https://supabase.com/dashboard/support](https://supabase.com/dashboard/support) — SLA do plano Pro é 1h para P1.
5. **RTO estimado:** 30 minutos a 4 horas dependendo da severidade.
6. **Pós-incidente:** Após restauração, execute sincronização global do Open Finance para atualizar saldos defasados. Verifique `integration_logs` por erros durante o período de indisponibilidade.

---

## 2. Falha do Pluggy (Open Finance Primário)

### Sintomas
- Sincronizações falhando com HTTP 5xx.
- `circuit_breaker_state` com `state = 'open'` para provider `pluggy`.
- Banner "Sincronização bancária temporariamente indisponível" visível no frontend.

### Procedimento
1. **Verificar status Pluggy:** Acesse [https://status.pluggy.ai](https://status.pluggy.ai).
2. **Circuit breaker automático:** O sistema já bloqueia novas requisições automaticamente após 3 falhas em 5 minutos. Tentativa automática em 10 minutos (half_open).
3. **Chavear para Klavi como primário (se disponível):**
   - No Supabase SQL Editor, execute:
     ```sql
     UPDATE bank_connections
     SET provider = 'klavi', status = 'pending_reauth'
     WHERE provider = 'pluggy' AND status = 'active';
     ```
   - Oriente clientes a reconectar suas contas via o widget Klavi.
   - **Atenção:** IDs de item/conta do Pluggy não são compatíveis com Klavi. Será necessário novo consentimento.
4. **Remapeamento de contas:**
   - As `open_finance_accounts` vinculadas ao Pluggy precisam de novo mapeamento `local_account_id`.
   - Após reconexão via Klavi, o sistema cria automaticamente novos registros em `open_finance_accounts`.
5. **Rollback quando Pluggy voltar:**
   - Reative conexões Pluggy atualizando `provider` e `status` de volta.
   - Execute sincronização manual para preencher gaps de dados.

---

## 3. Falha da API Gemini (IA de Classificação)

### Sintomas
- Classificações IA retornando `"IA indisponível"` ou `"reasoning": "IA não configurada"`.
- Aumento de transações sem categoria em `pendencias`.
- Erros 429/5xx nos logs da Edge Function `classify-transaction`.

### Procedimento
1. **Verificar status Google AI:** Acesse [https://status.cloud.google.com](https://status.cloud.google.com) e verifique "Generative Language API".
2. **Desabilitar camada 4 (IA) do pipeline:**
   - O pipeline opera em 3+1 camadas: Regras → Padrões → Exact Match → IA.
   - Sem IA, as camadas 1-3 continuam funcionando normalmente.
   - Para desabilitar explicitamente, remova ou limpe o secret `GEMINI_API_KEY` e `LOVABLE_API_KEY` temporariamente no Supabase Dashboard > Settings > Edge Functions.
3. **Impacto estimado:**
   - Transações com descrições conhecidas (60-80%) continuam sendo classificadas por regras e padrões.
   - Apenas transações novas/inéditas ficam sem classificação automática.
   - Usuários podem classificar manualmente na tela de Pendências.
4. **Monitoramento:**
   - Consulte taxa de classificação:
     ```sql
     SELECT classification_source, COUNT(*)
     FROM transactions
     WHERE created_at > now() - interval '24 hours'
     GROUP BY classification_source;
     ```
5. **Restauração:** Ao retornar, reinsira os secrets e as próximas transações importadas serão classificadas por IA.

---

## 4. Vazamento de Dados

### Sintomas
- Acesso não autorizado detectado em `audit_log` ou `security_events`.
- Tokens comprometidos reportados.

### Procedimento de Isolamento Imediato

1. **Identificar escopo:**
   - Verificar `organization_id` afetado nos logs:
     ```sql
     SELECT DISTINCT organization_id, user_id, action, created_at
     FROM audit_log
     WHERE created_at > now() - interval '24 hours'
     ORDER BY created_at DESC;
     ```
2. **Revogar tokens comprometidos:**
   - No Supabase Dashboard > Authentication > Users, localize o usuário e clique "Sign Out Everywhere".
   - Para revogar programaticamente:
     ```sql
     -- Force session invalidation (user must re-login)
     UPDATE auth.users SET updated_at = now() WHERE id = '<user_id>';
     ```
3. **Rotacionar secrets:**
   - Atualize `SUPABASE_SERVICE_ROLE_KEY` no painel Supabase se houver suspeita de exposição.
   - Atualize `PLUGGY_CLIENT_SECRET`, `KLAVI_SECRET_KEY`, `GEMINI_API_KEY` nos Edge Function secrets.
   - Atualize `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` se aplicável.
4. **Isolamento por organização:**
   - RLS garante isolamento por `organization_id` em todas as tabelas.
   - Verifique se nenhuma policy foi alterada:
     ```sql
     SELECT schemaname, tablename, policyname, permissive, cmd
     FROM pg_policies
     WHERE schemaname = 'public'
     ORDER BY tablename;
     ```
5. **Notificação:**
   - LGPD exige notificação à ANPD em até 72 horas se dados pessoais foram expostos.
   - Notifique usuários afetados via email com detalhes do incidente.
6. **Registro do incidente:**
   ```sql
   INSERT INTO security_events (organization_id, user_id, event_type, severity, details)
   VALUES ('<org_id>', '<user_id>', 'data_breach_response', 'critical',
     '{"action": "containment", "scope": "...", "timestamp": "..."}'::jsonb);
   ```

---

## Contatos de Emergência

| Serviço | Canal | SLA |
|---------|-------|-----|
| Supabase | Dashboard Support Ticket | 1h (Pro) |
| Pluggy | suporte@pluggy.ai | 4h |
| Klavi | suporte@klavi.com.br | 4h |
| Google AI | Cloud Console Support | Varia por plano |
| Stripe | dashboard.stripe.com/support | 24h |

---

## Checklist Pós-Incidente

- [ ] Causa raiz identificada e documentada
- [ ] Correção implementada e validada
- [ ] Dados verificados por integridade (saldos, transações)
- [ ] Sincronização Open Finance executada para preencher gaps
- [ ] Usuários notificados (se aplicável)
- [ ] Registro no `audit_log` com ação `disaster_recovery`
- [ ] Post-mortem agendado dentro de 48h
