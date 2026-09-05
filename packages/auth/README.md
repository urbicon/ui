# @urbicon-ui/auth

Zero-runtime-dependency authentication, user-management, and notification system for SvelteKit. Part of the vertical Urbicon UI platform.

All crypto is implemented with the Web Crypto API — no `bcrypt`, no `jsonwebtoken`, no Web-Push vendor SDK. Server-side handler factories, a Handle-Hook for SvelteKit, an adapter interface (Prisma adapter included), and 14 blocks-based UI components covering login, registration, password reset, email verification, invitation management, passkeys, account management, active sessions, two-factor (TOTP), and notifications.

> **Maturity:** core **stable** (hardened for production SvelteKit deployments, including persistent-store adapters for challenges / rate-limits / refresh tokens); the newest self-service surfaces — account management, session listing, TOTP 2FA — are **`beta`**. See [AUTH.md — Known Limitations](https://ui.urbicon.de/auth/guide#known-limitations--security-gaps) for the residual gap list — the same reference also ships inside this package as [`./docs/AUTH.md`](./docs/AUTH.md).

> **New here?** Jump to the [Quickstart](#stage-1--quickstart-dev-5-minutes) — a copy-paste setup that runs in five minutes with no database or mail server. Then graduate to [Production](#stage-2--production) and [Advanced](#stage-3--advanced).

## Installation

This package ships inside the Urbicon UI monorepo. Install from repo root:

```bash
bun install
```

Peer dependencies: `svelte` (^5), `@sveltejs/kit`, `@urbicon-ui/blocks`, `@urbicon-ui/i18n`.
Runtime dependencies: **none**.

**Stylesheet.** The components emit Tailwind classes, and a Tailwind build never scans
`node_modules` on its own — each package ships a stylesheet whose `@source` directive points
Tailwind at its components. Import this package's stylesheet next to the blocks one, in the
file that holds your Tailwind import:

```css
/* app.css */
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css'; /* tokens + the blocks @source */
@import '@urbicon-ui/auth/style/index.css'; /* the auth @source — no tokens of its own */
```

Without the auth line the components still render, but every class that lives only in
this package (the `sm:` layouts of the pages and managers, the link colour of the auth
pages) is missing from the compiled CSS. A project that mounted the components before this
stylesheet existed adds the one line and is done.

**Runtime target: Node.js ≥ 20 or Bun.** All crypto is Web Crypto (`globalThis.crypto`, global since Node 20), but password hashing and the TOTP secret cipher use Node's `Buffer` — which puts the login/register path on a Node/Bun runtime. Edge/Workers/Deno-deploy work only behind a `Buffer` polyfill (e.g. Cloudflare `nodejs_compat`); the Web Crypto paths themselves are edge-clean.

## Feature Matrix

| Area             | Capability                                                                                                                                                                                                                                                                                                                                     | Standards               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Sessions         | JWT (HMAC-SHA256), httpOnly/secure/sameSite=lax cookie, 7-day TTL (shortens to 15 min when refresh-rotation is on), `tokenVersion` invalidation, opt-in key rotation via `kid` + `previousSecrets` (since v0.10.0)                                                                                                                             | —                       |
| Refresh tokens   | Opt-in rotation via `config.refreshToken` + `repos.refreshToken`; 15-min access / 30-day rotating refresh, token families, SHA-256-hashed storage, reuse-detection (replaying a rotated token revokes the whole family), transparent rotation in `createAuthHandle` and explicit `createRefreshHandler` (since v0.11.0)                        | —                       |
| Passwords        | PBKDF2 (600k iter, SHA-256), legacy bcrypt auto-upgraded via dual-verify                                                                                                                                                                                                                                                                       | —                       |
| Passkeys         | Registration + authentication, counter check for cloning, ES256 + RS256, pluggable challenge store (in-memory default, optional Redis/Prisma/etc. via `ChallengeStore`), User-Verification (UV) **enforced by default** — `requireUserVerification: false` opts out (the option itself since v0.10.0)                                                                             | WebAuthn Level 2, FIDO2 |
| Two-factor (2FA) | Opt-in TOTP second factor via `config.twoFactor` + `repos.backupCode`: zero-dep RFC-6238/4226 codes, AES-256-GCM-encrypted secret at rest, signed short-lived pending-2FA cookie between password and code, single-use SHA-256 backup codes, strict per-step rate-limit. Login two-step + `TwoFactorManager` UI. Passkey logins are not gated — a claim that rests on passkey UV enforcement being on by default. | RFC 6238, 4226, 4648    |
| Web Push         | ECDH P-256 + HKDF + AES-128-GCM, VAPID JWT signing, opt-in per-endpoint rate-limit (since v0.10.0)                                                                                                                                                                                                                                             | RFC 8291, 8292, 8188    |
| Email            | Transport interface, Lettermint adapter + console logger (dev)                                                                                                                                                                                                                                                                                 | —                       |
| CSRF             | Origin-header validation (always on for requests routed through `createAuthHandle`) + opt-in Double-Submit-Cookie (since v0.8.4), optional `__Host-` cookie prefix (`csrf.useHostPrefix`) against subdomain injection                                                                                                                          | —                       |
| Rate-limit       | Pluggable store (in-memory default, optional Redis/Prisma/etc. adapter via `RateLimitStore`), configurable window/max                                                                                                                                                                                                                          | —                       |
| Security headers | Always on: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`. Configurable via `config.securityHeaders`: HSTS (default `max-age=63072000; includeSubDomains`, only in a [secure deployment](docs/AUTH.md#secure-deployment) — no `cookieSecure: false` on any cookie config) + CSP hook (default `frame-ancestors 'none'`) | —                       |

## Package Exports

| Export                                         | Condition      | Contents                                                    |
| ---------------------------------------------- | -------------- | ----------------------------------------------------------- |
| `@urbicon-ui/auth`                             | Universal      | Client stores, components, types                            |
| `@urbicon-ui/auth/server`                      | Server         | Handlers, auth core, adapters, i18n                         |
| `@urbicon-ui/auth/server/adapters/prisma`      | Server         | Prisma adapter factory (`createPrismaRepos`)                |
| `@urbicon-ui/auth/server/adapters/in-memory`   | Server         | In-memory adapter (`createInMemoryRepos`, per-repository factories on a `createInMemoryStore()`) — dev/test |
| `@urbicon-ui/auth/server/adapters/conformance` | Server (tests) | Adapter conformance suite (`describeRepositoryConformance`), wired to vitest |
| `@urbicon-ui/auth/server/adapters/conformance-core` | Server (tests) | The same suite without a runner import — pass `{ runner: { describe, it, expect } }` (bun:test as-is; jest needs `expect: (a) => expect(a)`) |
| `@urbicon-ui/auth/server/email/lettermint`     | Server         | Lettermint email transport                                  |
| `@urbicon-ui/auth/server/email/console`        | Server         | Console email transport (dev only)                          |
| `@urbicon-ui/auth/sw`                          | Service worker | Push + notification-click handlers                          |
| `@urbicon-ui/auth/i18n/en`                     | Universal      | English locale bundle                                       |
| `@urbicon-ui/auth/i18n/de`                     | Universal      | German locale bundle                                        |

## UI Components

All use `@urbicon-ui/blocks` primitives and honour `unstyled` + `slotClasses` + snippet overrides.

| Component              | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| `LoginPage`            | Login form with optional passkey entry point    |
| `RegisterPage`         | Registration form (optionally invitation-gated) |
| `ForgotPasswordPage`   | Password-reset request                          |
| `ResetPasswordPage`    | Password-reset with confirmation                |
| `VerifyEmailPage`      | Auto-verifying email confirmation               |
| `InvitationManager`    | Admin invitation list + create/revoke           |
| `PasskeyManager`       | WebAuthn credential management                  |
| `AccountSettings`      | Change name/email/password + delete account     |
| `SessionManager`       | List active sessions + sign out devices         |
| `TwoFactorManager`     | Enrol/disable TOTP 2FA + show backup codes      |
| `NotificationCenter`   | Notification list with read/delete              |
| `NotificationBadge`    | Unread-count badge                              |
| `NotificationListener` | Headless SSE listener                           |
| `PushPermissionPrompt` | Push-notification opt-in                        |

## Getting Started

Three stages, each building on the last: a five-minute dev quickstart, a production
hardening pass, then the advanced surface. **`createAuthHandle` is mandatory in every
stage** — it hydrates the session, guards routes, applies the response security headers,
and enforces CSRF. Skip it and those protections are simply off.

### Stage 1 — Quickstart (dev, 5 minutes)

Runs with **no database and no mail server**: the in-memory adapter keeps everything in
heap Maps, the console transport prints emails to your terminal. State is wiped on every
restart — **dev only, never production**.

**1. Dependencies** — `src/lib/server/auth-setup.ts`:

<!-- typecheck -->
```typescript
import { createAuthDeps } from '@urbicon-ui/auth/server';
import { createInMemoryRepos } from '@urbicon-ui/auth/server/adapters/in-memory';
import { createConsoleEmailTransport } from '@urbicon-ui/auth/server/email/console';

export const authDeps = createAuthDeps({
  config: {
    jwt: { secret: 'dev-secret-change-me', cookieSecure: false }, // cookieSecure:false = http dev
    appUrl: 'http://localhost:5173', // trusted base for email links — required
    routes: { afterLogin: '/', loginPage: '/auth/login' }
  },
  repos: createInMemoryRepos(),
  email: createConsoleEmailTransport() // dev only — prints emails to the terminal
});
```

`createInMemoryRepos()` is a fresh `createInMemoryStore()` with every repository built on it.
Need only a piece — the refresh-token repository beside a user store of your own? Build that
factory on a store handle: `createInMemoryRefreshTokenRepository(createInMemoryStore())`.
Repositories on one store share its rows, and `user.delete` erases across all of them. The
store carries the role type — `createInMemoryStore<'ADMIN' | 'USER'>()` — and every factory
infers it from the handle; a role-typed factory on an untyped store is a type error.

`createAuthDeps` fills in **secure brute-force defaults automatically** (login rate-limit
5 / 15 min + lockout 5 / 15 min) — even the quickstart isn't an open door. **Every**
`rateLimit` key gets a default, and configuring some keys is a merge rather than a
replacement (so `rateLimit: { register }` never silently leaves login unprotected); the
per-key numbers and their reasoning are in
[docs/AUTH.md](docs/AUTH.md#stage-1--quickstart-dev). The lockout default applies only
when you set neither `rateLimit` nor `lockout`. Opt out of either explicitly with `null`.
A failed attempt stops counting once it is `lockout.decayMinutes` old (default 60), so
typos on separate days never add up to a lockout.
A `cookieSecure: false` on the session, CSRF **or** refresh cookie marks this as a
non-HTTPS dev deployment, which suppresses the production hardening warnings (and HSTS)
you'd otherwise see, and drops the `__Host-` prefix from the 2FA and passkey cookies so
the browser keeps them. Set it on every cookie config you declare, or on none — a mix is
warned about at wiring time ([docs/AUTH.md → Secure deployment](docs/AUTH.md#secure-deployment)).

**2. Hook** — `src/hooks.server.ts`:

<!-- typecheck -->
```typescript
import { createAuthHandle } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';

export const handle = createAuthHandle({ config: authDeps.config, repos: authDeps.repos });
```

> **Machine callers** — a cron runner posting with a secret header, an OAuth token endpoint,
> an API-key route — send no `Origin`, so the handle's CSRF gate answers them `403`. Declare
> them in `csrf: { exempt: ['/api/cron/'] }`: the hook then resolves no session for them
> (`locals.user` is `null`) and they must authenticate every request without the session
> cookie — a route that reads it itself keeps working with the gate off, so never exempt a
> cookie-authorised route (`/api/auth/` is refused). What SvelteKit's own kernel CSRF gate
> still does to form-encoded ones, and its build-time off-switch:
> [AUTH.md → Machine callers](https://ui.urbicon.de/auth/guide#machine-callers).

**3. API route stubs** — one file per handler, e.g. `src/routes/api/auth/login/+server.ts`:

<!-- typecheck -->
```typescript
import { createLoginHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';
export const { POST } = createLoginHandler(authDeps);
```

Repeat for `logout`, `register`, `forgot-password`, `reset-password`, `verify-email`, `me`, and
`password-policy` (`createPasswordPolicyHandler` — it publishes `config.password`, so the sign-up
and reset forms gate on the same rules the server checks; without it they fall back to the package
defaults, min 8 and no character classes).

**4. UI page** — `src/routes/auth/login/+page.svelte`:

```svelte
<script>
  import { LoginPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
  import { goto } from '$app/navigation';
</script>

<LoginPage t={en} onSuccess={() => goto('/')} />
```

You now have a working email/password flow. Registration is invitation-gated, so seed one
invitation first —
`await authDeps.repos.invitation.create({ email: 'you@example.com', role: 'USER', invitedById: 'seed' })` —
then register, watch the verification email print to your terminal, and log in.

### Stage 2 — Production

Swap the two dev pieces — in-memory → Prisma, console → a real transport — and turn on the
hardening layers. Everything here is **opt-in and additive**: the Stage 1 hook and route
stubs are unchanged; you're only growing the config.

<!-- typecheck -->
```typescript
// src/lib/server/auth-setup.ts
import { createAuthDeps } from '@urbicon-ui/auth/server';
import { createPrismaRepos } from '@urbicon-ui/auth/server/adapters/prisma';
import { createLettermintTransport } from '@urbicon-ui/auth/server/email/lettermint';
import { APP_URL, JWT_SECRET, LETTERMINT_TOKEN } from '$env/static/private';
import { prisma } from './prisma';
import { appLogger } from './logging'; // your own AuthLogger { warn, error }

type AppRole = 'ADMIN' | 'USER';

export const authDeps = createAuthDeps<AppRole>({
  config: {
    jwt: { secret: JWT_SECRET }, // cookieSecure defaults true → HTTPS + auto HSTS
    appUrl: APP_URL, // trusted base for email links — never request.url; a private var, so no PUBLIC_ prefix
    email: { from: 'Acme <auth@acme.example>' }, // default sender for all auth emails
    csrf: { doubleSubmit: true }, // token layer on top of the always-on Origin check — only with header-capable clients (see checklist)
    refreshToken: { accessTokenTtl: '15m', refreshTokenTtl: '30d' }, // rotating refresh
    rateLimit: {
      login: { windowMs: 900_000, max: 5 },
      forgotPassword: { windowMs: 3_600_000, max: 3 }, // reset *request* (email send)
      resetPassword: { windowMs: 3_600_000, max: 5 } // reset *consume* (token redemption)
    },
    lockout: { maxAttempts: 5, durationMinutes: 15, decayMinutes: 60 }, // decay: how long a failure counts
    tokenTtl: { emailVerification: '24h', passwordReset: '1h', emailChange: '1h' }, // mailed link windows
    routes: { afterLogin: '/', loginPage: '/auth/login' },
    logger: appLogger
  },
  // Same sink for both: wiring diagnostics from the adapter (a missing Prisma
  // model drops its feature) land with the rest of the auth logs.
  repos: createPrismaRepos<AppRole>(prisma, { logger: appLogger }),
  email: createLettermintTransport({ token: LETTERMINT_TOKEN }) // sends via the Lettermint v2 API
});
```

Add a `refresh` route stub (`createRefreshHandler`) once rotation is on. With the
`RefreshToken` model in your Prisma schema (see `prisma/auth-schema.prisma`), the handle
hook rotates the refresh cookie whenever the access token expires and revokes the old one;
replaying a revoked token triggers **family-wide** revocation — a stolen-token scenario
logs every session in that family out. Two requests rotating the same token at once (a
browser's parallel tabs) are tolerated for ten seconds — but only while the family is still
live: after a family-wide revocation or a "sign out everywhere", the spent token is refused
inside that window as well.

#### Production-readiness checklist

Mirrors [AUTH.md → Production-Readiness Checklist](https://ui.urbicon.de/auth/guide#production-readiness-checklist):

- [ ] **HTTPS enforced** — cookies default to `secure: true`; HSTS is emitted automatically as long as no cookie config says `cookieSecure: false` (the [secure-deployment signal](https://ui.urbicon.de/auth/guide#secure-deployment)).
- [ ] **CSRF Double-Submit decided** (`csrf.doubleSubmit: true`) — only when every cookie-auth mutation sends the `x-csrf-token` header (package stores/components or `csrfFetch`). SvelteKit **Remote Functions** and no-JS form posts can't send it — with those in play keep it `false`; the always-on Origin check is the complete layer there. Optionally `useHostPrefix: true` (HTTPS-only) — then set `useHostPrefix: true` on the client stores/components too.
- [ ] **Refresh-token rotation on** (`refreshToken: {}` + `repos.refreshToken`) — non-breaking, recommended.
- [ ] **Rate-limit + lockout** active (defaulted by `createAuthDeps`; tune per handler). Use a persistent `RateLimitStore` when running >1 instance.
- [ ] **Persistent stores** for challenges / refresh tokens / rate limits at >1 instance.
- [ ] **CSP** tuned to your app (`securityHeaders.csp`) — the default only blocks framing.
- [ ] **`appUrl`** set to the real public origin; **`JWT_SECRET`** from a secret store, with a `keyId` + `previousSecrets` rotation runbook ready.
- [ ] **Monitoring** on auth-handler latency + error rate; wire `hooks.onPasswordResetFailed` to your error tracker so a broken mail transport doesn't silently lock users out of recovery.
- [ ] **Machine callers declared** (cron, OAuth token, API-key routes) in `csrf: { exempt }` on `createAuthHandle`, each authenticating itself; for the form-encoded ones also `kit.csrf: { trustedOrigins: ['*'] }` in `svelte.config.js` (SvelteKit's kernel gate, built apps only) with every cookie-auth mutating route still flowing through the handle. See [AUTH.md → Machine callers](https://ui.urbicon.de/auth/guide#machine-callers).

#### CSRF on the client

With `csrf.doubleSubmit` enabled, **`createAuthHandle` is what sets the `urbicon_csrf`
cookie and rejects mutating requests without a matching `x-csrf-token` header** — it is not
optional for CSRF. The bundled stores and components already echo the header. For your own
client fetches use the exported `csrfFetch`:

```svelte
<script>
  import { csrfFetch } from '@urbicon-ui/auth';

  async function submit() {
    const res = await csrfFetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        /* order fields */
      })
    });
  }
</script>
```

Or use `withCsrfHeader(init)` / `readCsrfToken()` directly in a custom fetch wrapper.
Cookie/header names are configurable via `config.csrf.cookieName` / `config.csrf.headerName`
(pass the same names to the client `csrf` config).

### Stage 3 — Advanced

- **Custom persistence adapter** — anything beyond Prisma/in-memory (Drizzle, Kysely, raw SQL): follow the [Adapter Authoring Guide](https://ui.urbicon.de/auth/guide#adapter-authoring-guide) and validate it against the exported conformance suite so its atomic claims are _provably_ race-safe.
- **JWT key rotation** — set `jwt.keyId` + `jwt.previousSecrets` to roll the signing secret without logging everyone out; old sessions verify against the previous secret until they expire.
- **Passkeys (WebAuthn)** — wire the `createPasskeyHandlers(deps, webauthn)` route group with a `webauthn: WebAuthnConfig` (pass a persistent `challengeStore` at >1 instance; UV enforcement is **on by default** — `requireUserVerification: false` opts out, and combined with `config.twoFactor` that makes a passkey login single-factor, which the factory warns about at wiring time; upgrading an app whose users hold UV-less credentials needs the [upgrade note](https://ui.urbicon.de/auth/guide#upgrade-note--user-verification-is-enforced-by-default) first), and drop in `<PasskeyManager>` + the passkey entry point on `<LoginPage mode="both">`.
- **Notifications & Web Push** — register domain events server-side and listen client-side:

<!-- typecheck -->
```typescript
// Server: register domain events
import { createNotificationRegistry } from '@urbicon-ui/auth/server';

const registry = createNotificationRegistry();
registry.register({
  key: 'order_shipped',
  title: (data) => `Order ${data.orderId} shipped`,
  url: (data) => `/orders/${data.orderId}`, // ⚠️ untrusted at click time — see note
  recipients: async (data) => [data.userId as string] // data is Record<string, unknown>
});
```

```svelte
<!-- Client: listen + display -->
<script>
  import {
    NotificationListener,
    NotificationCenter,
    createNotificationStore
  } from '@urbicon-ui/auth';
  const store = createNotificationStore();
</script>

<NotificationListener onNotification={(n) => store.add(n)} />
<NotificationCenter
  t={en}
  notifications={store.notifications}
  onMarkAsRead={(id) => store.markAsRead(id)}
/>
```

- **Account management (self-service)** — let a signed-in user manage their own account. Mount the four handlers under `/api/auth/account/*` and drop in `<AccountSettings>`:

<!-- typecheck -->
```typescript
// src/routes/api/auth/account/change-password/+server.ts
import { createChangePasswordHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';
export const { POST } = createChangePasswordHandler(authDeps);
// …and change-email, profile, delete the same way; plus a verify-email-change
// route (createVerifyEmailChangeHandler) behind the link sent to the new address.
```

```svelte
<script>
  import { AccountSettings } from '@urbicon-ui/auth';
  let { data } = $props(); // data.user from your load fn (locals.user)
</script>

<AccountSettings user={data.user} onDeleted={() => goto('/')} />
```

All four mutations are **re-auth gated** (current password). change-password keeps the
current device signed in while logging out every other session; change-email verifies the
**new** address and is account-enumeration safe (always "check your inbox"); delete-account
hard-deletes and fires `hooks.onBeforeAccountDelete` **before** erasing so you can archive.

- **Active-session listing** — show the user their sessions and let them sign devices out. **Requires `refreshToken` rotation** (a session is a token family). Mount the route group and drop in `<SessionManager>`:

```typescript
// src/lib/server/auth-setup.ts
import { createSessionsHandlers } from '@urbicon-ui/auth/server';
export const sessions = createSessionsHandlers(authDeps);

// src/routes/api/auth/sessions/+server.ts
export const GET = sessions.list.GET;
// + sessions/revoke/+server.ts        → export const POST = sessions.revoke.POST;
//   sessions/revoke-others/+server.ts → export const POST = sessions.revokeOthers.POST;
```

```svelte
<script>
  import { SessionManager } from '@urbicon-ui/auth';
</script>

<SessionManager apiPath="/api/auth/sessions" />
```

Revokes are ownership-scoped (a guessed family id can't sign out another user). The IP is shown only if you set `config.sessions = { storeIp: true }` (GDPR opt-in); the user-agent alone drives the "Browser · OS" device label.

- **Two-factor (TOTP)** — add an authenticator-app second factor. Set `config.twoFactor` (the `encryptionKey` is required — high-entropy, stable, e.g. 32 random bytes base64), provide `repos.backupCode` (the shipped adapters include it), mount the route group, and add `<TwoFactorManager>` for enrolment plus the verify path the two-step `<LoginPage>` posts to:

```typescript
export const authDeps = createAuthDeps({
  config: {
    /* …jwt, appUrl… */
    twoFactor: { encryptionKey: process.env.TWO_FACTOR_KEY! } // required when 2FA is on
  },
  repos, // must include repos.backupCode (createInMemoryRepos / createPrismaRepos do)
  email
});
```

```typescript
// src/lib/server/auth-setup.ts
import { createTwoFactorHandlers } from '@urbicon-ui/auth/server';
export const twoFactor = createTwoFactorHandlers(authDeps);

// src/routes/api/auth/account/2fa/setup/+server.ts
export const POST = twoFactor.setup.POST;
// + account/2fa/enable  → twoFactor.enable.POST,
//   account/2fa/disable → twoFactor.disable.POST, and the PUBLIC
//   2fa/verify route    → twoFactor.verify.POST — the second login step.
```

```svelte
<script>
  import { TwoFactorManager } from '@urbicon-ui/auth';
  let { data } = $props(); // data.user from locals.user; user.totpEnabled drives the UI
</script>

<TwoFactorManager user={data.user}>
  {#snippet qr({ uri })}<MyQrCode value={uri} />{/snippet}
</TwoFactorManager>
```

Setup returns the `otpauth://` URI + Base32 secret (the core ships **no** QR encoder to stay zero-dep — render it via the `qr` snippet, or let the user enter the key manually). Enrolment is two-step (setup → confirm a code), and enabling returns one-time backup codes. The secret is stored **AES-256-GCM-encrypted**; disable is password re-auth gated. The login handler gates automatically on `user.totpEnabled` — no extra wiring. Passkey logins are **not** gated, which rests on `webauthn.requireUserVerification` being enforced (its default): without UV a passkey is possession alone, and a passkey login would be single-factor for a TOTP user. **`encryptionKey` has no rotation overlap** — changing it locks every TOTP user out and blocks re-enrolment, leaving a backup code — or a passkey, which is not TOTP-gated — as the way in ([key-rotation runbook](https://ui.urbicon.de/auth/guide#key-rotation-runbook-twofactorencryptionkey)). `createAuthDeps` injects a strict `rateLimit.twoFactor` default for the brute-force-critical verify step. **The verify route must be public** (default public routes already cover `/api/auth/`); make sure your route guard doesn't require a session for it.

- **Federated identity / SSO** — one deployment becomes the identity provider (ES256 tokens + `createJWKSHandler` serving the JWKS), sibling apps under the same parent domain verify with `createFederatedAuthHandle` and decide access themselves in `resolveUser` (identity ≠ authorization — the IdP's `role` never crosses the boundary). Setup for both sides, the key-rotation runbook, and the deliberate v1 limits: [AUTH.md → Federated Identity (SSO)](https://ui.urbicon.de/auth/guide#federated-identity-sso).

### Security notes worth pinning

- **`notification.url` is untrusted at navigation time.** It originates from your event registry, but treat it as data: validate/allow-list it before passing it to `goto()` so a crafted URL can't drive an open redirect.
- **The console email transport is dev-only.** It logs full email bodies (including reset/verify tokens) to stdout — never ship it to production.
- **`createAuthHandle` is mandatory for CSRF and session hydration.** Route handlers alone don't apply the Origin/Double-Submit checks or set `locals.user`. The Origin check covers only requests that _reach_ the handle — in a `sequence()`, an earlier handle that returns a response without calling `resolve` (maintenance mode, webhook shortcut, redirect) bypasses it for its routes; with `trustedOrigins: ['*']` set, nothing else covers those. A machine route that must accept Origin-less POSTs belongs in `csrf: { exempt }`, not outside the handle; a form-encoded one is additionally gated by SvelteKit's own kernel CSRF check, which `403`s it before any hook (in built apps only, never under `vite dev`) — see [AUTH.md → Machine callers](https://ui.urbicon.de/auth/guide#machine-callers).
- **Notification mark-read / delete must scope by the authenticated user.** In those route handlers derive `userId` from `locals.user`, never from the request body — otherwise one user can mutate another's notifications (IDOR).
- **`recipients: 'admins'` needs a resolver.** The package has no role model, so pass `resolveAdminRecipients` (e.g. `() => repo.findAdminUserIds()`) to `createNotificationService` for any type that targets admins. Without it `send()` **throws** rather than silently dropping the alert. Push-delivery failures are swallowed (one bad subscription mustn't break a send) — pass `onPushResult` to observe them; dead endpoints (410/404) are pruned automatically.

## Prisma Schema

See [`prisma/auth-schema.prisma`](./prisma/auth-schema.prisma) for the reference schema — it ships in the package, at `node_modules/@urbicon-ui/auth/prisma/auth-schema.prisma`. Ten models: `User`, `Invitation`, `PushSubscription`, `Notification`, `NotificationType`, `NotificationPreference`, `Passkey`, `RefreshToken`, `TwoFactorBackupCode`, plus the optional consumer-side `FederatedAccount` link table for SSO. Copy/merge into your app's schema.

## Tests

Unit tests (Vitest) cover the crypto primitives (JWT, HMAC, PBKDF2, CBOR, WebAuthn parsing, TOTP/HOTP/Base32 against the RFC-6238/4226 vectors, AES-256-GCM secret encryption), CSRF, rate-limiter, session cookies, validation, notification registry/SSE/Push, auth handlers (incl. the 2FA setup/enable/disable/verify flow + login gate), security headers, the service-worker notification-click handler, and the adapter conformance suite (atomic claim/scope guarantees — including backup-code single-use — run against both the in-memory and Prisma adapters).

```bash
cd packages/auth && bunx --bun vitest run
```

Full WebAuthn attestation/assertion against a real authenticator, end-to-end browser coverage, and integration tests against a live Prisma instance remain out of scope for v1.0 — see [AUTH.md → Production-Readiness Checklist](https://ui.urbicon.de/auth/guide#production-readiness-checklist).

## Known Limitations

The three most load-bearing for a production deploy are below; the **full catalog** (10 items with severity, rationale, and fix-plan) is the single source of truth in [AUTH.md → Known Limitations](https://ui.urbicon.de/auth/guide#known-limitations--security-gaps) — kept there to avoid a drifting second copy.

- **Persistent stores are opt-in.** Challenge, rate-limit, and refresh-token stores all default to in-memory (single-process). Pass a `ChallengeStore` / `RateLimitStore` / `RefreshTokenRepository` (Redis/Prisma/Upstash) when running >1 instance — the Prisma adapter is bundled.
- **CSRF Double-Submit and refresh-token rotation are opt-in.** The handle's Origin check is always on; the token layer (`config.csrf = { doubleSubmit: true }`, requires header-capable clients — incompatible with remote-function / no-JS-form mutations) and rotation (`config.refreshToken = {}` + `repos.refreshToken`) are additive production hardening.
- **`publicRoutes` replaces the defaults, and a string entry is a prefix.** Passing the option drops the built-in list instead of adding to it. `'/api/auth/'` is in that list, so an override that omits it guards the app's own sign-in — `POST /api/auth/login` then answers `401` to a visitor who has no session. Spread the exported `DEFAULT_PUBLIC_ROUTES` to extend (`[...DEFAULT_PUBLIC_ROUTES, '/pricing']`); replace wholesale only for a handle scoped to routes that mount no auth endpoints. A string matches with `startsWith`: `'/api/auth/'` exempts every sub-route below it, `'/pricing'` also exempts `/pricing-admin` and `/pricing/internal`, and `'/'` exempts the **whole app** — the obvious spelling of "my landing page is public" turns the guard off entirely, which the handle warns about at construction. One pathname alone is the object form: `{ path: '/', exact: true }` publishes the landing page and nothing under it. A list held in a variable first needs `as const` or the annotation `PublicRoute[]` — TypeScript otherwise widens `exact: true` to `boolean` and the assignment is a type error; an inline list needs nothing. Don't nest protected app routes under a public prefix.

## Roadmap

The production-readiness milestone is **shipped and stable** (persistent-store adapters,
refresh rotation, CSRF, atomic adapter contract + conformance suite). The scope-conform
account clusters — account management, active-session listing, **TOTP two-factor**, and
**Federated Identity / SSO** (`createFederatedAuthHandle` + `createJWKSHandler`, ES256 +
JWKS) — have also shipped (`beta`). Remaining hardening candidates live in the
[Known-Limitations catalog](https://ui.urbicon.de/auth/guide#known-limitations--security-gaps).

## Development

```bash
bun --filter='@urbicon-ui/auth' run build     # svelte-package
bun --filter='@urbicon-ui/auth' run check     # svelte-check
cd packages/auth && bunx --bun vitest run     # tests
```

## Related

- [docs/AUTH.md](./docs/AUTH.md) — architecture, security-gap catalog, consumer-migration notes; ships in this package, rendered at <https://ui.urbicon.de/auth/guide>
