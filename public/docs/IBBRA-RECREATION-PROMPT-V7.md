# IBBRA — Recreation Prompt V7

> Use this prompt to recreate the IBBRA system from scratch in a new Lovable project.

## Core Setup

1. **Create React + Vite + TypeScript project** with Tailwind CSS and shadcn/ui
2. **Connect Supabase** with the existing project ID `umqehhhpedwqdfjmdjqv`
3. **Install dependencies**: `@sentry/react`, `@supabase/supabase-js`, `@tanstack/react-query`, `framer-motion`, `recharts`, `date-fns`, `jspdf`, `jspdf-autotable`, `papaparse`, `react-router-dom`, `react-pluggy-connect`, `zod`, `react-hook-form`, `@hookform/resolvers`, `vite-plugin-pwa`, `sonner`

## Design System

Configure index.css with IBBRA brand tokens:
- Background: Cream `#EBE1DC` (HSL: 18 24% 89%)
- Primary: Deep Blue `#011E41` (HSL: 213 80% 13%)
- Accent: Highlight Blue `#005CB9` (HSL: 210 100% 36%)
- Fonts: Playfair Display (headings), Plus Jakarta Sans (body)
- Dark mode with deep blue tones

## Database Schema

Recreate all tables from IBBRA-SYSTEM-DOCUMENTATION-V8.md with:
- RLS policies using `get_viewable_organizations()` and `has_role()` functions
- Organization-scoped access for all financial data
- Immutable audit_log (no update/delete)
- `bank_connections_safe` view excluding encrypted tokens

## Key Features to Implement

1. **Auth**: Email/password + Google OAuth, IBBRA client CPF validation, onboarding flow
2. **Multi-org**: Organization selector, role hierarchy (admin > supervisor > fa > cliente)
3. **Dashboard**: 20+ cards (stats, charts, AI insights, health score, forecast)
4. **Transactions**: CRUD with categories, cost centers, accrual dates, import (CSV/OFX)
5. **Reports**: DRE, Cash Flow, Budget Analysis, Financial Statement (PDF export)
6. **Open Finance**: Pluggy + Klavi integrations with AES-256-GCM token encryption
7. **AI**: Transaction classification, strategic insights, chat assistant
8. **Budgets**: Monthly budgets per category with variance analysis
9. **Push Notifications**: Web Push API with VAPID keys, background-jobs triggers
10. **Admin**: Client management, user hierarchy, KAM assignment, blocking
11. **LGPD**: Consent logging, data export/deletion requests, legal documents
12. **PWA**: Offline-capable, iOS install prompt, splash screens

## Monitoring

- Sentry integration via `VITE_SENTRY_DSN` env var
- GitHub Actions CI/CD with test, lint, build, migration validation
- Vitest unit tests for financial hooks

## Edge Functions

Deploy all 18+ edge functions with `verify_jwt = false` in config.toml (manual JWT validation in code).

## Security Checklist

- [ ] RLS enabled on ALL tables
- [ ] `bank_connections_safe` view (no tokens)
- [ ] AES-256-GCM for bank connection tokens
- [ ] Audit logging for critical operations
- [ ] CSP meta tags in index.html
- [ ] Migration rollback documentation required
