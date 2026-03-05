# IBBRA — Sistema de Gestão Financeira Multi-Tenant

## Configuração de Ambiente

Este projeto requer as seguintes variáveis de ambiente. Copie `.env.example` para `.env` e preencha os valores:

| Variável | Descrição | Obrigatória |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex: `https://xxx.supabase.co`) | ✅ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key do Supabase (chave pública) | ✅ |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto Supabase | ✅ |
| `VITE_SENTRY_DSN` | DSN do Sentry para monitoramento de erros | Opcional |
| `VAPID_PUBLIC_KEY` | Chave pública VAPID para push notifications | Opcional |

### Secrets de Edge Functions (Supabase Dashboard)

Configure em **Supabase Dashboard > Settings > Edge Functions**:

| Secret | Descrição | Como obter |
|---|---|---|
| `GEMINI_API_KEY` | API key do Google Gemini para funcionalidades de IA | [Google AI Studio](https://aistudio.google.com/apikey) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (auto-configurada) | Dashboard Supabase |

## Tecnologias

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth, Database, Edge Functions, Storage)
- Capacitor (iOS/Android)

## Desenvolvimento Local

```sh
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>
cp .env.example .env
# Preencha as variáveis em .env
npm install
npm run dev
```

## Deploy

Abra [Lovable](https://lovable.dev) e clique em Share → Publish.

## Custom Domain

Navegue até Project > Settings > Domains e clique em Connect Domain.
[Documentação](https://docs.lovable.dev/features/custom-domain#custom-domain)
