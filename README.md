# Tech Trolley

One shop's internal inventory, sales, money and daily accounts. Next.js web, native Expo Android/iOS and one NestJS/PostgreSQL API. Bengali/English, charcoal/gold branding, light/dark themes. Login only; Owners privately create Owner and Staff accounts.

Canonical project: `E:\Taki`. Reference structure and audit are in [docs/reference-structure.md](docs/reference-structure.md). The old project remains read-only.

Deploy on **Vercel (web), Render (API), Supabase (PostgreSQL)** using the [বাংলা deployment guide](docs/deploy-vercel-render-supabase-bn.md). Vercel configuration is in `tech-trolley-frontend/vercel.json`; the optional Render Blueprint is `render.yaml`. Browser API calls use `/api` to preserve secure same-origin cookies.

```powershell
Set-Location E:\Taki
npm ci
npm run build:shared
# Configure tech-trolley-backend/.env from its example with your own server values.
npm run db:migrate
npm run db:bootstrap
# Separate terminals:
npm run build -w @tech-trolley/backend
npm start -w @tech-trolley/backend
npm run dev -w @tech-trolley/frontend
```

Web: http://localhost:3001. API: http://localhost:3000. API docs: http://localhost:3000/openapi. Never put database or bootstrap secrets in public client configuration. The requested initial Owner is configured only in ignored server configuration and must change the initial password before operations. Its documented login ID is `owner`; the configured email also works.

```powershell
# Isolated PostgreSQL tests on Windows (PostgreSQL 18 binaries required):
./scripts/start-test-postgres.ps1
$env:TEST_DATABASE_URL='postgresql://trolley_test@127.0.0.1:55432/trolley_test'
npm run build
npm test
npm run typecheck
npm run export -w @tech-trolley/mobile
```

See [operator guide](docs/operator-guide.md), [authentication](docs/authentication.md), [deployment and recovery](docs/deployment.md), [mobile release](docs/mobile-release.md), [verification](docs/verification.md) and [progress](docs/progress.md). Native JavaScript bundles are distinct from signed APK/AAB/IPA builds and device tests. No public cloud deployment is claimed.
