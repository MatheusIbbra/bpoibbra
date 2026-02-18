# IBBRA — System Documentation V8

## Overview
IBBRA is a comprehensive financial management SaaS platform (PWA) built for wealth consultancy, serving both individual clients and family offices. It provides multi-organization financial tracking, Open Finance integrations, AI-powered insights, and regulatory compliance (LGPD).

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions, Storage, RLS)
- **Monitoring**: Sentry (error tracking + performance)
- **CI/CD**: GitHub Actions (test, lint, migration validation)
- **PWA**: vite-plugin-pwa, iOS-ready with splash screens

## Architecture

### Frontend Structure
```
src/
├── assets/          # Brand logos and images
├── components/
│   ├── admin/       # Admin panel (ClientManagement, UsersByRole, Hierarchy)
│   │   └── client-management/  # Refactored subcomponents
│   ├── auth/        # Auth flow, Onboarding, Registration
│   │   └── registration/       # Refactored registration steps
│   ├── budget/      # Budget alerts, analysis, charts
│   ├── categories/  # Category management dialogs
│   ├── common/      # Shared UI (ConfirmDialog, SkeletonCard)
│   ├── dashboard/   # 20+ dashboard cards and widgets
│   ├── import/      # File import (CSV/OFX) components
│   ├── layout/      # AppLayout, Sidebar, Header, BaseSelector
│   ├── open-finance/ # Bank connections manager
│   ├── profile/     # Privacy, Push Notification settings
│   ├── reports/     # DRE, Cash Flow, Financial Statement reports
│   ├── pwa/         # iOS install prompt
│   ├── subscription/ # Upgrade modal
│   ├── transactions/ # Transaction dialogs and comments
│   └── ui/          # shadcn/ui components
├── contexts/        # Auth, BaseFilter, Theme, ValuesVisibility, UpgradeModal
├── hooks/           # 50+ custom hooks for data fetching and business logic
├── lib/             # Utilities (formatters, audit, PDF, error handler, Sentry)
├── pages/           # 30+ route pages (lazy-loaded)
├── services/        # AI service, client validation
└── test/            # Vitest tests (formatters, hooks, reconciliation, plan limits)
```

### Backend (Supabase Edge Functions)
- `ai-chat` — AI conversation endpoint
- `background-jobs` — Scheduled metrics computation + push notifications
- `classify-transaction(s)` — AI transaction classification
- `delete-client` / `delete-user` — Admin user management
- `financial-core-engine` — Core financial calculations
- `generate-ai-analysis` / `generate-ai-insights` — AI insights generation
- `get-user-emails` — Admin email lookup
- `klavi-*` — Klavi Open Finance integration (authorize, exchange-token, sync, webhook, disconnect)
- `manage-user-access` — Admin email/password management
- `pluggy-*` — Pluggy Open Finance integration (connect, sync, webhook)
- `process-import` — CSV/OFX file processing
- `seed-categories` / `seed-reconciliation-rules` — Initial data seeding
- `send-push-notification` — Web Push API notifications
- `check-plan-limits` — Subscription plan enforcement

### Database Schema (Key Tables)
- `organizations` — Multi-tenant base with blocking, KAM assignment
- `organization_members` — Role-based access (admin, supervisor, fa, cliente)
- `organization_subscriptions` / `plans` — Subscription management
- `accounts` — Bank accounts (checking, savings, investment, cash, credit_card)
- `transactions` — Financial transactions with categories, cost centers, accrual dates
- `categories` — Hierarchical categories with DRE grouping
- `budgets` — Monthly budget per category/cost center
- `bank_connections` — Open Finance connections (Klavi/Pluggy)
- `open_finance_items` / `open_finance_accounts` — Synced bank data
- `materialized_metrics` — Cached computed metrics (forecast, health, recurring)
- `push_subscriptions` — Web Push subscription storage
- `audit_log` — Immutable audit trail
- `consent_logs` / `legal_documents` — LGPD compliance

### Security
- RLS on all tables with organization-scoped access
- AES-256-GCM encryption for bank tokens
- JWT validation on all edge functions
- CSP headers and XSS protection
- Audit logging for critical operations
- `bank_connections_safe` view excludes sensitive token fields

### Monitoring & CI/CD
- **Sentry**: Error tracking with `tracesSampleRate: 0.2`, production-only
- **GitHub Actions**: Test + Lint + Build on push/PR, migration rollback validation
- **Tests**: 12+ unit tests covering DRE, Cash Flow, Budget Analysis, Health Score, formatters, reconciliation

### Push Notifications
- Web Push API with VAPID keys
- Stored in `push_subscriptions` table
- Triggered by background-jobs for health alerts
- User-managed via Profile settings

## Design System
- **Typography**: Playfair Display (headings) + Plus Jakarta Sans (body)
- **Colors**: Brand Deep Blue (#011E41), Highlight Blue (#005CB9), Cream (#EBE1DC)
- **CSS**: HSL-based semantic tokens in index.css, Tailwind config
- **Components**: Executive card variants, glass effects, premium shadows
