# Google sign-in for Vaagai

The website authenticates through email/password, or Google using Auth.js, with MongoDB sessions.
No ChatGPT account or authentication gateway is required. Only active emails in
`approved_users` can sign in. Google access also requires a completed first password change. Existing crew emails and roles are inserted automatically
on first access; subsequent runs preserve changes and disabled users.

## Google configuration

1. In Google Cloud Console, create/select a project and open Google Auth Platform.
2. Configure branding and audience. Use External if members use personal Gmail
   accounts. While the app is in Testing, add every crew email as a test user.
3. Create an OAuth client of type Web application.
4. Add the exact authorized redirect URI for the production domain:
   `https://YOUR-DOMAIN/api/auth/callback/google`.
5. For development, also add `http://localhost:3000/api/auth/callback/google`
   (or `http://127.0.0.1:3000/api/auth/callback/google` if using that origin).
   The browser origin and callback URI must match exactly.
6. Copy the client ID and client secret into server environment variables below.
   Do not commit credentials or paste them into chat.

## Vercel environment variables

| Key | Value |
| --- | --- |
| `MONGODB_URI` | Existing working Atlas connection string |
| `MONGODB_DB` | `vaagai_jaguar` |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_SECRET` | A randomly generated secret, at least 32 bytes |
| `AUTH_URL` | Exact website origin, e.g. `https://vaagai-zeta.vercel.app` |
| `JAGUAR_APP_ORIGIN` | Same exact origin as `AUTH_URL` |

Generate AUTH_SECRET locally with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
Set these for Production and redeploy. Preview deployments need their own matching
origin and Google redirect registration; do not use a production origin for arbitrary
preview domains. The old `JAGUAR_TRUST_AUTH_HEADERS` setting is no longer used.
Keep MongoDB network access configured for the deployed server.

## Access administration

The existing owner signs in with their approved Google email, then opens
**Manage access** in the workspace or visits `/admin/users`. They can add an email,
assign a role and temporary password, and disable access. Share the website link, approved email and temporary password directly with the member; invitation email delivery is not included. An owner cannot disable or
demote their own account. Google must report the email as verified.

Existing approved users receive `Chc@2025` as their temporary password only when no password hash exists. They sign in at `/signin` using their approved email (the username) and this password, then choose a different password of 8–128 characters. Setup sessions cannot read or write project APIs. **Continue with Google** is always displayed above the password fields and is disabled for first-time accounts. After completion, users can use their new password or enter their email to enable Google sign-in. Google OAuth still requires the registered callback and environment variables above; password sign-in works independently when Google is unavailable. Both methods require a working MongoDB connection.

An owner can enter a new temporary password in an existing user's **Reset temporary password** field; leaving it empty preserves their password. Resets revoke all existing password and Google sessions. Password hashes are never displayed or returned to clients. `password_sessions` stores hashed session tokens and `password_attempts` stores rate-limit counters; both have expiry indexes. Existing approvals are initialized on first access after deployment, without resetting a password already changed.

To initialize existing approvals before first login, run `npm run auth:initialize` against the intended database. This inserts missing original crew accounts and assigns the temporary credential only to accounts without a password hash. Reruns preserve completed passwords, edited roles and disabled access. It prints counts only.

Account disabling and role changes apply to the next protected request. Sessions
last up to eight hours and are removed on sign-out. MongoDB stores approved users,
Google account links, and sessions in separate `approved_users`, `auth_users`,
`auth_accounts`, and `auth_sessions` collections. The original project records stay
in their existing collections.

The old sign-in/sign-out URLs redirect to the new production pages. The development
member selector remains development-only for local testing; it cannot create a
production session.

## Deployment verification

1. An existing crew account can sign in and see the expected role.
2. An unapproved Google account receives an access-denied message.
3. A learner cannot open `/admin/users` or access owner-only APIs.
4. Disable a test account and confirm its next API request is rejected.
5. Sign out and confirm protected requests return 401.

Live Google consent/callback testing requires the configured OAuth credentials and
registered domain. Automated tests use a temporary MongoDB instance, never Atlas.
