# Authentication for Vaagai

The workspace uses approved email addresses and passwords. There is no public signup or automatic invitation/reset email. MongoDB must be configured through server-only `MONGODB_URI` and `MONGODB_DB` variables. Deploy behind HTTPS. `JAGUAR_APP_ORIGIN`, when set, must match the public website origin.

## Login and first-time setup

1. An owner opens `/admin/users`, approves the member and assigns a temporary password.
2. The owner shares the website URL, approved email and temporary password directly.
3. The member signs in at `/signin`. A temporary credential grants only a 15-minute setup session.
4. `/change-password` requires matching passwords of 8–128 characters, different from the temporary password. The workspace and project APIs remain blocked until this is complete.
5. Completing setup revokes previous sessions and creates a full session for the current tab.

Existing crew approvals are inserted once. Existing accounts without a password hash receive the bootstrap temporary credential defined in `lib/password-bootstrap.mjs`; changed passwords, disabled accounts and edited roles are preserved. `npm run auth:initialize` initializes the intended database without resetting existing passwords.

## Tabs and session expiry

Each tab has a random, non-secret selector in sessionStorage. The session credential is held separately in an HTTP-only cookie named for that selector. Production cookies use the `__Host-` prefix, Secure, SameSite=Strict, and Path=/. JavaScript never receives the session credential, and MongoDB stores only its SHA-256 hash.

Protected APIs require the selector header and its matching cookie. Owner server actions receive the selector explicitly and verify the matching server session. Workspace pages render a public shell; private records and the owner roster load only after session verification. Old shared password and Google cookies cannot authenticate workspace requests.

A new tab starts signed out. Web Locks detect copied selectors in duplicated tabs. Refreshing the same tab preserves login. Normal full navigations or restored pages start a fresh selector; internal navigation uses Next links to retain the current tab. Without Web Locks, full reloads require login as a conservative fallback. Browser session restoration behavior varies; the server always enforces the limits below even when a browser restores a page.

- Full sessions expire after **30 minutes of inactivity** or **8 hours after login**, whichever comes first.
- The page checks the session every 15 seconds and when returning to a visible tab. Actual keyboard, pointer, scroll or touch activity can renew the inactivity deadline.
- Background polling never renews inactivity. Activity cannot revive an expired session or extend the 8-hour maximum.
- Session end redirects to sign-in with an explanation. A connection failure hides protected content and provides retry instead of claiming the password is wrong.
- Sign-out deletes only the current tab's session and cookie. Other tabs remain signed in.
- Closing a tab abandons its selector. Its server record/cookie can remain until expiry; closing the tab does not reliably deliver a server logout request. Expiry is enforced in queries, independently of MongoDB TTL cleanup.
- Disabling access or resetting a password invalidates the user's sessions. Approval, role, password version, setup state and expiry are checked on protected requests.

These settings are centralized in `lib/session-policy.ts`. Deploying this change requires existing users to sign in again; old sessions have no tab selector/idle deadline.

## Forgotten passwords and owner access

The member contacts their Project Lead. The owner opens `/admin/users`, expands the member and enters **Reset temporary password**, then saves and shares that temporary password directly. The reset revokes previous sessions and requires password setup again. Leaving the field empty preserves the password. Password hashes are never sent to the browser.

An owner can change their own password using their current password. The current tab receives a new session and other sessions are revoked. An owner cannot disable or demote their own account. A locked-out sole owner still requires an administrator recovery operation; self-service email recovery is not implemented.

Google OAuth configuration and its historical account collections remain in the source, but Google/shared sessions do not grant workspace access under the tab-specific password flow. There is no Google button on the sign-in page.

## Validation

- `npm run typecheck`
- `npm test` uses a disposable local MongoDB replica set and covers setup, reset revocation, roles, independent tab cookies, logout, idle expiry and absolute expiry.
- `npm run build`
- `node --use-system-ca scripts/check-next.mjs --production` runs the production HTTP authentication checks against a disposable database.
- Add `--serve` to retain that isolated preview for browser testing. It prints a synthetic test account and never connects to Atlas.

The legacy development impersonation endpoint is retained for API integration fixtures only and remains disabled in production; use `/signin` to review the actual browser workflow.
