# Vaagai · Jaguar Crew beta

One crew starts on 5 October 2026. Lavanya Balaji is Project Lead; Premothan V is Crew/Team Lead; Surjith Kumar owns enterprise/workforce structures; Stephen Praveen A owns Core HR/lifecycle/testing; Abinesh S owns data/HDL/reconciliation. Other accounts, including the former Dharshini pilot account, cannot read or write crew APIs. The existing hosting audience is preserved.

## Operation

- The dashboard starts without sample activity. Leads create tasks with owners, deadlines, acceptance criteria and optional dependencies/Jira URLs.
- Boat Riders confirm completion of ten checking days once. Individual daily dates or evidence are unnecessary for this beta.
- Community posts/replies, tasks, RAID entries, meetings and evidence history are shared database records, not device-local data.
- Evidence accepts a file up to 10 MB or an HTTPS link. Files use private object storage; download checks membership and whether a file has been submitted. Resubmissions preserve versions. Leads review the latest version against expected/actual state and give visible feedback. Only lead acceptance changes the task to Accepted.
- Mentor 3C observations are practice feedback (0–5), not the weighted Employable Skill Matrix or certification. Ownership is independent.
- PM meetings use join/recording links and saved actions; Teams integration is deferred. Premothan can nominate the weekly admin.
- Crew settings let Lavanya add the Jira project URL and pause River Guide. Jira API synchronisation is not enabled.
- Bell notifications include shared activity and recipient-specific assignments/reviews. Weekday 17:30 IST Jira reminders are materialised on a workspace request from 5 October; the open workspace checks every minute. These are in-app reminders, not email/push delivery while the website is closed.
- Only Lavanya sees private scenario drafts before 20 October. Premothan receives access from 20 October (IST). Boat Riders see published scenarios only at their scheduled release time, never before 20 October. Filtering happens server-side and is reused for AI context.
- Three lives: 2/3 starting energy on Life 1, 3/3 on Lives 2 and 3. Leads record a verified breach with evidence and before/after state. One appeal is available within two working hours, counted Monday–Friday 10:00–18:00 IST. Upheld appeals restore the recalculated energy state. At Life 3/0 energy, PM/TL review is required.

## River Guide

Server-only OpenAI Responses API integration. Automatically includes the synthetic client brief, crew roles, visible task/RAID/evidence context and the member's last three exchanges. Uploaded file contents are not sent. Known credentials, emails and 12-digit identifiers are excluded/redacted; members must still use synthetic data. The guide cannot operate Oracle or approve work. Twenty questions/member/IST day; output cap 1,800 tokens; failed connections/quota requests refund the local allowance. Successful exchanges and provider usage are saved per member. Lavanya can pause the guide.

The new key is ignored locally and configured as a hosted secret. It is absent from source and generated bundles. A live connection check on 1 October 2026 returned `credit_balance_exhausted` / `insufficient_quota`; API billing credits must be added before live answers can work. The application distinguishes this from temporary rate limiting.

## Technical checks

`node scripts/check-jaguar.mjs` checks domain release dates and runs the built Worker against isolated local D1/R2 resources. It checks member/role restrictions, shared posts/replies, dependencies, evidence upload/download/version/rework/acceptance, RAID, private scenarios and AI context/kill-switch with a controlled provider response. No test records are written to the hosted workspace. `node node_modules/typescript/bin/tsc --noEmit` checks types.

Schema lives in `db/schema.ts`. Generated schema-only migration `drizzle/0000_cuddly_ma_gnuci.sql` is applied by hosting. Append migrations after deployment; do not rewrite applied migration history. Shared records use optimistic revisions for edits.

The supervised visual preview was unreachable in this environment. Build and Worker checks are used for publication; browser/mobile visual acceptance remains to be checked by the user.
