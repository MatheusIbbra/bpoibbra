# IBBRA — System Documentation V9

## Overview
IBBRA is a comprehensive financial management SaaS platform (PWA) built for wealth consultancy, serving both individual clients and family offices. It provides multi-organization financial tracking, Open Finance integrations (Pluggy + Klavi), AI-powered insights, push notifications, and regulatory compliance (LGPD).

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Storage, RLS)
- **Monitoring**: Sentry (`@sentry/react`, `tracesSampleRate: 0.2`, production-only)
- **CI/CD**: GitHub Actions (test, lint, build, migration rollback validation)
- **PWA**: vite-plugin-pwa, iOS-ready with splash screens
- **Testing**: Vitest with 12+ unit tests for financial hooks

## Architecture

### Frontend Structure
```
src/
├── assets/          # Brand logos and images
├── components/
│   ├── admin/       # Admin panel (ClientManagement, UsersByRole, Hierarchy)
│   │   └── client-management/  # ClientFilters, ClientTable, index
│   ├── ai/          # AI Assistant Chat
│   ├── auth/        # Auth flow, Onboarding, Registration
│   │   └── registration/       # StepClientQuestion, StepCpfValidation, StepSignupMethod
│   ├── budget/      # Budget alerts, analysis, charts
│   ├── categories/  # Category management dialogs
│   ├── common/      # Shared UI (ConfirmDialog, SkeletonCard, BaseRequiredAlert, BaseSelectionDialog)
│   ├── cost-centers/ # Cost center dialogs
│   ├── dashboard/   # 20+ dashboard cards and widgets
│   ├── import/      # File import (CSV/OFX) components
│   ├── layout/      # AppLayout, Sidebar, Header, BaseSelector, BaseSelectorEnhanced
│   ├── open-finance/ # Bank connections manager (filters disconnected accounts)
│   ├── organizations/ # Organization member management
│   ├── profile/     # Privacy, Push Notification settings
│   ├── pwa/         # iOS install prompt
│   ├── reports/     # DRE, Cash Flow, Financial Statement, Budget Analysis reports
│   ├── rules/       # Reconciliation rules dialogs
│   ├── subscription/ # Upgrade modal
│   ├── transactions/ # Transaction dialogs and comments
│   ├── transfers/   # Transfer dialogs
│   └── ui/          # shadcn/ui components (40+)
├── contexts/        # Auth, BaseFilter, Theme, ValuesVisibility, UpgradeModal
├── hooks/           # 60+ custom hooks for data fetching and business logic
├── lib/             # Utilities (formatters, audit, PDF, error handler, Sentry, category-icons, legacy-initial-balance)
├── pages/           # 30+ route pages (lazy-loaded)
├── services/        # AI service, IBBRA client validation
└── test/            # Vitest tests (formatters, hooks, reconciliation, plan limits, error handler)
```

### Backend (Supabase Edge Functions — 18+)
| Function | Description |
|----------|-------------|
| `ai-chat` | AI conversation endpoint |
| `background-jobs` | Scheduled metrics computation + push notification triggers |
| `check-plan-limits` | Subscription plan enforcement |
| `classify-transaction` | Single AI transaction classification |
| `classify-transactions` | Batch AI transaction classification |
| `delete-client` | Admin client deletion |
| `delete-user` | Admin user deletion |
| `financial-core-engine` | Core financial calculations |
| `generate-ai-analysis` | AI financial analysis generation |
| `generate-ai-insights` | AI strategic insights generation |
| `get-user-emails` | Admin email lookup |
| `klavi-authorize` | Klavi Open Finance OAuth start |
| `klavi-disconnect` | Klavi connection removal |
| `klavi-exchange-token` | Klavi token exchange (AES-256-GCM encryption) |
| `klavi-sync` | Klavi data synchronization |
| `klavi-webhook` | Klavi webhook handler |
| `manage-user-access` | Admin email/password management |
| `pluggy-connect` | Pluggy Open Finance connection |
| `pluggy-sync` | Pluggy data synchronization |
| `pluggy-webhook` | Pluggy webhook handler |
| `process-import` | CSV/OFX file processing |
| `seed-categories` | Initial category seeding |
| `seed-reconciliation-rules` | Initial reconciliation rules seeding |
| `send-push-notification` | Web Push API notifications via VAPID |

### Database Schema (Key Tables — 30+)

#### Core Financial
- `organizations` — Multi-tenant base with blocking, KAM assignment, base_currency
- `organization_members` — Role-based access (admin, supervisor, fa, kam, cliente)
- `organization_subscriptions` / `plans` — Subscription management with Stripe integration
- `accounts` — Bank accounts (checking, savings, investment, cash, credit_card) with currency support
- `account_balance_snapshots` — Cached balance snapshots
- `transactions` — Financial transactions with categories, cost centers, accrual dates, hash dedup
- `transfers` — Inter-account transfers
- `categories` — Hierarchical categories with DRE grouping, expense classification
- `cost_centers` — Cost center management
- `budgets` — Monthly budget per category/cost center

#### Open Finance
- `bank_connections` — Open Finance connections (Klavi/Pluggy) with AES-256-GCM encrypted tokens
- `open_finance_items` — Synced bank items with sync scheduling
- `open_finance_accounts` — Synced bank accounts with credit card details
- `open_finance_raw_data` — Raw API responses for audit
- `open_finance_sync_logs` — Sync operation logs with duration tracking

#### AI & Analytics
- `ai_suggestions` — AI classification suggestions with confidence scores
- `ai_strategic_insights` — Cached AI insights per period
- `materialized_metrics` — Cached computed metrics (forecast, health, recurring)
- `cashflow_forecasts` — Cash flow projections
- `financial_simulations` — What-if financial simulations

#### System
- `push_subscriptions` — Web Push subscription storage (JSONB)
- `audit_log` — Immutable audit trail (no update/delete)
- `consent_logs` / `legal_documents` — LGPD compliance
- `data_deletion_requests` / `data_export_requests` — LGPD data rights
- `integration_logs` — Open Finance integration audit
- `api_usage_logs` — API usage tracking with token counting
- `feature_flags` — Feature flag management per org/role/plan
- `file_imports` / `import_batches` — File import tracking
- `exchange_rates` — Multi-currency exchange rates
- `family_members` — Family office member tracking
- `pending_registrations` — Pre-auth registration flow (RLS protected)

#### Views
- `bank_connections_safe` — Excludes encrypted token fields for frontend queries

### Security Architecture
- **RLS on ALL tables** with organization-scoped access via `get_viewable_organizations()` and `has_role()`
- **AES-256-GCM encryption** for bank connection tokens (encryption_version: 2)
- **JWT validation** on all edge functions (manual in code, `verify_jwt = false` in config)
- **CSP headers** and XSS protection via meta tags
- **Immutable audit log** (no update/delete policies)
- **bank_connections_safe view** excludes `access_token_encrypted`, `refresh_token_encrypted`, `encryption_version`
- **pending_registrations** restricted to service_role and anon insert-only

### Monitoring & CI/CD
- **Sentry**: `@sentry/react` with `tracesSampleRate: 0.2`, `environment: import.meta.env.MODE`, production-only
  - `Sentry.ErrorBoundary` wrapping `<App />`
  - `Sentry.captureException` in `GlobalErrorBoundary.componentDidCatch`
  - DSN via `VITE_SENTRY_DSN` environment variable
- **GitHub Actions** (`.github/workflows/ci.yml`):
  - `test` job: checkout → setup Node 20 → npm ci → test → build
  - `lint` job: checkout → setup Node 20 → npm ci → lint
  - `migration-check` job: validates `-- ROLLBACK:` comment in new migrations
- **Migration Governance**: `supabase/MIGRATION_GUIDE.md`, `scripts/check-migration.sh`, `MIGRATIONS_INDEX.md`
- **Tests**: 12+ Vitest unit tests covering DRE, Cash Flow, Budget Analysis, Health Score, formatters, reconciliation, plan limits, error handler

### Push Notifications
- **Web Push API** with VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- Subscriptions stored in `push_subscriptions` table with RLS
- `usePushNotifications` hook: `isSupported`, `isSubscribed`, `subscribe`, `unsubscribe`
- `PushNotificationSettings` component in Profile page
- Triggers via `background-jobs`:
  - Low financial health score alerts
  - Sync completion notifications
  - Anomaly detection alerts

### Design System
- **Typography**: Playfair Display (headings) + Plus Jakarta Sans (body)
- **Colors**: 
  - Brand Deep Blue `#011E41` (HSL: 213 80% 13%)
  - Highlight Blue `#005CB9` (HSL: 210 100% 36%)
  - Background Cream `#EBE1DC` (HSL: 18 24% 89%)
- **CSS**: HSL-based semantic tokens in `index.css`, full Tailwind config
- **Components**: Executive card variants, glass effects, premium shadows, motion animations
- **Dark mode**: Deep blue tones with proper contrast
- **Copyright**: "IBBRA Consultoria Financeira & Patrimonial 360°"

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `VITE_SENTRY_DSN` | Sentry error tracking DSN |
| `VAPID_PUBLIC_KEY` | Web Push public key (edge function) |
| `VAPID_PRIVATE_KEY` | Web Push private key (edge function) |
| `OPENAI_API_KEY` | AI classification/insights |
| `PLUGGY_CLIENT_ID` | Pluggy Open Finance |
| `PLUGGY_CLIENT_SECRET` | Pluggy Open Finance |
| `KLAVI_CLIENT_ID` | Klavi Open Finance |
| `KLAVI_CLIENT_SECRET` | Klavi Open Finance |
| `ENCRYPTION_KEY` | AES-256-GCM key for token encryption |

### Key Business Rules
1. **Multi-tenant isolation**: All financial data scoped to organizations via RLS
2. **Role hierarchy**: admin > supervisor > fa > kam > cliente
3. **Reconciliation pipeline**: Normalize → Rules (≥80%) → Patterns (≥85% + 3 occurrences) → AI fallback (never auto-validates)
4. **Import dedup**: SHA-256 hash prevents duplicate transactions
5. **Budget variance**: Real-time tracking of budgeted vs actual per category/month
6. **Open Finance**: Disconnected accounts hidden from UI, tokens encrypted at rest
7. **LGPD**: Consent logging, data export/deletion requests, legal document versioning
