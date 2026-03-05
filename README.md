# IBBRA — Sistema de Gestão Financeira Multi-Tenant

## ⚙️ Configuração de Ambiente

> ⚠️ **NUNCA commite o arquivo `.env`** — ele contém credenciais reais e está no `.gitignore`.

Copie o template e preencha os valores:

```sh
cp .env.example .env
```

| Variável | Descrição | Onde obter |
|---|---|---|
| `VITE_SUPABASE_URL` | URL do projeto Supabase (ex: `https://xxx.supabase.co`) | [Supabase Dashboard → Settings → API](https://supabase.com/dashboard) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon key do Supabase (chave pública) | [Supabase Dashboard → Settings → API](https://supabase.com/dashboard) |
| `VITE_SUPABASE_PROJECT_ID` | ID do projeto Supabase | [Supabase Dashboard → Settings → General](https://supabase.com/dashboard) |
| `VITE_SENTRY_DSN` | DSN do Sentry para monitoramento de erros | [Sentry → Settings → Projects → DSN](https://sentry.io) |

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
