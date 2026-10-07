# Vaagai · Jaguar Crew

Full-stack Next.js 16, React 19, TypeScript and Tailwind CSS. The dashboard, Growth Tracker and C310 assessments use the App Router; backend handlers live in `app/api/**/route.ts` and run in the same Node.js server.

Frontend sections have real page routes: `/overview`, `/onboarding`, `/project`, `/tasks`, `/meetings`, `/community`, `/evidence`, `/raid`, `/c310`, `/growth`, `/control` and `/guide`. `/` also opens the overview. Sidebar links use Next.js navigation, direct links and refresh work, and old hash bookmarks are replaced with the equivalent page route. API endpoints remain under `/api/`.

## Local setup

Requires Node.js >=22.15.0, npm, and a MongoDB Atlas cluster (or another MongoDB replica set supporting transactions).

The npm commands enable Node's `--use-system-ca` flag so MongoDB and HTTPS connections use the operating system's trusted certificates alongside Node's bundled certificates. This fixes local certificate-chain errors while keeping TLS verification enabled. After changing `.env.local` or these startup commands, restart the development server. Run `npm run db:check` to test Atlas credentials and connectivity without printing secrets or modifying database records.

```powershell
cd D:\Projects\VaagaiJaguar\jaguar-crew
npm install
npm run dev
```

Open http://127.0.0.1:3000 and click Sign in with ChatGPT. In development this opens a local crew-member selector. Choose a member to test their existing permissions. This is development impersonation, not a real ChatGPT login. Sessions expire after eight hours or a server restart. Production disables this selector.

Copy `.env.example` to `.env.local` and configure `MONGODB_URI` and `MONGODB_DB=vaagai_jaguar` before using the APIs. River Guide requires a separately configured server-side OpenAI key. No credentials are bundled and this migration does not connect to the provider.

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

Data persists in MongoDB using the official Node.js driver. Five collections preserve the original tables: `crew_records`, `guide_usage`, `growth_workspace`, `c310_models`, and `c310_assessments`. JSON content is stored as BSON objects; original IDs are retained as both `_id` and `id`. Collection validators and indexes initialize on first access. Revision checks prevent stale saves, and evidence/energy changes use MongoDB transactions.

Private uploads persist in MongoDB GridFS (`uploads.files` / `uploads.chunks`) under their original `jaguar/<UUID>` keys. Downloads retain the existing authenticated access checks and stream from GridFS. The old SQLite database and uploads are preserved as migration sources and are no longer used by the running app.

## MongoDB migration

The source ZIP excludes live hosted records and uploads. The local SQLite database currently contains one notification and one initial scoring model, with no growth records, assessments, guide usage or uploads. This is not a backup of the live site.

A complete hosted migration requires a full D1 SQLite export (or untruncated five-table JSON export), every referenced R2 file, and authoritative table counts/file inventory from the hosting administrator or Sites support. The original chat verified that its available interface truncates large JSON records and cannot export R2 files; it did not create a complete export.

With the source placed privately under `data/`, run:

```powershell
npm run db:migrate -- --source data/export.sqlite --uploads data/export-uploads --dry-run
npm run db:migrate -- --source data/export.sqlite --uploads data/export-uploads --apply
```

The default source is `data/jaguar.sqlite`, with files in `data/uploads`. Both storage layouts are accepted: `uploads/jaguar/<UUID>` (export) and `uploads/<UUID>` (legacy local storage). JSON sources must contain all five table names with full row arrays. The migration validates fields, IDs, revisions, JSON and MongoDB document sizes, checks every upload's size/SHA-256, backs up SQLite and writes records/inventory into an ignored timestamped `data/migration/` folder. Review counts against the provider's inventory before applying; the script cannot detect records that a provider omitted from its export.

Apply inserts missing records/files, skips exact matches, stops on destination conflicts, and verifies every imported record and file. Original data is never deleted or overwritten. An interrupted import can leave a subset inserted; correct the issue and rerun the same export. Keep the original site unchanged during the final export and import.

## Vercel environment

Set `MONGODB_URI` to the Atlas application's connection string and `MONGODB_DB` to `vaagai_jaguar`. Keep credentials server-side; do not use `NEXT_PUBLIC_` names. Atlas must allow the deployed server's network access, and its database user needs read/write plus collection/index creation permissions. Use a separate database for Preview so preview changes cannot affect Production. Do not add `JAGUAR_DATA_DIR` to Vercel.

Keep `JAGUAR_TRUST_AUTH_HEADERS=false` on public Vercel deployments. MongoDB persistence is ready for serverless hosting, but production authentication still needs the integration described below. Environment variables configure connections; they do not migrate records. Run the migration separately before launch.

New evidence uploads are limited to 4 MB to leave room for multipart overhead within [Vercel's 4.5 MB request limit](https://vercel.com/docs/functions/limitations). Historical larger uploads can be imported offline and retain their original bytes; verify their streamed downloads on the deployed site.

## Production authentication

The original Sites gateway supplied trusted identity headers. Standalone Next.js has no such gateway. By default the migrated server ignores these headers and rejects anonymous API access; development sign-in is disabled in production.

Before launch, integrate an authentication provider in `app/chatgpt-auth.ts`, or configure an authenticated reverse proxy that strips incoming identity headers, sets verified `oai-authenticated-user-id` and `oai-authenticated-user-email`, owns the sign-in/sign-out paths and prevents direct access to Next.js. Only behind such a gateway set `JAGUAR_TRUST_AUTH_HEADERS=true`. Set `JAGUAR_APP_ORIGIN` to the public HTTPS origin for proxy deployments. The existing crew allowlist and roles remain enforced. Never enable header trust on a publicly accessible standalone server.

## Migration

The parent ZIP is untouched. Active scripts use `next dev`, `next build` and `next start`. Vinext, Workers, D1 and R2 are no longer runtime dependencies. Historical Sites/Vite configs and Worker test scripts remain as reference and are excluded from the active TypeScript project. Use npm and `package-lock.json`; the original pnpm lockfile describes the old runtime. Radix overrides keep its component versions aligned with the archived 1.6.7 release because newer registry entries referenced unavailable packages. See `README-sites-original.md` and `JAGUAR_HANDOVER.md` for historical hosting details and business rules.

`node scripts/check-next.mjs` runs an isolated development server and checks sign-in, role restrictions, shared records, assessments and upload privacy. After a build, `node scripts/check-next.mjs --production` verifies anonymous access and development sign-in are blocked in production. Both checks start an isolated local MongoDB replica set and never use Atlas. The development check requires the existing Next.js dev server to be stopped first because Next.js shares its development lock. `npm test` also starts an isolated replica set; its first run downloads MongoDB's official test binary.
