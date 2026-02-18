# IBBRA — Recreation Prompt V8

> Use this prompt to recreate the IBBRA system from scratch in a new Lovable project.

## Core Setup

1. **Create React + Vite + TypeScript project** with Tailwind CSS and shadcn/ui
2. **Connect Supabase** with the existing project ID `umqehhhpedwqdfjmdjqv`
3. **Install dependencies**: `@sentry/react`, `@supabase/supabase-js`, `@tanstack/react-query`, `framer-motion`, `recharts`, `date-fns`, `jspdf`, `jspdf-autotable`, `papaparse`, `react-router-dom`, `react-pluggy-connect`, `zod`, `react-hook-form`, `@hookform/resolvers`, `vite-plugin-pwa`, `sonner`, `next-themes`, `embla-carousel-react`, `input-otp`, `cmdk`, `vaul`, `react-resizable-panels`, `react-day-picker`

## Design System

Configure `index.css` with IBBRA brand tokens (all HSL):
- Background: Cream `#EBE1DC` (HSL: 18 24% 89%)
- Primary: Deep Blue `#011E41` (HSL: 213 80% 13%)
- Accent: Highlight Blue `#005CB9` (HSL: 210 100% 36%)
- Fonts: Playfair Display (headings), Plus Jakarta Sans (body)
- Dark mode with deep blue tones
- Copyright text: "IBBRA Consultoria Financeira & Patrimonial 360°"

## Database Schema

Recreate all 30+ tables from IBBRA-SYSTEM-DOCUMENTATION-V9.md with:
- RLS policies using `get_viewable_organizations()`, `has_role()`, `can_view_organization()`
- Organization-scoped access for all financial data
- Immutable `audit_log` (no update/delete policies)
- `bank_connections_safe` view excluding `access_token_encrypted`, `refresh_token_encrypted`, `encryption_version`
- `pending_registrations` with service_role + anon insert-only RLS
- `push_subscriptions` table with user-scoped RLS

## Key Features to Implement

### 1. Authentication & Onboarding
- Email/password + Google OAuth
- IBBRA client CPF validation (pre-registration flow)
- Registration steps: StepClientQuestion → StepCpfValidation → StepSignupMethod
- OnboardingGuard for post-auth setup

### 2. Multi-Organization
- Organization selector (BaseSelector / BaseSelectorEnhanced)
- Role hierarchy: admin > supervisor > fa > kam > cliente
- User hierarchy management
- Organization blocking with reason tracking

### 3. Dashboard (20+ cards)
- StatCard with hover transactions detail
- Monthly evolution chart, Category donut chart
- AI Strategic Insights, Financial Health Score (0-100)
- Cashflow Forecast, Personal Runway, Structured Liquidity
- Bank Concentration, Currency Exposure, Anomaly Detection
- Recurring Expenses, Lifestyle Pattern, Patrimony Evolution
- Credit Card Summary (basic + advanced)
- Reconciliation Metrics, Financial Simulator, Macro Simulation
- Connected Accounts, Consolidated Balance, Multi-Currency Balance

### 4. Transactions
- CRUD with categories, cost centers, accrual dates
- Import: CSV/OFX with batch tracking (ImportBatchList, ExtractUploader)
- Auto-classification pipeline: Rules → Patterns → AI fallback
- SHA-256 hash dedup on import
- Transaction comments system
- Auto-ignore transfers detection

### 5. Reports (PDF export via jsPDF)
- DRE (Income Statement)
- Cash Flow Statement
- Budget Analysis (budgeted vs actual)
- Financial Statement / Demonstrativo
- Extract / Extrato
- Financial Type Report
- Movimentações Report
- Period selector component

### 6. Open Finance
- Pluggy integration (connect, sync, webhook)
- Klavi integration (authorize, exchange-token, sync, webhook, disconnect)
- AES-256-GCM token encryption (encryption_version: 2, Web Crypto API)
- Disconnected accounts filtered from UI
- Sync logs with duration tracking
- Raw data storage for audit

### 7. AI Features
- Transaction classification (single + batch)
- Strategic insights generation per period
- AI Chat assistant
- Confidence scoring and reasoning

### 8. Budgets
- Monthly budgets per category/cost center
- Budget alerts component
- Budget vs Actual chart
- Variance analysis in reports

### 9. Push Notifications
- Web Push API with VAPID keys
- `push_subscriptions` table with RLS
- `usePushNotifications` hook (isSupported, isSubscribed, subscribe, unsubscribe)
- `PushNotificationSettings` component in Profile
- `send-push-notification` edge function
- Triggers in `background-jobs`: health alerts, sync completion, anomalies

### 10. Admin Panel
- Client management with filters and table (refactored subcomponents)
- User hierarchy management (supervisor → FA → client assignments)
- KAM assignment per organization
- Organization blocking/unblocking
- User role management (invite, edit access, delete)
- Settings dialog

### 11. LGPD Compliance
- Consent logging with IP/user-agent tracking
- Data export requests (full export)
- Data deletion requests with admin processing
- Legal documents versioning (terms, privacy policy)
- Privacy section in Profile

### 12. PWA
- Offline-capable via vite-plugin-pwa
- iOS install prompt component
- Splash screens (1170x2532, 1179x2556, 1284x2778, 1290x2796)
- Web manifest with icons (192, 512)

### 13. Subscription Management
- Plans table with feature limits (accounts, transactions, AI requests, etc.)
- Organization subscriptions with Stripe IDs
- Plan limit enforcement via `check-plan-limits` edge function
- Upgrade modal component
- Feature flags per org/role/plan

## Monitoring & Error Tracking

### Sentry Integration
- Initialize in `src/lib/sentry.ts` and import in `main.tsx`
- `Sentry.init({ dsn: VITE_SENTRY_DSN, tracesSampleRate: 0.2, environment: import.meta.env.MODE, enabled: import.meta.env.PROD })`
- Wrap `<App />` with `Sentry.ErrorBoundary`
- `Sentry.captureException(error)` in GlobalErrorBoundary
- Add `VITE_SENTRY_DSN=` to `.env.example`

### CI/CD (`.github/workflows/ci.yml`)
```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test
      - run: npm run build
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
  migration-check:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.changed_files, 'supabase/migrations/')
    steps:
      - uses: actions/checkout@v4
      - run: bash scripts/check-migration.sh
```

### Unit Tests (Vitest)
Test files in `src/test/hooks/`:
- `useDREReport.test.ts` — revenue/expense/net totals
- `useCashFlowReport.test.ts` — opening balance, inflows, outflows, closing
- `useBudgetAnalysis.test.ts` — execution %, budgeted vs actual variance
- `useFinancialHealthScore.test.ts` — score 0-100 with mocked data
- Each test: happy path + empty data + negative values

### Migration Governance
- `supabase/MIGRATION_GUIDE.md` — mandatory process documentation
- `scripts/check-migration.sh` — validates `-- ROLLBACK:` comment
- `supabase/MIGRATIONS_INDEX.md` — migration registry
- Template: `supabase/migrations/_template.sql`

## Edge Functions Configuration

All functions in `supabase/config.toml` with `verify_jwt = false` (manual JWT validation in code):
```toml
[functions.ai-chat]
verify_jwt = false
[functions.background-jobs]
verify_jwt = false
# ... (all 18+ functions)
```

## Security Checklist

- [x] RLS enabled on ALL tables (30+)
- [x] `bank_connections_safe` view (excludes tokens)
- [x] AES-256-GCM for bank connection tokens (v2)
- [x] `pending_registrations` restricted RLS
- [x] Immutable audit_log (no update/delete)
- [x] Audit logging for critical operations
- [x] CSP meta tags in index.html
- [x] Migration rollback documentation required
- [x] Sentry error boundary for production
- [x] Push subscriptions user-scoped via RLS
- [x] Disconnected OF accounts hidden from UI
- [x] LGPD consent + data rights management
