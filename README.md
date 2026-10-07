# Vaagai · Jaguar Crew

Full-stack Next.js 16, React 19, TypeScript and Tailwind CSS. The dashboard, Growth Tracker and C310 assessments use the App Router; backend handlers live in `app/api/**/route.ts` and run in the same Node.js server.

Frontend sections have real page routes: `/overview`, `/onboarding`, `/project`, `/tasks`, `/meetings`, `/community`, `/evidence`, `/raid`, `/c310`, `/growth`, `/control` and `/guide`. `/` also opens the overview. Sidebar links use Next.js navigation, direct links and refresh work, and old hash bookmarks are replaced with the equivalent page route. API endpoints remain under `/api/`.

## Local setup

Requires Node.js >=22.13.0 and npm. SQLite uses Node's built-in module, which emits an experimental warning on Node 22.

```powershell
cd D:\Projects\VaagaiJaguar\jaguar-crew
npm install
npm run dev
```

Open http://127.0.0.1:3000 and click Sign in with ChatGPT. In development this opens a local crew-member selector. Choose a member to test their existing permissions. This is development impersonation, not a real ChatGPT login. Sessions expire after eight hours or a server restart. Production disables this selector.

Optionally copy `.env.example` to `.env.local`. River Guide requires a separately configured server-side OpenAI key. No credentials are bundled and this migration does not connect to the provider.

```powershell
npm run typecheck
npm test
npm run build
npm start
```

Production runs at http://127.0.0.1:3000. Pass `-- --port 3100` to either server command to change ports. Both commands bind to loopback by default.

## Backend

- `/api/me`: current crew identity.
- `/api/crew`: tasks, evidence, community, meetings, RAID and controls.
- `/api/growth`: role-protected Growth Tracker.
- `/api/c310`, `/api/c310/[id]/pdf`: assessments and PDF reports.
- `/api/files`, `/api/files/[id]`: uploads and authenticated downloads.
- `/api/guide`: optional River Guide.

Data persists in `data/jaguar.sqlite` and private uploads in `data/uploads`, outside `public`. Override with `JAGUAR_DATA_DIR`. The existing `drizzle/` SQL migrations apply transactionally at first database access and a ledger prevents replay. Optimistic revisions and atomic evidence updates are preserved.

The ZIP includes source/schema, not the original hosted database or uploads. A new local database starts empty. For deployment, include `drizzle/`, mount a persistent data disk, and back up database and uploads. This adapter supports a single server; multiple replicas/serverless hosting require an external shared database and object storage.

## Production authentication

The original Sites gateway supplied trusted identity headers. Standalone Next.js has no such gateway. By default the migrated server ignores these headers and rejects anonymous API access; development sign-in is disabled in production.

Before launch, integrate an authentication provider in `app/chatgpt-auth.ts`, or configure an authenticated reverse proxy that strips incoming identity headers, sets verified `oai-authenticated-user-id` and `oai-authenticated-user-email`, owns the sign-in/sign-out paths and prevents direct access to Next.js. Only behind such a gateway set `JAGUAR_TRUST_AUTH_HEADERS=true`. Set `JAGUAR_APP_ORIGIN` to the public HTTPS origin for proxy deployments. The existing crew allowlist and roles remain enforced. Never enable header trust on a publicly accessible standalone server.

## Migration

The parent ZIP is untouched. Active scripts use `next dev`, `next build` and `next start`. Vinext, Workers, D1 and R2 are no longer runtime dependencies. Historical Sites/Vite configs and Worker test scripts remain as reference and are excluded from the active TypeScript project. Use npm and `package-lock.json`; the original pnpm lockfile describes the old runtime. Radix overrides keep its component versions aligned with the archived 1.6.7 release because newer registry entries referenced unavailable packages. See `README-sites-original.md` and `JAGUAR_HANDOVER.md` for historical hosting details and business rules.

`node scripts/check-next.mjs` runs an isolated development server and checks sign-in, role restrictions, shared records, assessments and upload privacy. After a build, `node scripts/check-next.mjs --production` verifies anonymous access and development sign-in are blocked in production. Both checks use temporary test storage.
