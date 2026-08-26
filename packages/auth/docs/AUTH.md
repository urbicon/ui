# @urbicon-ui/auth

Zero-dependency authentication, user management, and notification system for SvelteKit. Part of the Urbicon UI monorepo.

## Architecture

```
@urbicon-ui/auth
├── Server (import from '@urbicon-ui/auth/server')
│   ├── Core: JWT (HS256 default, ES256 opt-in + JWKS), PBKDF2 password hashing, CSRF, rate-limiting, security headers
│   ├── Handlers: login, logout, register, forgot-password, reset-password, verify-email, me
│   ├── Handle-Hook: createAuthHandle() — session hydration, route guard, CSRF, headers
│   ├── Passkeys: WebAuthn registration + authentication (CBOR, ECDSA P-256, RSA verification)
│   ├── Federation (SSO): createJWKSHandler (IdP side) + createFederatedAuthHandle (consumer side)
│   ├── Notifications: SSE manager, push service (RFC 8291/8292), event registry, dispatch
│   ├── Email: Transport interface + Lettermint adapter + console logger
│   └── Adapters: Repository interfaces + Prisma + in-memory adapters + conformance suite
│
├── Client (import from '@urbicon-ui/auth')
│   ├── Stores: createAuthStore(), createNotificationStore() — Svelte 5 Runes
│   ├── 14 UI Components: blocks-based, unstyled/slotClasses, snippet overrides
│   │   └── fetching components accept `fetcher` (DI for fetch — mocks in demos/tests,
│   │       custom retry/auth layers; default: global fetch)
│   └── Utils: service worker registration, push subscription
│
├── i18n (import from '@urbicon-ui/auth/i18n/en' or '/de')
│   └── EN + DE locale bundles (extensible)
│
└── SW (import from '@urbicon-ui/auth/sw')
    └── handlePushEvent, handleNotificationClick
```

## Zero-Dependency Design

All crypto is implemented via Web Crypto API (`crypto.subtle`):

| Feature          | Implementation                                           | Standards               |
| ---------------- | -------------------------------------------------------- | ----------------------- |
| Password hashing | PBKDF2 (600k iterations, SHA-256)                        | —                       |
| JWT sessions     | HMAC-SHA256 (HS256, default; timing-safe comparison) or ECDSA P-256 (ES256, `createJWKSHandler` serves the JWKS) | RFC 7515, 7517, 7638    |
| Web Push         | ECDH + HKDF + AES-128-GCM                                | RFC 8291, 8292, 8188    |
| Passkeys         | CBOR decoder, ECDSA/RSA verification                     | WebAuthn Level 2, FIDO2 |
| Token hashing    | SHA-256                                                  | —                       |
| bcrypt migration | Dual-verify (detects `$2b$` prefix, re-hashes to PBKDF2) | —                       |

### Runtime requirements

Zero **dependencies**, but the server runtime must provide a couple of platform
globals:

- **Web Crypto** — `globalThis.crypto` with `crypto.subtle` + `getRandomValues`
  backs every crypto path above. Global since Node 20, always present in Bun,
  Deno and edge runtimes.
- **Node `Buffer`** — password hashing (PBKDF2 hex encoding) and the TOTP secret
  cipher (base64) use `Buffer`. Password hashing is on the login/register path,
  so in practice this makes the package **Node ≥ 20 or Bun** (both ship `Buffer`
  globally); the Prisma adapter is Node/Bun-only regardless.

**Bottom line: target Node.js ≥ 20 or Bun.** Edge/Workers/Deno-deploy need a
Node-compatibility layer that polyfills `Buffer` (e.g. Cloudflare's
`nodejs_compat`); the Web Crypto paths themselves are edge-clean.

## Package Exports

| Export                                         | Condition           | Content                                                     |
| ---------------------------------------------- | ------------------- | ----------------------------------------------------------- |
| `@urbicon-ui/auth`                             | Client + types      | Stores, components, types                                   |
| `@urbicon-ui/auth/server`                      | Server only         | Handlers, auth core, adapters                               |
| `@urbicon-ui/auth/server/adapters/prisma`      | Server only         | Prisma adapter factory (`createPrismaRepos`)                |
| `@urbicon-ui/auth/server/adapters/in-memory`   | Server only         | In-memory adapter (`createInMemoryRepos`, per-repository factories on a `createInMemoryStore()`) — dev/test |
| `@urbicon-ui/auth/server/adapters/conformance-core` | Server (tests) | The suite without a runner import — pass your own `describe`/`it`/`expect` (bun:test as-is; jest needs `expect: (a) => expect(a)`) |
| `@urbicon-ui/auth/server/adapters/conformance` | Server only (tests) | Adapter conformance suite (`describeRepositoryConformance`) |
| `@urbicon-ui/auth/server/email/lettermint`     | Server only         | Lettermint email transport                                  |
| `@urbicon-ui/auth/server/email/console`        | Server only         | Console email transport (dev)                               |
| `@urbicon-ui/auth/sw`                          | Service Worker      | Push + notification click handlers                          |
| `@urbicon-ui/auth/i18n/en`                     | Universal           | English locale                                              |
| `@urbicon-ui/auth/i18n/de`                     | Universal           | German locale                                               |

## UI Components

All components use `@urbicon-ui/blocks` primitives and support:

- **`t`** — locale overrides as `PartialAuthLocale`: any subset, deep-merged over the
  active built-in bundle by `mergeAuthLocale` (both root-exported). Overriding one
  string never blanks the rest; a hand-rolled bundle missing newer keys resolves them
  from the base. `AuthLocale` itself is fully required — no per-key fallback literals
  in markup.
- **`unstyled`** — strips *every* default class, including inner wrappers and list-item
  internals; structural state that only styling used to carry is exposed as data
  attributes instead (`data-met` on RegisterPage requirement rows, `data-unread` on
  NotificationCenter items). Functionality never disappears with the flag. Set it on the
  prop or on `<BlocksProvider unstyled>` — a provider-wide flag reaches these components
  too. **Changed:** it used to strip only the blocks primitives inside them, leaving the
  auth components' own classes in place; a project relying on that half-stripped state
  now gets the whole thing.
- **`slotClasses`** — per-slot class overrides (e.g. `root`, `card`, `form`, `field`)
- **`preset`** — a named look registered on `<BlocksProvider presets={{ LoginPage: { … } }}>`,
  resolved after the provider's `defaults` and before this instance's `slotClasses`. Reach for it
  when the same override would otherwise be repeated at every usage site. `NotificationListener`
  is the one component without any of the three — it renders no markup.
- **Snippet overrides** — `header`/`footer`/`links` on all five pages, `item`
  (NotificationCenter), `qr` (TwoFactorManager)
- **Semantic design tokens** — `text-text-primary`, `bg-surface-quiet`, etc.
- The five pages share one internal skeleton (`_shared/AuthPageShell.svelte`: wrapper →
  Card → h1 → aria-live error region); the region itself is
  `_shared/FormErrorAlert.svelte`, reused by the managers. Neither is a public export.

| Component            | Purpose                                     |
| -------------------- | ------------------------------------------- |
| LoginPage            | Login form with optional passkey button     |
| RegisterPage         | Registration form (invitation-gated)        |
| ForgotPasswordPage   | Password reset request                      |
| ResetPasswordPage    | Password reset with confirmation            |
| VerifyEmailPage      | Auto-verifying email confirmation           |
| InvitationManager    | Admin invitation management                 |
| PasskeyManager       | WebAuthn credential management              |
| AccountSettings      | Change name/email/password + delete account |
| SessionManager       | List active sessions + sign out devices     |
| TwoFactorManager     | Enrol/disable TOTP 2FA + show backup codes  |
| NotificationCenter   | Notification list with read/delete          |
| NotificationBadge    | Unread count badge                          |
| NotificationListener | Headless SSE listener                       |
| PushPermissionPrompt | Push notification opt-in                    |

### Client stores

`createAuthStore` / `createNotificationStore` are the headless counterparts for
consumers building their own UI. They ride the same
infrastructure as the components: a `fetcher` config option (mock backends,
retry layers), the tolerant `postJson`/`getJson` request core, and the wire
contract instead of hardcoded English — a failed auth action returns
`{ success: false, error?, code? }` (server prose + machine code; localize via
`errorMessageFromCode(code, t, error)`), a request that never reached the
server synthesizes `code: 'network_error'`. The notification store records the
same shape on `lastError` (cleared by the next success), returns `false` from
failed operations instead of silently no-opping, and a failed `load` keeps the
existing list rather than blanking it into a fake empty inbox. `logout` clears
the local state unconditionally but still reports whether the server revoked
the session (threading the failure body's wire contract). `checkStatus`
distinguishes "signed out" from "could not ask": a 200 or the me-contract's
`401 { user: null }` resolves the user and reports success, while a transport
failure or non-contract error leaves the current user untouched and reports
the failure — a route guard can retry instead of bouncing a signed-in user
over a transient blip.

### Password policy

`config.password` is the only definition of what a password must satisfy. The
server measures against it (`validatePasswordStrength`), and
`createPasswordPolicyHandler(deps)` publishes it so `<RegisterPage>`,
`<ResetPasswordPage>` and `<AccountSettings>` gate against the same rules
instead of a hand-kept copy in component props:

```ts
// src/routes/api/auth/password-policy/+server.ts
export const GET = createPasswordPolicyHandler(authDeps).GET;
```

The three components read it from `policyPath` (default
`/api/auth/password-policy`) on mount. Without the route they fall back to
`DEFAULT_PASSWORD_POLICY` — min 8, no character classes, i.e. what an
unconfigured server enforces — and warn in dev. When your route already loads
the policy, pass it in as `passwordPolicy` (`resolvePasswordPolicy(config.password)`
in a `+page.server.ts`) and no request is made.

**A refusal is localized even when the client gated on the wrong policy.** The
three handlers that take a new password answer a rule failure with the English
prose *and* the refusal in machine form:

```json
{ "error": "Password must be at least 12 characters", "code": "validation_error",
  "errors": ["Password must be at least 12 characters"],
  "rules": ["minLength"],
  "passwordPolicy": { "minLength": 12, "requireUppercase": false, … } }
```

`errorMessageFromCode` prefers the server prose for `validation_error` (it
names the field), so without `rules` a German user reads the English sentence
whenever the form measured against a different policy — the exact string this
work exists to remove. The shipped forms read `rules` first, render their own
labels for them, and **adopt** `passwordPolicy`, so the next attempt is gated on
the rules the checklist now shows instead of failing the same way again. A
consumer without i18n sees `error`/`errors` unchanged.

The **endpoint's** response is a five-field projection (`minLength`,
`requireUppercase`, `requireLowercase`, `requireDigit`, `requireSpecial`) and
nothing else — in particular never `pbkdf2Iterations`. It is unauthenticated on
purpose: registration and password reset are signed-out flows, and one failed
submit already spells the policy out ("Password must be at least 12
characters").

The checklist renders from the first paint rather than from the first
keystroke, and the password field points at it with `aria-describedby`: a
description added to an already-focused field is not reliably re-announced, and
there is deliberately no live region (it would fire on every keystroke). Set
`showRequirements={false}` to drop both — a refused password still names the
rules it missed, so the reason stays reachable.

### Breaking in this release

`<RegisterPage>`'s `passwordMinLength` / `requireUppercase` / `requireLowercase`
/ `requireDigit` / `requireSpecial` props are gone — they were the second copy.
Their old defaults (min 8 **plus** upper, lower and digit) were also stricter
than an unconfigured server, so the checklist blocked passwords the server would
have taken. Configure `config.password` and mount the endpoint; the UI follows.

`requireSpecial` is new on the server side. The registration checklist has
offered that rule since v8 while `validatePasswordStrength` ignored it, so a UI
demanding a symbol refused nothing the server would have accepted; it is now
enforced, and off by default like the other character classes.

`AuthLocale` is fully required, so a **hand-written locale bundle stops
compiling** until it carries the new keys — that is the intended signal, not a
regression. Added: `auth.errors.csrfFailed`, `auth.errors.passkeyVerificationFailed`,
`auth.errors.connectionLimit`, and the `auth.passwordRequirements` subtree
(`label`, `met`, `notMet`, `failed`, `rules.*`). Moved: `auth.register.requirementsLabel`
and `auth.register.requirements.*` became `auth.passwordRequirements.label` and
`auth.passwordRequirements.rules.*` — they are read by the account panel and the
reset page too, so `register` was the wrong home for them. Consumers passing a
`PartialAuthLocale` override are unaffected unless they overrode those two.

## Consumer Integration — staged setup

The full copy-paste walkthrough lives in [packages/auth/README.md →
Getting Started](../README.md#getting-started), structured as three
stages that build on each other. This section is the architectural view: which building
blocks each stage swaps in, and the invariants that hold across all of them.

**Cross-cutting:** `createAuthHandle` is mandatory in every stage — it hydrates the
session (`locals.user`), guards routes, applies the response security headers, and
enforces CSRF. The handler factories alone do none of that.

`createAuthHandle` applies response security headers automatically:
`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy` (always on) plus `Strict-Transport-Security` (only when
`jwt.cookieSecure !== false`) and a `Content-Security-Policy` baseline
(`frame-ancestors 'none'`). Tune or disable the latter two via
`config.securityHeaders` — e.g. `{ csp: "default-src 'self'", hsts: false }`.
CSP is a hook: a full policy is app-specific, so supply your own once you know
which origins the app loads.

### Stage 1 — Quickstart (dev)

In-memory adapter (`createInMemoryRepos`) + console email transport
(`createConsoleEmailTransport`) + `jwt.cookieSecure: false`. No database, no mail
server, wiped on restart — **dev only**. `createAuthDeps` still applies the secure
brute-force defaults (login rate-limit + lockout), so the dev flow isn't unprotected.
**Every key of `rateLimit` carries a default.** Configuring some keys is a merge,
never a replacement (`rateLimit: { register }` still leaves login protected), and
the default table is derived from the key set — a new endpoint key cannot ship
without one. There are two opt-outs: `rateLimit: null` disables limiting for every
handler, and a single key set to `null` disables just that one — `rateLimit: {
register: null }` is "deliberately unlimited registration" without giving up the
login brake. An *omitted* key is not an opt-out; it gets the default. The lockout
default applies only when you configured neither `rateLimit` nor `lockout`; opt out
of it with `null` too. The three sign-in limiters — `login`, `twoFactor`,
`passkeyAuth` — count attempts, and a success refunds the slot its request took:
behind a shared address they brake failures only, and twenty colleagues signing in
from one office spend nothing. A refund, not a reset — a success gives back exactly
what it cost, so an attacker with an account of his own cannot clear the address's
budget between guesses at other accounts. The re-auth keys (`changePassword`,
`changeEmail`, `deleteAccount`, `twoFactorDisable`) take the account password too
but count every request: they sit behind a session and are used once in a while,
never in a sign-in wave.

| key | window | max | why this number |
| --- | --- | --- | --- |
| `login` | 15 min | 5 | the one endpoint offering a human-chosen secret |
| `changePassword` · `changeEmail` · `deleteAccount` · `twoFactorDisable` | 15 min | 5 | re-auth endpoints accept the account password; a hijacked session must not get a better budget than the login form, and failed re-auths feed no lockout |
| `twoFactor` | 15 min | 10 | 10⁶ codes — a few typos, online brute force hopeless |
| `register` · `forgotPassword` · `resetPassword` · `verifyEmail` | 15 min | 10 | 256-bit single-use tokens, so the budget brakes cost (mail sending, PBKDF2), not guessing; more generous than login because the key is the client IP and these are once-in-a-while actions behind shared/NAT addresses. These count every request, successes included: onboarding twenty people behind one office address takes two windows — the eleventh signup within fifteen minutes gets a `429` with `Retry-After`, tolerable for something done once |
| `passkeyAuth` | 15 min | 30 | two calls per ceremony (options + verify share one bucket) = 15 failed or abandoned ceremonies, a completed one refunds both calls; it also bounds the challenge store, which prunes only at the 5-minute TTL — at **30** live entries per IP, not 15, because an abandoned ceremony spends one call and leaves its entry behind |
| `refresh` | **1 min** | 30 | the short window is the point: only the explicit refresh endpoint reads it (the handle hook rotates without it), a client needs it once per access-token lifetime, and every session behind one NAT address shares the counter — 30/min absorbs a many-tab burst and forgets it a minute later instead of locking the office out for fifteen |

`resetPassword` is the one worth understanding before you loosen it: the handler
runs PBKDF2 **before** claiming the token, deliberately, so the claim→write window
stays closed — which means one unauthenticated request with any garbage token costs
a full password hash (~55 ms at the default work factor). Without a limiter, a few
dozen requests per second saturate the thread pool that login's own hashing shares.

Two endpoints that read one key share **one** counter (`verifyEmail` covers both
verify-email and verify-email-change; `passkeyAuth` covers options and verify). The
counter's lifetime is the lifetime of the resolved `AuthConfig` **object**, and
`createAuthDeps` returns a *new* one on every call — so **call `createAuthDeps`
once**, at module scope, and pass `deps` around. Calling it per request hands each
request a fresh config object and therefore a fresh, empty counter: measured 20 of
20 requests accepted against a configured limit of 5, where one `createAuthDeps`
lets 5 of 20 through. (Reusing the same config
*literal* does not help; it is the resolved object's identity that keys the
counter.) A persistent `RateLimitStore` sidesteps the whole question.

The wiring is four files: deps → `hooks.server.ts` (`createAuthHandle`) → one
`+server.ts` per handler (`createLoginHandler`, …) → a `<LoginPage>` route.

### Stage 2 — Production

Swap in `createPrismaRepos` + a real transport (`createLettermintTransport`) and turn on
the additive hardening layers: `csrf.doubleSubmit` (only when every mutation sends the token header — see the production checklist; incompatible with remote-function / no-JS-form mutations), `refreshToken` rotation (+ a `refresh`
route stub via `createRefreshHandler`), per-handler `rateLimit`, `lockout`, and HTTPS
(which auto-enables HSTS). The three single-use tokens the package mails out have their
own windows under `tokenTtl` — `emailVerification` (default `'24h'`), `passwordReset` and
`emailChange` (default `'1h'`) — in the `Ns | Nm | Nh | Nd` grammar every other duration
field uses; set them when a policy prescribes a different one. Each is resolved when the
handler is created, so a malformed value throws at wiring time rather than in a request,
and shortening one never shortens a link that is already in someone's inbox. `appUrl` must be the real public origin — outbound email links
are built from it, never from `request.url` (the Host header is attacker-controlled). Work
through the **[Production-Readiness Checklist](#production-readiness-checklist)** before going
live.

### Stage 3 — Advanced

- **Custom persistence adapter** — see the [Adapter Authoring Guide](#adapter-authoring-guide); validate it against the exported conformance suite.
- **Post-login deep links** — the route guard preserves the originally requested path: an unauthenticated GET navigation redirects to `${loginPage}?redirectTo=<path+query>` (non-GET requests redirect without the param — a POST target must not be re-issued as a GET). The param is attacker-writable like any query string, so consume it **only** through the exported `sanitizeRedirect` (root and server export), which admits internal absolute paths and falls back on everything else (absolute/protocol-relative URLs, `/\` variants): `onSuccess={() => goto(sanitizeRedirect(page.url.searchParams.get('redirectTo'), '/dashboard'))}`.
- **JWT key rotation** — `jwt.keyId` + `jwt.previousSecrets` roll the signing secret without invalidating live sessions.
- **Passkeys (WebAuthn)** — mount the `createPasskeyHandlers(deps, webauthn)` route group (the four ceremony groups plus `list`/`item` for `<PasskeyManager>`'s list + remove; requires `deps.repos.passkey`, throws at wiring time without it) with a `webauthn: WebAuthnConfig` (persistent `challengeStore` at >1 instance; **user verification is enforced by default** — `requireUserVerification: false` opts out for authenticators that cannot do UV, and because passkey logins skip the TOTP gate, that opt-out alongside `config.twoFactor` makes a passkey login single-factor for a TOTP-enrolled user; `createPasskeyHandlers` warns at wiring time when it sees the pair) and add `<PasskeyManager>` + `<LoginPage mode="both">`.
- **Notifications & Web Push** — register domain events server-side, listen with `<NotificationListener>` + `<NotificationCenter>` client-side. **`notification.url` is untrusted at navigation time** — validate/allow-list it before `goto()`. The list/mark-read/read-all/delete routes that `createNotificationStore` calls are served by `createNotificationsHandlers(service)` — mount its `list`/`read`/`readAll`/`item` groups under the store's `apiPath` (default `/api/notifications`); every method derives `userId` from `locals.user` and goes through the ownership-scoped service methods (IDOR-safe by construction). **Endpoint takeover is key-gated**: `pushSubscription.create` upserts by endpoint, and reassigning the row to a *different* account requires the submitted keys to match the stored ones (compared constant-time on the decoded bytes) — the legitimate user-switch-in-the-same-browser case re-sends the browser's existing subscription (same endpoint *and* keys), while merely knowing the endpoint URL (say, from a log) is refused with `409` and no write (`'rejected'` outcome; all four outcomes — created/updated/reassigned/rejected — are conformance-tested). Endpoint URLs are still worth keeping out of logs (they are the push target), but takeover no longer rides on them alone. `recipients: 'online'` is presence-based, not account-based — it reaches the users with an open SSE stream in this process at send time, and nobody else (renamed from the misleading `'all'`; `send()` throws a migration error on the old value). The registry rejects duplicate keys and the legacy `'all'` value at registration time — note for dev-HMR setups: if you cache the registry on `globalThis` to survive hot reloads, module-scope `register()` calls re-run against the surviving instance and throw; cache the registrations together with the registry (or guard with `registry.get(key)`). A type declared with `recipients: 'admins'` requires a `resolveAdminRecipients` resolver on `createNotificationService` (e.g. `() => repo.findAdminUserIds()`) — the package has no role model of its own, so without it `send()` **throws** rather than silently delivering admin alerts to nobody. Push delivery failures are swallowed so one bad subscription can't break a send; pass `onPushResult` to observe them, and subscriptions the push service reports as gone (410/404) are pruned automatically. The preference/push-subscription endpoints are rate-limited per user by default (30/min PUT resp. 10/min POST+DELETE; `rateLimit: null` opts out), `createPreferencesHandler` requires the registry and rejects unregistered `typeKey`s (bounding per-user preference rows to the registered types), and stored subscriptions are capped per user (`maxSubscriptionsPerUser`, default 10, `409` beyond — re-subscribes of a known endpoint always pass).
- **Invitations (admin)** — `createInvitationHandlers(deps, { authorize, roles })` is the server half of `<InvitationManager>`: mount `POST` + `GET` on `/api/invitations` and `DELETE` on `/api/invitations/[id]`. `authorize` is **required and fail-closed** (no open default) — registration's account-enumeration defense holds only while invitations stay admin-minted, so any authenticated user must not be able to mint one. `roles` allow-lists the assignable roles, so a crafted request can't escalate past what the UI offers. Every invitation carries a **one-time token** (SHA-256 in the database, raw value returned once) and an **expiry** (`invitationTtlMs`, default 7 days). The `201` returns `inviteUrl` — `${appUrl}/auth/register?token=…&email=…` — because that URL is the only way the invitation reaches anyone when no mail transport is configured, a case this package ships a console transport for. It is not in `GET`: the server keeps only the hash, so an admin who loses the link revokes the invitation and mints a new one. When the client sets `sendEmail`, the handler also mails that link — best-effort: a mail failure still returns `201` with `emailSent: false` (logged), since the invitation row is the durable effect. Override the mail via `inviteEmail`.
- **Pre-verified invited signups** — an invitation **that was emailed** proves mailbox ownership: the mail went to that address, it carried a secret, and the secret came back. A link the admin copied out of the panel proves nothing of the sort — it travelled whatever channel the admin chose — so `autoVerifyInvited` is honoured only for invitations with an `emailedAt`, and a copy-link signup gets the ordinary verification mail regardless of the setting. Pass `createRegisterHandler(deps, { autoVerifyInvited: true })` to create the account with `emailVerified: true` and skip the verification token **and** the verification mail entirely. Without it, the user — who is auto-logged-in on register — receives a "verify your email" mail *after* already being signed in, and `emailVerified` never flips. Defaults to `false` (backwards-compatible: token + mail issued as before, for consumers that genuinely gate on `emailVerified`). The flag is an option on the register handler's **second argument**, not something threaded through `createAuthHandle` — that hook only resolves the session and guards routes; every handler is mounted with its own `+server.ts`. Email *change* still verifies the new address independently (`createVerifyEmailChangeHandler`); there is no prior proof of ownership for it, so it is unaffected.
- **Session enrichment** — attach app-specific data (tenant/household id, plan, entitlements) to `locals.user` via `config.hooks.transformUser(user, event)`. It runs in the handle hook on every authenticated request with the sanitized `AuthUser` (never the password hash) and the request event; its return value becomes `locals.user` (type it through your `App.Locals`). `AuthUser` is intentionally fixed and the loaded row carries no custom columns, so load extras here keyed by `user.id` rather than adding a second `handle` that re-resolves the session. A throw fails the request — except on the transparent refresh-rotation path, where the rotation has already committed and its cookies would be lost with it; there the throw is caught and the request continues unauthenticated. Whatever you return lands on `locals.user` — keep secrets out of it if `locals.user` is serialized to the client. **Throw semantics across `config.hooks`:** `transformUser` and `onBeforeAccountDelete` are the only two gates, where a throw aborts; every other hook only reports, so a throw is caught and sent to `config.logger.error` and the handler's outcome stands. Each hook's JSDoc says which it is — read that before wiring one, and don't generalize from these two.
- **Account management (self-service)** — let a signed-in user manage their own account. Five server handlers (`createChangePasswordHandler`, `createChangeEmailHandler`, `createVerifyEmailChangeHandler`, `createUpdateProfileHandler`, `createDeleteAccountHandler`) plus the `<AccountSettings>` component (mount the first four under `/api/auth/account/*`; the verify-email-change route sits behind the link mailed to the new address). Invariants: every mutation except profile is **re-auth gated** (`verifyCurrentPassword`); `change-password` bumps `tokenVersion` + revokes all refresh families, then re-establishes the _current_ device (others log out — a voluntary change isn't a compromise, so the initiating device stays in, unlike `reset-password` which signs out everywhere); `change-email` verifies the **new** address (notice to the old one) and is account-enumeration safe (token+mail decoupled, always `success: true`, collision = no-op); `delete-account` is a hard delete (GDPR erasure) that fires `hooks.onBeforeAccountDelete` with the sanitized user **before** the row is removed (a throw aborts), with the Prisma adapter dropping sent invitations in the same `$transaction`. Config: `rateLimit.{changePassword,changeEmail,deleteAccount}`, hooks `onEmailChangeRequested` / `onEmailChangeFailed` / `onEmailChanged` / `onBeforeAccountDelete` (`onEmailChangeFailed` surfaces the decoupled token/mail failure, like `onPasswordResetFailed`).
- **Active-session listing** — let a user see and revoke their sessions. **Requires `config.refreshToken` rotation** — a "session" is a refresh-token family, so without rotation there is nothing server-side to list (the endpoint returns `available: false`). One route group — `createSessionsHandlers(deps)` with `list` (GET), `revoke` (POST) and `revokeOthers` (POST) — plus the `<SessionManager>` component. Each session row carries the user-agent (the component parses it to "Browser · OS" with a zero-dep heuristic) and a `createdAt`-based "last active"; the IP is listed only when the consumer opts in via `config.sessions.storeIp` (GDPR, default off). Revokes are **ownership-scoped** — `revokeFamilyForUser` returns 404 for a family that isn't the caller's, so a guessed family id can't sign out another user (IDOR). The session of the current request is flagged `current` (resolved from the request's refresh cookie). Login/register/passkey-verify tag their sessions with the device metadata via `resolveSessionMeta`, carried across rotation.
- **Two-factor authentication (TOTP)** — an opt-in authenticator-app second factor on top of the password. Set `config.twoFactor` (`encryptionKey` **required** — high-entropy, stable; it encrypts the secret at rest, and rotating it locks every enrolled user out until they get back in with a backup code — or, for users who enrolled one, a passkey, since passkey logins are not TOTP-gated — see the [key-rotation runbook](#key-rotation-runbook-twofactorencryptionkey)) and provide `repos.backupCode` (both shipped adapters include it). One route group — `createTwoFactorHandlers(deps)`: `setup`/`enable`/`disable` (authenticated, mount under `/api/auth/account/2fa/*`) plus `verify` (the **public** second login step, mount under `/api/auth/2fa/verify`); the `login` handler gates automatically on `user.totpEnabled`. UI: `<TwoFactorManager>` for enrol/disable + the two-step `<LoginPage>`. Invariants: the secret is **AES-256-GCM-encrypted at rest** and only ever returned (plaintext Base32 + otpauth URI) by `setup`; the login gate keys on `totpEnabled` **alone** so a missing `config.twoFactor` can never become a bypass (fail-closed) — it issues a signed, short-lived pending-2FA token (cookie `urbicon_2fa`, `__Host-`-prefixed unless a `cookieSecure: false` on the session, CSRF **or** refresh cookie declares the deployment non-HTTPS) instead of a session, leaving no session/refresh cookie and deferring `onLoginSuccess` to verify; verify accepts a TOTP **or** a single-use SHA-256 backup code, is **strictly rate-limited** (`createAuthDeps` injects a default), and consumes the pending cookie only on success (a wrong code keeps it for retry within the TTL); `disable` is **password re-auth gated** and clears the secret + every backup code; backup codes are cleared before re-issue at enable so a re-enrol leaves none doubly-redeemable. Passkey logins are **not** gated — a claim that rests entirely on user verification: `webauthn.requireUserVerification` defaults to `true`, so an accepted assertion carries possession *and* an asserted PIN/biometric (asserted, not attested — see [Known Limitations](#known-limitations--security-gaps)). Set it to `false` and a passkey is possession alone, which makes a passkey login a single-factor login for exactly the users who enrolled a second one (`createPasskeyHandlers` warns on that pairing). The TOTP core (`server/totp.ts`, RFC 6238/4226/4648) is exported for custom flows; the pending-token/cookie/backup-code plumbing (`server/two-factor.ts`) stays internal (consumed only by the login + 2FA handlers). Config knobs: `twoFactor.{issuer,algorithm,digits,period,window,pendingTokenTtl,backupCodeCount}`, `rateLimit.twoFactor`. `algorithm` defaults to **SHA-1** — the only one Google/Microsoft Authenticator reliably support; the secret's high entropy carries the security, not the hash, so SHA-256 stays opt-in. **Note:** the verify rate-limit is per-IP (like login) and TOTP codes are replayable within their window in v1 — both deliberate trade-offs (see [Known Limitations](#known-limitations--security-gaps)).
- **Federated identity / SSO** — one deployment becomes the identity provider (ES256 tokens + `createJWKSHandler`), sibling apps verify with `createFederatedAuthHandle` and decide access themselves. See [Federated Identity (SSO)](#federated-identity-sso).

```typescript
// Server: register a domain event (Stage 3 notifications)
import { createNotificationRegistry } from '@urbicon-ui/auth/server';
const registry = createNotificationRegistry();
registry.register({
  key: 'order_shipped',
  title: (data) => `Order ${data.orderId} shipped`,
  url: (data) => `/orders/${data.orderId}`, // untrusted at click time — validate before goto()
  recipients: (data) => [data.userId]
});
```

### Upgrade note — user verification is enforced by default

`webauthn.requireUserVerification` defaults to `true`. Registration and
assertion both reject an authenticator that does not set the UV bit, so
**credentials already enrolled on a UV-less authenticator stop working** on
upgrade: a security key with no PIN configured, or one driven in a mode that
only proves User Presence. Platform authenticators (Touch ID, Windows Hello,
Android) set the bit and are unaffected.

What it looks like when it bites: the assertion is refused with `400
passkey_verification_failed` carrying `User verification required but not
performed`, and `hooks.onLoginFailed` fires with the reason `invalid_assertion`
and an empty email. In an audit sink that reads like an attack, not like a
config change — so if you upgrade and your passkey-failure rate jumps, look here
before you look for an attacker. Enrolling a *new* credential on the same
authenticator fails the same way.

Two ways out: have the affected users set a PIN on the key (the outcome the
default is asking for), or set `requireUserVerification: false` — in which case
read the 2FA note on the passkey bullet above before you do, because with
`config.twoFactor` wired the opt-out makes a passkey login single-factor.

### Key-rotation runbook (`twoFactor.encryptionKey`)

The 2FA secret is encrypted at rest with this key, and `decryptSecret` is
fail-closed. Changing the key therefore does not degrade — it **locks out every
user with `totpEnabled`**, and re-enrolment is not the way back: `setup` refuses
while 2FA is still on, so those users cannot mint a secret under the new key
either.

Two routes remain open. A **backup code** — the verify handler keeps that path
live because backup codes are hashed on their own rows and need no TOTP secret.
And a **passkey**, for users who enrolled one: passkey logins are not TOTP-gated
(see the passkey bullet above), so the rotated key never touches them. Either
route yields a session, and a session is all that `disable` → `setup` → `enable`
needs to re-enrol under the new key.

Both decryption failures are reported through `config.logger` at `error` level,
naming a user id — but not at the same rate. `verify` reports every attempt
(that endpoint is rate-limited by default); `enable` reports only the first
attempt **per user**, because it has no limiter and one authenticated caller
could otherwise fill the sink. So the `enable` lines count the users the
rotation reached, not the attempts they made. Watch that sink: the response is a
`500 totp_secret_unreadable` built with `authError`, which **returns** a
Response rather than throwing `error()`, so SvelteKit's `handleError` never
fires and a Sentry integration hooked there sees nothing.

1. **Do not rotate on a schedule.** Unlike `jwt.previousSecrets`, this key has no
   overlap mechanism — one key is in force at a time.
2. **If you must** (key compromise): announce it, then rotate. Every TOTP user
   whose only other credential is the authenticator app needs a backup code at
   the next login; passkey holders sign in unaffected.
3. **After the rotation**, drive the affected users through
   `disable` → `setup` → `enable` (the `<TwoFactorManager>` flow) so their secret
   is re-encrypted under the new key and a fresh backup-code set is issued.
4. **A user out of backup codes and without a passkey** is locked out of their
   account; recovery is your own out-of-band identity proof plus an
   administrative `disableTotp`. Check for an enrolled passkey before running
   that ceremony — it is the cheaper route and the user can walk it alone.
5. **If the key was merely lost** (not compromised), restoring it from backup is
   the whole fix — nothing on the user rows changed.

## Federated Identity (SSO)

One deployment running this package becomes the **identity provider (IdP)**; any number of sibling apps become **consumers** that trust it. The token boundary is deliberately narrow:

> **Identity ≠ authorization.** The IdP's JWT proves *who* the caller is — nothing else. Each consumer app decides *whether* that identity gets in, and *as what*, in its own `resolveUser`. The IdP token's `role` and `tokenVersion` claims are IdP-application-internal and are structurally withheld from consumers (`FederatedIdentity` carries only `subject`, `email`, `issuedAt`, `expiresAt` — type **and** runtime). Forwarding the IdP's role would be exactly the identity/authorization confusion this design forbids: an "admin" at `auth.example.com` is not an admin of your billing app.

### Architecture (prose diagram)

- **IdP** (`auth.example.com`): switches its session JWT to `jwt.algorithm: 'ES256'` (ECDSA P-256; HS256 stays the default for non-federated deployments) and publishes the **public** half of its signing key as an RFC 7517 JWKS via `createJWKSHandler` — served with `Cache-Control: max-age=300`. Login, logout, registration, refresh rotation, 2FA: all stay exclusively at the IdP. With `jwt.cookieDomain: '.example.com'` the session cookie is shared with every `*.example.com` sibling (the refresh and CSRF cookies deliberately stay host-scoped — consumers verify, they never rotate).
- **Consumer** (`app.example.com`): mounts `createFederatedAuthHandle` as its `hooks.server.ts` handle. Per request it verifies the shared cookie's ES256 signature against the IdP's JWKS (fetched lazily, cached ~5 min, cooldown-limited refresh on unknown `kid` — no fetch storms; fetch failures fail *closed* with one loud log line, never a 500), then calls `resolveUser(identity, event)`. The result is `locals.user` (same locals contract as `createAuthHandle`); `null` denies. Route guard: `publicRoutes` entries pass (a string prefix or `{ path, exact: true }`, read exactly as on the IdP handle), `/api/` gets a JSON 401, pages 302 to `loginUrl` (typically the IdP login; used verbatim — no `redirectTo`, since the IdP's `sanitizeRedirect` admits IdP-local paths only), and unauthenticated remote-function calls are default-denied on both transports (the same default-deny as the IdP handle). The consumer handle **never writes cookies** (the cookie is the IdP's — clearing it would log the user out of every sibling app), runs no CSRF gate of its own (keep SvelteKit's kernel CSRF gate on — the default; do **not** set `trustedOrigins: ['*']` on a federated consumer) and sets no security headers (your app's own policy).
- **Why ES256 only:** a federated consumer must verify *asymmetrically*. Verifying HS256 requires the signing secret — and a shared signing secret means every "consumer" can also **mint** tokens, i.e. there is no trust boundary left. The consumer pins `alg: ES256` (plus a mandatory `kid`) before touching any key material; the IdP side pins its configured algorithm the same way (no algorithm-confusion downgrade in either direction).
- **Purpose binding:** every JWT this package mints carries a `purpose` claim, and every verifier requires it *in the primitive* — not in each caller's claim-shape check. Session tokens (HS256 and ES256 alike) are stamped `purpose: 'session'` (exported as `SESSION_TOKEN_PURPOSE`); `verifySessionToken` **and** the consumer handle reject any token without exactly that value. The generic short-lived tokens (`createSignedToken`/`verifySignedToken` — e.g. the pending-2FA handle, `'2fa-pending'`) take a mandatory `purpose` parameter, stamped at mint and matched verbatim at verify (`purpose` is a reserved claim; a missing/empty purpose argument throws — API misuse, not a bad token). Result: two token kinds signed with the same `jwt.secret` can never be accepted for each other's purpose. **Version skew:** the claim crosses the app boundary, so upgrade the **IdP first** — a pre-purpose consumer ignores the extra claim, while an upgraded consumer rejects pre-purpose IdP tokens (fail-closed; the break heals as tokens re-mint via login/refresh after the IdP upgrade).
- **Verifier input cap:** `verifySessionToken`, `verifySignedToken` and the consumer handle reject input longer than `MAX_TOKEN_LENGTH` (8 KB — double the ~4 KB browser cookie ceiling, so a legitimate cookie-borne token can never hit it) *before any parsing*; on the consumer this also precedes any JWKS fetch. Belt-and-suspenders for verifiers applied to unbounded non-cookie input.

### Setup — IdP side

1. **One-time key setup** (a script, **never** on boot — a fresh key per process would invalidate every live session and desynchronize consumers):
   ```typescript
   import { generateES256KeyPair } from '@urbicon-ui/auth/server';
   const { privateKey, publicKey, kid } = await generateES256KeyPair();
   // privateKey → secret manager (it contains the private scalar `d`);
   // kid is the RFC 7638 thumbprint, stamped into both JWKs.
   ```
2. Config: `jwt: { algorithm: 'ES256', signingKey: privateKey, secret, cookieDomain: '.example.com' }`. `jwt.secret` stays required — package-internal short-lived tokens (pending-2FA handle etc.) deliberately remain HMAC. Misconfiguration (ES256 without a usable key, malformed `previousPublicKeys`) throws at wiring time in `createAuthDeps`/`createAuthHandle`.
3. Mount the JWKS route, e.g. `src/routes/.well-known/jwks.json/+server.ts`:
   ```typescript
   import { createJWKSHandler } from '@urbicon-ui/auth/server';
   export const { GET } = createJWKSHandler({ jwt: config.jwt });
   ```
   Exempt the route from the IdP's own guard if it falls outside your public prefixes — `publicRoutes` replaces the defaults rather than adding to them, so that reads `publicRoutes: [...DEFAULT_PUBLIC_ROUTES, '/.well-known/']`. Only public JWK members can reach the response (allow-list projection; a `d` in the config is warned about and never served).

### Setup — consumer side

```typescript
// hooks.server.ts of app.example.com
import { createFederatedAuthHandle } from '@urbicon-ui/auth/server';
import { createPrismaFederatedAccountRepository } from '@urbicon-ui/auth/server/adapters/prisma';

const federated = createPrismaFederatedAccountRepository(prisma); // throws if the model is missing

export const handle = createFederatedAuthHandle({
  jwksUrl: 'https://auth.example.com/.well-known/jwks.json', // https enforced (http: localhost only)
  cookieName: 'session', // must match the IdP's jwt.cookieName
  loginUrl: 'https://auth.example.com/auth/login',
  publicRoutes: [{ path: '/', exact: true }, '/pricing'], // exact: that pathname; a string: a prefix
  resolveUser: async (identity) => {
    // THE authorization decision of this app — identity.subject is the stable key.
    const link = await federated.findByFederatedId('https://auth.example.com', identity.subject);
    if (!link) return null; // unknown identity → no access (fail-closed)
    return db.user.findUnique({ where: { id: link.userId } }); // roles are THIS app's columns
  }
});
```

The `FederatedAccount` link table (`findByFederatedId` / `linkFederatedAccount` / `unlinkFederatedAccount`, unique on `(issuer, subject)`) ships as an optional repo section in both adapters — see the [Prisma Schema](#prisma-schema); the `issuer` string is *your* stable label for the IdP (canonically its origin — the token carries no `iss` claim, the trust anchor is the one `jwksUrl` you configured). Linking is idempotent for the same user and **refuses** re-linking a pair to a different user (account-takeover primitive); the explicit path is `unlinkFederatedAccount(userId, { issuer, subject })` — **owner-scoped** (one conditional delete; returns `true` iff a link owned by `userId` was removed), so the unlink→re-link two-step cannot take over a foreign identity either. Onboarding flows (invite-based, email-match against `identity.email`, admin-approved) are the consumer's own policy in `resolveUser`. Consumers without a database can resolve users without any repo — `resolveUser` is just a function.

### Key-rotation runbook (`previousPublicKeys`)

1. Generate the next pair: `const next = await generateES256KeyPair()`.
2. On the IdP, deploy in ONE step: `signingKey: next.privateKey`, and move the **public** JWK of the retiring key into `jwt.previousPublicKeys` (it already carries its `kid`; for a hand-built entry derive it with `computeJwkThumbprint`). The JWKS now serves both keys; old sessions keep verifying, new tokens carry the new `kid`.
3. Consumers converge automatically: an unknown `kid` triggers a (cooldown-limited) JWKS refresh, so the new key propagates within about a minute — no consumer deploy.
4. After the old sessions have expired (`jwt.expiresIn`, default 7d), remove the retired entry from `previousPublicKeys`. Removal is the kill switch: tokens signed by a removed key fail verification everywhere.

### Limitations (deliberate v1 scope)

- **Revocation blindness:** consumers cannot see the IdP's `tokenVersion` bumps ("log out everywhere"), so an IdP-revoked session stays verifiable at consumers until `exp`. Bound the window with short-lived IdP access tokens (`refreshToken` rotation keeps UX intact) and/or the consumer-side `maxTokenAge` option; emergency global kill = rotate the signing key *without* keeping the old public key.
- **Same trust domain:** cookie-based federation needs a shared parent domain (`cookieDomain`). Cross-domain SSO (redirect-based token handoff, OIDC) is out of scope — as is acting as an OAuth/OIDC provider for third parties (see the auth package non-goals).
- **Logout is IdP-global:** the consumer never clears the shared cookie; "sign out of one app only" does not exist in this model (deny via `resolveUser` instead).
- **Sibling subdomains are full trust peers:** the shared-domain session cookie is readable and settable by every host under `cookieDomain`. A compromised sibling (`evil.example.com`) can (a) **replay** the bearer JWT it receives to any other sibling until `exp`, and (b) **set** a `.example.com` session cookie to pin a victim onto an attacker-chosen — but validly signed — session (cookie-tossing / session fixation). Put only apps you trust as peers under one `cookieDomain`, and give each sibling's CSRF cookie a `__Host-` prefix so it can't be tossed across subdomains.
- **The consumer handle runs no CSRF gate:** unlike `createAuthHandle`, `createFederatedAuthHandle` does not check request origin. SvelteKit's kernel CSRF gate covers form-encoded cross-site POSTs but **not** JSON ones (see [Known Limitations](#known-limitations--security-gaps)), so a cookie-authenticated JSON mutating endpoint on a consumer must enforce its own CSRF defense. The `trustedOrigins: ['*']` resolution from Known Limitations is **off-limits on a federated consumer** unless you build the backstop yourself: there is no `validateCsrf` behind this handle, so `['*']` would leave every cookie-authenticated form mutation of the app unprotected. A federated consumer that must expose its own header-less cross-origin endpoint (own OAuth token endpoint, webhook) first gates its cookie-authenticated mutations by calling the exported `validateCsrf(event.request, event.url)` in its own hook (sequenced before `createFederatedAuthHandle`, with the cookieless endpoint paths exempted), and only then disables the kernel gate.

## Prisma Schema

The reference schema ships in the package, at `node_modules/@urbicon-ui/auth/prisma/auth-schema.prisma` (`packages/auth/prisma/auth-schema.prisma` in this repo). Ten models: User, Invitation, PushSubscription, Notification, NotificationType, NotificationPreference, Passkey, RefreshToken (rotation; required once `config.refreshToken` is set), TwoFactorBackupCode, FederatedAccount (consumer-side federation link, optional). The User model carries the 2FA columns `totpSecret` (AES-256-GCM-encrypted), `totpEnabled`, `totpConfirmedAt`. The reference schema puts `onDelete: Cascade` on all eight dependent models, `Invitation.invitedBy` included. The delete-account handler **still** removes sent invitations by hand inside its `$transaction`, so an adapter over a schema without that cascade behaves identically; the conformance suite pins both — the hand-written half directly, the rest through `user.delete erases the dependents of every declared repository`.

**A model your client does not have drops its feature to `undefined`.** That is the design — `createPrismaRepos` wires what exists — but the absences differ in how visible they are. `passkey` makes `createPasskeyHandlers` throw at wiring; `refreshToken` makes both wiring entry points throw whenever `config.refreshToken` is set; `twoFactorBackupCode` makes the 2FA handlers answer `feature_unavailable` 400; `notification` is a type error, because the notification service requires that repo. The two that nothing else surfaces are **`pushSubscription`** (web-push delivery is skipped for every notification — the DB row and the SSE event still happen) and **`notificationPreference`** (per-user channel preferences are ignored and notifications go out on every channel the type declares). Every absent model is reported once per Prisma client at factory time. The report defaults to `console` — the same sink `config.logger ?? console` resolves to — so pass `createPrismaRepos(prisma, { logger })` when the app configures its own `config.logger`, to keep the wiring diagnostics with the rest of the auth logs. Note the dedup key is the client, not the logger: whichever call comes first wins, so wire the logger on the first one.

### Upgrading an existing database

The `Invitation` model gained three columns: `tokenHash` (`@unique`, NOT NULL),
`expiresAt` (NOT NULL) and `emailedAt`. Two of them have no default, and that is
deliberate — an invitation minted under the old rules is redeemable by anyone who
knows the address, which is the hole this closes.

**Every unused invitation becomes invalid. The admins re-invite** — which no
longer needs a mail transport, since the panel now hands back a copyable link.

Adding two NOT NULL columns to a table that already has rows does not work in one
statement, and a constant backfill collides with the unique index. Add them
nullable, fill per row, then tighten — the shape below runs on PostgreSQL as
written and translates directly to other engines:

```sql
-- 1. Unused invitations are the ones that must not survive: under the old rules
--    they are redeemable by anyone who knows the address.
DELETE FROM "Invitation" WHERE "usedAt" IS NULL;

-- 2. Add nullable, so existing (already-redeemed) rows are accepted.
ALTER TABLE "Invitation"
  ADD COLUMN "tokenHash" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "emailedAt" TIMESTAMP(3);

-- 3. Backfill the surviving history. The values are inert — these invitations
--    are spent — but `tokenHash` is UNIQUE, so a constant will not do. Anything
--    per-row and unguessable works; the id is both.
UPDATE "Invitation"
   SET "tokenHash" = 'migrated:' || "id",
       "expiresAt" = "createdAt"
 WHERE "tokenHash" IS NULL;

-- 4. Now the constraints hold.
ALTER TABLE "Invitation"
  ALTER COLUMN "tokenHash" SET NOT NULL,
  ALTER COLUMN "expiresAt" SET NOT NULL;
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
```

Redeemed rows are kept because the admin panel lists them (they render as
`Registered`); their backfilled `expiresAt` sits in the past and their
`tokenHash` matches no real token, so neither is redeemable.

## Adapter Authoring Guide

Persistence is behind a repository interface (`Repositories` in `packages/auth/src/lib/server/adapters/types.ts`). The auth core never talks to a database directly — it talks to `repos.user`, `repos.refreshToken`, etc. This section is the contract for writing your own adapter.

### What we ship, and the strategy

| Adapter               | Import                                                                           | Use                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Prisma**            | `@urbicon-ui/auth/server/adapters/prisma` (`createPrismaRepos`)                  | Production reference. Copy the models from the shipped `prisma/auth-schema.prisma`.                           |
| **In-memory**         | `@urbicon-ui/auth/server/adapters/in-memory` (`createInMemoryRepos`)             | Dev/test only — heap Maps, single-process, wiped on restart. The five-minute quickstart and the test fixture. `createInMemoryRepos()` is a fresh `createInMemoryStore()` with every repository built on it; take a piece of it — say the refresh-token repository beside a user store of your own — by building that factory on a store handle (`createInMemoryRefreshTokenRepository(createInMemoryStore())`). Repositories on one store share its rows, and `user.delete` erases a user's dependents from every table of that store. The store carries the role type — `createInMemoryStore<'ADMIN' \| 'USER'>()` — and every factory infers it from the handle; a role-typed factory on an untyped store is a type error. |
| **Conformance suite** | `@urbicon-ui/auth/server/adapters/conformance` (`describeRepositoryConformance`) | Not an adapter — the executable contract every adapter validates itself against. Wired to vitest; under another runner import `…/conformance-core` and pass `{ runner: { describe, it, expect } }`. |

We deliberately **do not** ship one official adapter per ORM (Drizzle, Kysely, …). Each interface change would then have to be maintained × N adapters. Instead the interface **is** the contract and the conformance suite makes a third-party adapter _provably_ safe rather than hopefully-safe. A Drizzle worked example is below; ship it in your own app, validate it with the suite.

### The contract: what every adapter MUST guarantee

The interface JSDoc (`types.ts`) is authoritative; these are the invariants that are easy to get wrong. **Getting any of these wrong is a security bug**, not a style nit — a non-atomic token claim double-spends a single-use reset link; an unscoped delete lets one user silence another's security notifications.

| Operation                                                                                | Guarantee                                                                                                                                                                                                                                                                                                                           | Why                                                                                          |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `refreshToken.revoke(id)`                                                                | Compare-and-set: flip `revokedAt` null→now **only if still live**; return `true` iff this call won (`count === 1`).                                                                                                                                                                                                                 | Rotation race-safety — two concurrent rotations must yield exactly one live successor.       |
| `refreshToken.revokeFamilyForUser(userId, family)`                                       | Revoke the family in one write **scoped to `userId`** (`UPDATE … WHERE family = ? AND userId = ?`); return `true` iff a row the caller owns was revoked, else `false` (→ 404/no-op). Never revoke by `family` alone.                                                                                                                | IDOR — a guessed family id must not let one user sign another user out of their session.     |
| `user.consumeResetToken` / `consumeVerificationToken`                                    | Single conditional write that clears the token; return the user only on the winning claim, else `null`. Purge an expired token's hash. **A `null` stored expiry reads as _no deadline_** in both shipped adapters — write the expiry the setter handed you, or that token stays claimable forever.                                                                                                                                                                                              | One reset/verify link → one use; no double-spend under concurrency.                          |
| `user.consumeEmailChangeToken`                                                           | Single conditional write that swaps `email`←`pendingEmail` and sets `emailVerified`, clearing the pending fields — only if the token matches, is unexpired, **and** the target address is still free. A collision with another account is a **failed claim** (`null`), never a duplicate email. Purge an expired token's artifacts. | One email-change link → one use; respects `email` uniqueness under concurrency.              |
| `invitation.findByTokenHash(hash)`                                                       | Look up by SHA-256 of the token. Returns used and expired rows too — the handler tells the three cases apart. | This is the registration gate; knowing an address is not.                                    |
| `invitation.markEmailed(id, at)`                                                          | Record that the invite mail went out. No-op for a missing id.                                                | `emailedAt` is what allows `autoVerifyInvited` to skip verification.                          |
| `invitation.markUsedIfUnused(id)`                                                        | CAS: flip `usedAt` null→now; `true` iff this call won.                                                                                                                                                                                                                                                                              | One invitation → one registration.                                                           |
| `backupCode.consumeIfUnused(userId, hash)`                                               | Single conditional write scoped to `userId` that flips an unused code to used; `true` iff this call won. Never `SELECT` then `UPDATE`.                                                                                                                                                                                              | One backup code → one redemption; no cross-user redemption (IDOR).                           |
| `user.incrementTokenVersion`                                                             | Atomic `increment`, never read-modify-write.                                                                                                                                                                                                                                                                                        | Parallel "log out everywhere" must not lose an increment.                                    |
| `user.recordFailedLogin`                                                                 | Atomic `increment`; read the new count from the write. Set the lock with a write **guarded** on the DB-side count (`failedLoginAttempts >= maxAttempts`), not the value just read. Stamp the attempt's time, and hand it back as `lastFailedAt` from `getFailedLoginAttempts`. A store that cannot keep that column returns `null` there — never a stand-in timestamp.                                                     | Lockout must not under-count under credential stuffing, nor set the lock from a stale count. `lastFailedAt` is what dates the count: `null` costs the decay (counters then only fall on a successful sign-in, the pre-decay behaviour), a stand-in would date an old count as current and hand out a fresh set of attempts. |
| `user.resetFailedLoginsIfStale(id, cutoff)`                                              | The clear of `resetFailedLogins`, **guarded in the store**: one conditional write, `UPDATE … WHERE id = ? AND lastFailedLogin <= ?`. A row without a `lastFailedAt` matches nothing. | The login handler decays a count it read as stale, and that write can land after other requests counted failures and set a lock; each of those re-dates the row past the cutoff. Applied unguarded, the decay becomes a way to wipe a live lockout. |
| `passkey.updateCounter(id, n)`                                                           | CAS: bump only if stored `< n`; `false` if nothing advanced. `n === 0` → counterless, touch `lastUsedAt` only.                                                                                                                                                                                                                      | Cloned-authenticator detection.                                                              |
| `notification.markAsRead`/`delete`, `pushSubscription.delete`, `passkey.delete`/`rename` | Scope every mutation to the owner `userId`. A non-owner call must not mutate (no-op **or** throw both fine).                                                                                                                                                                                                                        | IDOR — knowing an id/endpoint must not let an attacker touch another user's row.             |
| `pushSubscription.create`                                                                | Upsert-by-`endpoint`: a row with the same endpoint is updated in place. Reassigning it to a *different* user is **key-gated**: only when the submitted keys equal the stored ones (constant-time on the decoded bytes) — otherwise return `'rejected'` without writing. Never fail on the unique endpoint.                          | Re-enabling push re-sends the browser's *existing* subscription (the duplicate POST is the normal case); key possession is what separates the legitimate user switch from an endpoint-URL takeover. |
| `user.delete`                                                                            | Hard-delete plus dependents: rely on `onDelete: Cascade` for passkeys/tokens/notifications/subscriptions/preferences/backup-codes/federated-links, and delete the invitations the user **sent** by hand as well (portable for a schema whose `invitedBy` FK has no cascade), ideally in one transaction. Conformance pins every dependent whose repository you declare — removed, not merely revoked.                                                 | GDPR erasure must not leave orphans; the sent-invitations half is the part every adapter writes itself. |

The CAS/claim operations are why the interface returns `Promise<boolean>` (or the claimed entity) rather than `void`: the business logic in the core (`rotateRefreshToken`, the register/reset/verify handlers) reads that return value to detect a lost race. Implement each as a **single conditional statement** (`UPDATE … WHERE <still-claimable> RETURNING …`), never `SELECT` then `UPDATE` across an `await` — that gap is the race.

#### Ids: opaque strings, and a miss is never an error

The package never generates or parses an id. It stores what your adapter returned and hands it back verbatim, so any id scheme works — `uuid`, cuid2, ULID, or an integer key rendered as a string. The shipped schema writes `String @id @default(uuid())`, which Prisma maps to `text`; **you may map ids to a native type instead** (`String @id @default(uuid()) @db.Uuid`), and you do not need to change the interface for it, because `id: string` describes the wire value, not the column.

One limit on the shipped Prisma adapter specifically: it passes ids through as the strings the interface gives it, so the column has to be string-shaped (`text`, `uuid`, `citext`). A numeric key needs an adapter that converts at the boundary — the interface still fits (render the number as a string), the shipped adapter does not do the conversion for you.

What a native id type does change is what happens to a value that does not fit it. Ids arrive from outside — a URL segment, a request body — and a `uuid` or `bigint` column rejects an unparsable value with SQLSTATE 22P02 rather than simply matching nothing, on **reads** as much as on writes:

```sql
SELECT … WHERE id = 'not-an-id'   -- text: 0 rows · uuid: ERROR 22P02
```

So the contract has two rules about misses, and both are pinned by the conformance suite:

1. **An id your store cannot represent behaves exactly like an id that is absent** — return `null`, return `false`, no-op. Never throw. Catch that one error on that one argument and turn it into the miss; every other database error must keep propagating. The shipped Prisma adapter does this for you (`idSafeClient` in `adapters/prisma.ts`).
2. **A scoped mutation that matches no row is a no-op, not a throw.** "Not yours" and "not there" are the same answer. In Prisma terms: `updateMany`/`deleteMany`, whose zero-match result is a count, not the `P2025` that `update`/`delete` raise.

Both exist because a miss is a normal answer, and only a throw is not. What the route does with it varies — the session revoke answers `404` (it gets a boolean back), while the notification, passkey and invitation delete routes are deliberately idempotent and answer `200` whether or not a row matched — but an adapter that throws turns every one of them into a `500`, so a malformed id becomes a way to fail those endpoints on demand.

Three further cross-cutting conventions round the contract off. **Owner-first parameters:** every owner-scoped mutation takes `(userId, id, …)` — `markAsRead(userId, id)`, `passkey.delete(userId, credentialId)`, `pushSubscription.delete(userId, endpoint)`, `backupCode.consumeIfUnused(userId, codeHash)`. With two plain strings a swapped call still compiles, so the single fixed order is what keeps a swap greppable. **Pre-normalized emails:** every email reaching a repository (lookups and create data) was already trimmed + lowercased by the package's validation — match and store verbatim, never re-normalize. **Feature tiers:** `UserRepository` is sectioned by feature (core · email verification · password reset · email change · TOTP); an adapter for an app that will never mount a feature may stub that section with throwing methods, since nothing calls a section whose feature is not wired — the shipped adapters implement everything (see the section comments in `adapters/types.ts`).

### Structural boundary — the `XLike` pattern

`createPrismaRepos<AppRole>(prisma)` accepts the consumer's generated client through a structural interface (`PrismaLike`). Every method returns `Promise<PrismaRow>` where `PrismaRow = any` — a single, intentional `eslint-disable` at the module boundary.

`PrismaLike` lists what the adapter actually calls, so it moves when the adapter does. It now asks for `deleteMany` on `notification` and `passkey`, and no longer asks for the single-row `delete` on `notification`, `passkey` and `invitation`, nor `update` on `notification` and `passkey` — those scoped writes moved to the `…Many` operations (see the id contract above). A generated client satisfies both versions; only a hand-written stand-in needs the two new methods. It buys wider version coverage in exchange: the old calls needed Prisma's extended `WhereUniqueInput` (`update({ where: { credentialId, userId } })`, GA in 5.0), while `updateMany`/`deleteMany` take an ordinary filter.

The reason is concrete: every consumer generates its **own** row shapes from its **own** schema (extra columns, RLS-only fields, soft-delete flags). Typing `PrismaLike.user.findUnique` against our internal `User`/`Passkey` shapes would either reject the consumer's wider rows or force a per-method generic. Both leak the adapter's internal type model into the consumer signature.

Inside the adapter, each method casts the returned row to the **internal** shape via a named `mapX(row)` seam — that's where a missing column surfaces as a TypeScript error, not as a silent `any` at the call site:

```ts
// XLike — permissive at the boundary
type PrismaRow = any;
interface PrismaLike {
  user: { findUnique(args: unknown): Promise<PrismaRow> /* … */ };
  passkey: { findMany(args: unknown): Promise<PrismaRow> /* … */ };
}

// Adapter method — strict at the seam
async function listPasskeys(userId: string): Promise<Passkey[]> {
  const rows = await prisma.passkey.findMany({ where: { userId } });
  return (rows as PrismaPasskeyRow[]).map(mapPasskey); // ← typed conversion
}
```

The `mapX` seams (`mapUser`, `mapPasskey`, `mapRefreshToken`, `mapInvitation`, `mapNotification`, `mapPushSubscription`, `mapNotificationPreference`) live next to each other at the bottom of `prisma.ts`. `mapInvitation` doubles as a security projection: invitation results feed the admin HTTP response directly, so the seam is what keeps `invitedById` (and consumer extra columns) out of the wire format — the conformance suite asserts the exact field set. A new adapter follows the same shape: a structural `XLike` interface with `unknown` args + one permissive return type, narrow casts inside each method, named `mapX(row)` helpers so the conversion is testable. Don't expose generated row types to the consumer — that's what made the original adapter sprout 32 `Promise<unknown>` errors cross-package.

### Validate it: the conformance suite

Whatever you build, prove it upholds the contract by running the shared suite from a `*.test.ts`. The entry below registers vitest for you; under any other runner import `…/adapters/conformance-core` instead and pass `{ runner: { describe, it, expect } }` — that module imports no runner of its own:

```ts
import { describeRepositoryConformance } from '@urbicon-ui/auth/server/adapters/conformance';
import { createMyAdapter } from './my-adapter';

describeRepositoryConformance('my-adapter', {
  role: 'USER',
  // All seven optional repos, `false` for the ones you do not implement — an
  // omitted key reads as "not implemented" and drops its checks silently.
  capabilities: {
    refreshToken: true,
    passkey: true,
    notification: true,
    pushSubscription: true,
    notificationPreference: true,
    backupCode: true, // set to false if you do not implement this
    federatedAccount: true // set to false if you do not implement this
  },
  // MUST hand back a fresh, isolated repo set per check (wipe schema / new tx).
  setup: () => createMyAdapter(freshTestDatabase())
});
```

The suite drives each atomic claim under `Promise.all` concurrency, asserts exactly one winner, and checks every ownership scope. It is exactly what the shipped Prisma and in-memory adapters run against in CI — including a negative control proving a non-atomic adapter is _rejected_, so the checks have teeth.

Read the suite title: it states how many checks ran out of how many, and names every repository you left undeclared. A check whose repository is undeclared is reported as skipped, so a short capability list is a green run that asserted less than you think — including `backupCode.consumeIfUnused`, whose single-use-under-concurrency guarantee is in the table above. `summarizeConformanceRun(harness)` returns the same numbers if you want to gate on them yourself.

### Worked example — a Drizzle adapter

The same `XLike` + `mapX` + single-statement-CAS pattern in Drizzle. The trick on every claim is `UPDATE … WHERE <still-claimable> RETURNING …` and treating "0 rows returned" as "lost the race" — Drizzle's `.returning()` gives the row count for free.

```ts
import { and, desc, eq, gt, isNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import type {
  FullAuthUser,
  RefreshTokenRecord,
  RefreshTokenRepository,
  UserRepository /* … */
} from '@urbicon-ui/auth/server';

// The `mapX` seam. The row shape gets its own type and the seam takes it as a
// parameter — that is the half that does the work. Against `row: any` a
// renamed column (`row.token_hash`) type-checks silently; against
// `RefreshTokenRow` it is a `TS2551` right at the seam. The shipped Prisma
// adapter types every seam this way; `any` belongs at the db boundary, not here.
interface RefreshTokenRow {
  id: string;
  userId: string;
  tokenHash: string;
  family: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedById?: string | null;
  createdAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}

const mapRefreshToken = (row: RefreshTokenRow): RefreshTokenRecord => ({
  id: row.id,
  userId: row.userId,
  tokenHash: row.tokenHash,
  family: row.family,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt ?? null,
  replacedById: row.replacedById ?? null,
  createdAt: row.createdAt,
  userAgent: row.userAgent ?? null,
  ip: row.ip ?? null
});
// Same seam against `FullAuthUser`, in your own file — declared here so this
// excerpt type-checks standalone.
declare function mapUser(row: any): FullAuthUser;

// `DrizzleLike` is the structural boundary — pass any drizzle db + your tables.
// All nine `RefreshTokenRepository` methods are here, and the annotated return
// type is what keeps them here: leave one out and the factory is a `TS2741`
// naming it. Annotate, never assert — see the note on the user factory below.
export function createDrizzleRefreshTokenRepository(db: any, t: any): RefreshTokenRepository {
  return {
    async create(data) {
      const [row] = await db.insert(t.refreshToken).values(data).returning();
      return mapRefreshToken(row);
    },
    async findByHash(tokenHash) {
      const [row] = await db
        .select()
        .from(t.refreshToken)
        .where(eq(t.refreshToken.tokenHash, tokenHash))
        .limit(1);
      return row ? mapRefreshToken(row) : null;
    },
    async revoke(id, replacedById) {
      // CAS: revoke only while still live; RETURNING gives the win/lose count.
      const won = await db
        .update(t.refreshToken)
        .set({ revokedAt: new Date(), replacedById: replacedById ?? null })
        .where(and(eq(t.refreshToken.id, id), isNull(t.refreshToken.revokedAt)))
        .returning({ id: t.refreshToken.id });
      return won.length === 1;
    },
    async revokeFamily(family) {
      await db
        .update(t.refreshToken)
        .set({ revokedAt: new Date() })
        .where(and(eq(t.refreshToken.family, family), isNull(t.refreshToken.revokedAt)));
    },
    async revokeAllForUser(userId) {
      await db
        .update(t.refreshToken)
        .set({ revokedAt: new Date() })
        .where(and(eq(t.refreshToken.userId, userId), isNull(t.refreshToken.revokedAt)));
    },
    async deleteExpired() {
      const gone = await db
        .delete(t.refreshToken)
        .where(lt(t.refreshToken.expiresAt, new Date()))
        .returning({ id: t.refreshToken.id });
      return gone.length;
    },
    async listActiveByUser(userId) {
      // Live sessions for the session list: non-revoked AND unexpired, newest
      // first. Rotation keeps one live token per family, so one row = one
      // session.
      const rows = await db
        .select()
        .from(t.refreshToken)
        .where(
          and(
            eq(t.refreshToken.userId, userId),
            isNull(t.refreshToken.revokedAt),
            gt(t.refreshToken.expiresAt, new Date())
          )
        )
        .orderBy(desc(t.refreshToken.createdAt));
      return rows.map(mapRefreshToken);
    },
    async revokeFamilyForUser(userId, family) {
      // revokeFamily plus the mandatory owner guard. Without the userId
      // predicate a guessed family id signs another user out (IDOR) — this is
      // the method the session-revoke route calls, and its boolean is what
      // becomes the 404.
      const revoked = await db
        .update(t.refreshToken)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(t.refreshToken.userId, userId),
            eq(t.refreshToken.family, family),
            isNull(t.refreshToken.revokedAt)
          )
        )
        .returning({ id: t.refreshToken.id });
      return revoked.length > 0;
    },
    async revokeOtherFamiliesForUser(userId, keepFamily) {
      // "Sign out all other sessions": everything of this user except the
      // caller's own family, in one write.
      await db
        .update(t.refreshToken)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(t.refreshToken.userId, userId),
            ne(t.refreshToken.family, keepFamily),
            isNull(t.refreshToken.revokedAt)
          )
        );
    }
  };
}

export function createDrizzleUserRepository(db: any, t: any): UserRepository {
  return {
    // … findById/findByEmail/create/setPasswordResetToken etc. as plain reads/writes …
    async consumeResetToken(tokenHash) {
      const now = new Date();
      // Single conditional claim: clear the token only if it still matches and
      // is unexpired; RETURNING tells us if *this* call won.
      const [claimed] = await db
        .update(t.user)
        .set({ passwordResetToken: null, passwordResetTokenExpires: null })
        .where(
          and(
            eq(t.user.passwordResetToken, tokenHash),
            or(isNull(t.user.passwordResetTokenExpires), gt(t.user.passwordResetTokenExpires, now))
          )
        )
        .returning();
      if (claimed) return mapUser(claimed);
      // Lost the race or expired → purge any expired artifact, return null.
      await db
        .update(t.user)
        .set({ passwordResetToken: null, passwordResetTokenExpires: null })
        .where(
          and(eq(t.user.passwordResetToken, tokenHash), lte(t.user.passwordResetTokenExpires, now))
        );
      return null;
    },
    async incrementTokenVersion(id) {
      // Atomic increment — never read-modify-write.
      await db
        .update(t.user)
        .set({ tokenVersion: sql`${t.user.tokenVersion} + 1` })
        .where(eq(t.user.id, id));
    }
    // … recordFailedLogin (sql increment), consumeVerificationToken (same CAS shape) …

    // The assertion is what lets this excerpt stop at 2 of the 21 methods, and
    // it switches off exactly the check the refresh-token factory above gets
    // from its return type — without the `as`: `TS2740`, 19 missing. Do not
    // carry it into your own file: `createAuthHandle` calls `user.findById` on
    // every authenticated request, so a method you never wrote fails per
    // request rather than at startup. Annotate the return type instead and let
    // the compiler enumerate what is left to write.
  } as UserRepository;
}

// invitation.markUsedIfUnused and passkey.updateCounter follow the identical
// "UPDATE … WHERE <claimable> RETURNING {id}; return rows.length === 1" shape.
```

Wire the per-repo factories into one `Repositories` object (mirroring `createPrismaRepos`), point `describeRepositoryConformance` at it, and you have a _proven_ adapter. `drizzle-orm` stays a `peerDependency`/optional in your app — never a runtime dependency of this package.

## Tests

900+ unit tests (67 files) + 5 E2E tests (`e2e/auth.spec.ts`). Run with:

```bash
cd packages/auth && bunx --bun vitest run   # unit
bun run test:e2e                            # Playwright (from the repo root)
```

**Covered:** crypto primitives (JWT, HMAC, PBKDF2, CBOR, WebAuthn parsing, TOTP/HOTP against RFC 6238/4226 vectors, AES-256-GCM secret encrypt/decrypt), CSRF, rate-limiter, session cookies, validation, notification registry/SSE/push, login handler (incl. 2FA gate), account-management and session-listing handlers, 2FA flow (setup/enable/disable/verify, backup-code single-use, pending-2FA token), E2E core flow (register → protected → logout → refresh rotation → reuse detection). **Adapter conformance** (`adapters/conformance.ts`): the atomic claim/scope guarantees run against the in-memory adapter **and** the Prisma adapter (via a faithful in-memory `PrismaLike` fake) — this is the first real test coverage for `adapters/prisma.ts` — plus a negative control that demonstrably fails a non-atomic adapter. The release history (v0.8.1 – v0.11.0) covers every hardening-1.0 milestone — details in the changelog.

**Still open:** end-to-end attestation/assertion with a real authenticator; conformance against a _real_ database engine (the Prisma path is currently covered via the `PrismaLike` fake, not against a running Postgres).

## Error Contract

Every handler (and the `createAuthHandle` gates) answers errors with one JSON shape: `{ error: string, code: AuthErrorCode, … }` — `error` is human-readable English prose, `code` the stable machine value from the append-only `AUTH_ERROR_CODES` set (never repurposed, only extended; the same code can appear under different HTTP statuses when the context differs, e.g. `invalid_code` is 400 on 2FA-enable and 401 on 2FA-verify). Validation failures additionally carry the full field list as `errors`, and the first field message replaces the generic prose. Rate limits answer `429 rate_limited` with a `Retry-After` header, while the per-user cap on concurrent SSE streams answers `429 connection_limit` — a separate code because backoff never clears a connection cap, so a client that treats the two alike retries forever. Reachable for an SSE client built on `fetch`, and for anything reading the log or metrics by `code`; **not** for the shipped `<NotificationListener>`, whose native `EventSource` exposes no response body (`onerror` receives an opaque `Event`) and which keeps its exponential reconnect loop running against the cap. The CSRF gate answers `403 csrf_failed`; the previously-plaintext SSE-stream refusals are JSON as of v6.17.0 (same `EventSource` blindness, so that change is inert there too). The push-subscription writes distinguish `push_endpoint_conflict` (endpoint owned by another account — permanent) from `push_subscription_limit` (per-user device cap). The one deliberate exception: `createMeHandler` answers `401 { user: null }` — that is the session-status contract of the client store, not an error report.

Localized clients map `code` via `errorMessageFromCode(code, t, error)` (exported from the package root): known code → locale bundle, unknown code or missing translation → the server prose, neither → `undefined` for the caller's own fallback. `validation_error` deliberately prefers the field-level server prose. The pre-built components do this everywhere via their shared `errorTextFromBody` helper. One code is client-synthesized rather than served: `network_error` (the request never reached the server — offline, DNS, CORS), produced by the stores and mapped to `auth.errors.networkError` like any other code.

**The code→locale-key table is bound to the union.** `AUTH_ERROR_MESSAGE_KEYS` (`i18n/error-keys.ts`) is `satisfies Record<AuthErrorCode | 'network_error', …>`, so a new server code that nobody keys is a compile error rather than an English sentence on a localized page; `null` marks the two push codes, whose copy `<PushPermissionPrompt>` owns (`notifications.push.errorConflict` / `errorLimit`). The English `error` prose is **read out of the `en` bundle through that same table** — there is one English text per code, not one for i18n consumers and another for the rest.

**Passkey ceremonies answer uniformly.** All eight failure paths return the bare `passkey_verification_failed` with no prose override: none of the causes is actionable by the end user, and one of them — the sign-counter regression — is a possible-cloned-authenticator signal that must not be readable in a page. What distinguishes them stays server-side: `config.hooks.onLoginFailed(email, reason)` receives a distinct reason per outcome (`challenge_missing`, `unknown_credential`, `user_handle_mismatch`, `credential_deleted`, `counter_regression`, `user_not_found`, `invalid_assertion`), and `config.logger` receives the WebAuthn detail on the paths a reason cannot carry.

## Known Limitations & Security Gaps

As of: 2026-07-21. The auth core is **stable** — all initial hardening items are closed; the self-service surfaces added in v5.x (account management, session listing, TOTP 2FA) are initially marked **`beta`**. The complete fix history lives in the monorepo changelog; relevant versions per area are referenced in the feature-matrix tables of the [package README](../README.md).

### 🛡️ Defense-in-Depth (planned)

- **Monitoring recommendations** — for production deployments, track latency/error rate on the auth handlers; no package code needed, only a doc reference in the consumer app.

### Account Enumeration & Timing

The package deliberately avoids revealing whether an account exists, via either response content **or** timing:

- **Login** — an unknown email goes through the same PBKDF2 verify as a wrong password (against a discarded dummy hash with the configured work factor) before returning `401`. There is no measurable "user does not exist" shortcut.
- **Forgot password** — always responds with `{ success: true }`; the token write + email send run decoupled from the response (fire-and-forget), so the response time doesn't reveal whether the account exists. Since a failure then no longer surfaces as an HTTP status, it is reported via `config.hooks.onPasswordResetFailed` (+ `config.logger.error`) — hook it into your own error tracker so a broken mail transport doesn't silently lock users out of recovery. **Serverless/edge note:** runtimes that freeze the worker after the response is sent can cut off the downstream work (and its logging/the hook) — use a queue-backed email transport there so delivery stays reliable.
- **Register** — gated on **possession of the invitation token**, and on nothing else. Without a valid token every email returns the same `403 "invitation required"`, registered or not. The more precise `403`/`409` messages are visible only to someone holding a valid unused token, which is admin-minted and not guessable — not a usable enumeration vector, and the clear messages help the legitimately invited person. The token also names its invitee: registering with a different address is refused, so a leaked link cannot be redeemed onto an attacker-chosen account.
- **WebAuthn auth options** — an unknown email returns the same `200` options response (empty `allowCredentials`) as a known one; discoverable/usernameless login works without any email at all.

### Rate-Limiting, Lockout & Route Scope (deliberate trade-offs)

- **Lockout DoS** — the login rate-limit is **per-IP**, the lockout is **account-based**. An attacker with many IPs (IPv6 rotation, proxy pool) can thereby deliberately lock out someone else's account without tripping their own IP rate-limit. This is the classic lockout trade-off (brute-force protection vs. DoS). If you don't want that, set `lockout: null` (then the per-IP rate-limit alone protects) — but the default deliberately leaves the lockout on, because brute-force protection is the more important risk for most apps. For visibility, consider adding your own monitoring on `lockedUntil` writes.
- **The login limiter brakes failures, not cost** — a correct password refunds the slot its request took, so successful sign-ins from one address are not limited at all, and each of them costs a PBKDF2 run (~38 ms at the default work factor) plus a session establish. An attacker needs one account of their own for that, no one else's password; credential stuffing with a high hit rate reads the same way, every valid pair being a free session. Deliberately not capped here: a per-IP counter has never stopped a distributed cost attack, and one account hammering from one address is what an edge rate-limit (reverse proxy, WAF) is for — so a second per-IP counter that successes do not refund would be surface without protection. If the cost matters to you, brake at the edge; do not lower `password.pbkdf2Iterations` for it.
- **At the defaults the limiter answers before the lockout does** — both thresholds are five, and the per-IP limiter runs at the top of the handler, before the account is looked up. Six wrong passwords from one address are answered `401 ×5, 429`: the fifth failure did set `lockedUntil`, but that address never sees the `423`. The same six attempts from six addresses are answered `401 ×5, 423`. The two brakes therefore divide the work by *who* is attacking: the limiter is per IP and stops a single source, the lockout is per account and stops the distributed attempt the limiter cannot see — which is also why it is the DoS-prone one of the pair. (Both sequences are pinned against the real handler and the in-memory adapter in `login.test.ts`.)
- **Failed attempts decay, and that sets the sustained guess rate** — an attempt stops counting once it is `lockout.decayMinutes` old (default 60), so typos on separate occasions never add up to a lock. The window is also the attacker's budget: every further failure re-dates the count, so waiting it out buys `maxAttempts` guesses per window — **5 per hour at the defaults**, against the ~4.3 per hour a stuck-at-threshold counter allows (one guess per `durationMinutes`, each re-locking the account). Shortening it multiplies that rate — 15 minutes would allow 20 per hour — and buys a user nothing an hour of quiet does not. (All three numbers are simulated against the real handler on a 12-hour clock in `login.test.ts`, not derived on paper.) `decayMinutes: 0` is **refused when the login handler is created**: a zero window resets the counter before every increment, so it would read as "no decay" and act as "no lockout" — run without a lockout via `lockout: null` instead. The decay needs `lastFailedAt` from `getFailedLoginAttempts`: an adapter that returns `null` there gets no decay, never a lost lockout. Its reset is `resetFailedLoginsIfStale`, guarded in the store on that same timestamp: a reset that lands after other requests have counted failures and set a lock matches nothing, so it cannot end that lock — the conformance suite fails an adapter that applies it unguarded.
- **The lockout bounds what follows a burst, not the burst** — the counter is read, then written, once per request, so requests that arrive together all pass the lock check before any of them has been counted: a simultaneous burst reaches the password check in full, with or without the decay window (pinned at twelve in `login.test.ts`, measured unchanged at fifty). That is what the per-IP `rateLimit.login` is for; the lockout limits the *next* attempts.
- **2FA verify rate-limit is per-IP, not per-account** — the public `/2fa/verify` endpoint is limited per-IP like login (`rateLimit.twoFactor`, strict default), not per-account — consistent with the package philosophy (account-level limits are themselves DoS-prone and opt-in). A distributed-IP attack would additionally need the victim's password (to set the pending-2FA cookie); with a ±1 window (10⁶ codes) + ~5-min TTL this remains practically hopeless. A per-account limiter is a deliberate later option.
- **The UV bit is self-asserted, not attested** — `attestation: 'none'` is hard-wired in the generated registration options, so the relying party never receives an authenticator certificate. `requireUserVerification` therefore verifies that the *credential itself signed* a UV flag, not that a genuine authenticator model performed a genuine PIN or biometric check; software or a modified authenticator can set the bit. It still moves the practical threat model — a stolen hardware key that demands its PIN is no longer a one-tap login — which is why passkey logins skip the TOTP gate only under enforced UV. Read the guarantee as "the credential claims user verification", not as a proof of it. Attestation-based authenticator allow-listing is out of v1 scope.
- **TOTP replay within the same time window** — v1 relies solely on the strict verify rate-limit. A stored `lastUsedStep` that prevents re-redeeming the same code within its validity (±1 period) is noted as a later hardening.
- **`publicRoutes` replaces the defaults, and a string entry is a prefix** — passing the option drops the built-in list rather than adding to it. That list is exported as `DEFAULT_PUBLIC_ROUTES` (read it there; it is not transcribed here), and `'/api/auth/'` is in it — so an override that omits it guards the app's own sign-in: an unauthenticated `POST /api/auth/login` gets `401 not_authenticated` instead of a session. Spread the constant to extend — `publicRoutes: [...DEFAULT_PUBLIC_ROUTES, '/pricing']` — and replace wholesale only for a handle scoped to routes that mount no auth endpoints of their own. A string matches with `startsWith`: `'/api/auth/'` makes **all** subroutes below it public, `'/pricing'` also publishes `/pricing-admin` and `/pricing/internal`, and `'/'` makes the **entire app** public — the obvious spelling of "my landing page is public" turns the guard off completely, and the handle warns about it at construction. One pathname alone is the object form, `{ path: '/', exact: true }`: the landing page, and nothing under it. A list held in a variable first (`const routes = [...]; createAuthHandle({ publicRoutes: routes })`) needs `as const` or the annotation `PublicRoute[]` — TypeScript otherwise widens `exact: true` to `boolean` and the assignment is a type error; an inline list needs nothing. The same two forms apply to `createFederatedAuthHandle`. Keep the list narrow, and don't place protectable app routes below a public prefix.
- **Remote functions are guarded by `event.isRemoteRequest` (+ a `/remote` POST check), not `publicRoutes`.** For SvelteKit Remote Functions (`kit.experimental.remoteFunctions`) the pathname the guard sees is **client-controlled**, via either of two transports: **(1)** the `/_app/remote/…` calls (`query` / `command` / JS-enhanced `form`) — SvelteKit overwrites `event.url.pathname` from the `x-sveltekit-pathname` header *before* the `handle` hook runs; a plain `query` is even a **GET** (payload in `?payload=`), so the kernel's non-`GET` cross-site block doesn't catch it either; and **(2)** the no-JS `<form action="?/remote=…">` fallback — dispatched through the page pipeline from the `/remote` search param, decoupled from the pathname, with `event.isRemoteRequest` left **`false`**. Either way a spoofed (or genuinely) public route such as `/auth/login` would let an unauthenticated remote call run without a session and leak every reachable row. `createAuthHandle` **default-denies** (`401`) both: keyed on the unspoofable `event.isRemoteRequest`, and — for the fallback — a `POST` carrying a truthy `/remote` action param (mirroring SvelteKit's own dispatch gate; a normal action named `remote` serializes to an empty `?/remote` and is correctly left to the path guard). Set `allowUnauthenticatedRemote: true` **only** if you deliberately expose public remote functions — you then own their authorization (check `event.locals.user` inside each). **Defense-in-depth:** even with the guard active, prefer an explicit `event.locals.user` (+ per-user ownership) check inside each remote function rather than relying on the handle alone — the guard is a backstop, not a substitute for per-function authorization.
- **SvelteKit's built-in `csrf.checkOrigin` is a separate gate that runs _before_ this package's check.** SvelteKit's request kernel performs its own Origin-CSRF check *before* the `handle` hook runs (`@sveltejs/kit` → `src/runtime/server/respond.js`). If you route a cross-origin, form-encoded `POST` *around* `createAuthHandle` — an OAuth 2.1 token endpoint, a third-party webhook — that kernel gate rejects it with `403 "Cross-site POST form submissions are forbidden"` before your hook (and therefore this package's `validateCsrf`) ever runs. Three properties make this bite: it **can't be disabled per-route from a hook** (by the time `handle` runs the 403 is already returned — the only levers are the global `kit.csrf.*` config); it fires on **form content types only** (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`, plus Kit's internal `application/x-sveltekit-formdata` — preflighted, not CORS-simple), so a JSON endpoint (MCP JSON-RPC, dynamic client registration) passes through but the OAuth **token** endpoint can't — RFC 6749 §4.1.3 mandates `application/x-www-form-urlencoded` and real callers (Claude, etc.) send **no `Origin` header**, which keeps the gate shut (a *specific* `trustedOrigins` list is consulted only when an `Origin` header is present, so no list of origins can ever admit a header-less caller); and it is **skipped under `vite dev`, never in a build** (guaranteed by the package's `@sveltejs/kit ^2.70.1` peer range — older Kits compiled the gate out of non-production-`NODE_ENV` builds, [sveltejs/kit#16313](https://github.com/sveltejs/kit/pull/16313)), so the 403 typically first surfaces *after deploy*, never in local development. **Resolution:** set `kit.csrf: { trustedOrigins: ['*'] }` in `svelte.config.js` — the official off-switch, and since Kit 2.61 the only non-deprecated one (`checkOrigin` is `@deprecated Use trustedOrigins: ['*'] instead`). The wildcard is resolved at **build time**, not matched against request origins: Kit's `write_server.js` derives `csrf_check_origin = checkOrigin && !trustedOrigins.includes('*')`, so `['*']` removes the kernel gate entirely — including for the header-less callers no literal origin list could admit. (Verify at both levels when auditing this: the runtime check in `respond.js` never matches `'*'` against an `Origin` header — the disable happens in the build-time derivation.) This affects the form gate only; Kit's separate strict same-origin check for remote-function requests (`/_app/remote/…`, non-GET) is independent of `kit.csrf.*` and stays active. Then let this package's `validateCsrf` be the single Origin gate — it is *stricter* than the kernel check (every mutating method, **all** content types incl. JSON, no allow-list, as step 1 of `createAuthHandle`), so for any request that flows through the handle the kernel check was redundant anyway. **Safe only when:** (1) every cookie-authenticated mutating route flows through `createAuthHandle` — including SvelteKit form actions such as an OAuth consent `?/approve`, and "cookie-authenticated" means *any* ambient-session-cookie route, not just this package's. *Reaching* the handle is what counts, not mounting it: in a `sequence()`, any earlier handle that returns a response without calling `resolve` (maintenance mode, a webhook endpoint implemented as a handle, a redirect handle) bypasses this gate for its routes — and with the kernel gate disabled, nothing else covers them. And (2) the handle-bypassed routes are cookieless (bearer / PKCE / API-key) — they carry no ambient credential the browser auto-sends, so they're structurally not CSRF-able and the Origin gate protected nothing there. Edge case to flag rather than assume: if you depend on SvelteKit's `trustedOrigins` allow-list for legitimate cross-origin *browser* form posts, note `validateCsrf` is strict-same-origin with no allow-list equivalent.
- **SSE presence is process-local** — `createSSEManager` registers connections in this process only; there is no cross-instance seam. On multi-instance/serverless deployments, `isOnline` false-negatives make `send()` skip the live SSE event for users connected to another instance and fall back to push (delivery still happens, via the heavier channel, provided a push subscription exists), and `recipients: 'online'` broadcasts only reach the users connected to the instance running `send()`. Treat the notification system as single-instance until a shared presence backend exists — the same class of assumption as the in-memory rate-limit store.
- **A dead passkey and an expired challenge read the same** — every ceremony failure returns one code and one localized sentence ending in "please try again" (see [Error Contract](#error-contract)). For a challenge that timed out that is the right advice; for `credential_deleted` — the browser still offers a passkey the server no longer stores — retrying can never succeed, and the user loops. The audit reason and the log tell the two apart, the UI does not. Splitting `credential_deleted` into its own code (append-only, so additive) is the fix when this shows up in support traffic; it was left as one code because the prose it replaced was equally unactionable.
- **`<NotificationListener>` cannot see why a stream was refused** — it uses native `EventSource`, which exposes no response body, so a `429 connection_limit` (per-user concurrent-stream cap) reaches it as an opaque `onerror` and its exponential reconnect loop keeps retrying against a cap that only closing a tab clears. An SSE client built on `fetch` reads the code and can stop; replacing the listener's transport is the fix, and is not done here.
- **In-memory adapter grows unbounded** — `createInMemoryRepos` doesn't clean up notifications/push subscriptions and doesn't call `deleteExpired` for refresh tokens automatically. `user.delete` is not one of these: every repository built on one `createInMemoryStore()` shares its tables, and the delete removes a user's dependent rows from all of them, the same end state the Prisma adapter gets from `onDelete: Cascade` — both are pinned by the conformance suite. This is fine for the declared dev/test scope; for long-lived processes use a persistent adapter.

### Production-Readiness Checklist

Before production use outside of controlled environments:

**Package setup (one-time):**

- [ ] Persistent-storage adapter for challenges, refresh tokens, and rate-limits configured (at >1 instance). Interfaces/adapters since v0.8.5 – v0.11.0.
- [ ] CSRF double-submit decided (`config.csrf = { doubleSubmit: true }`, since v0.8.4). Enable it **only when every cookie-authenticated mutation sends the `x-csrf-token` header** — i.e. all mutations go through this package's client stores/components or `csrfFetch`. SvelteKit **Remote Functions** (`command` / `form`) and native no-JS form posts send no such header (the remote transport is Kit-internal — you cannot attach one), so with those in play `doubleSubmit: true` would 403 every such mutation: keep it `false` and rely on Layer 1 — the Origin gate holds for a same-origin deployment on the default `SameSite=Lax` cookies, provided nothing in front of the app rewrites or injects the `Origin` header; remote-function mutations additionally sit behind Kit's own non-configurable strict same-origin remote gate. Layer 2's real added value is exactly that residue: an Origin-normalizing proxy/gateway combined with `cookieSameSite: 'none'` lets a cross-site request *satisfy* the Origin check, while the token cookie stays unreadable to the attacker — if that is your deployment, don't drop Layer 2; restructure the mutating surface so it can send the header. Optionally also `useHostPrefix: true` (HTTPS-only) against subdomain cookie injection — then also set `useHostPrefix: true` in the `csrf` config of the client stores/components.
- [ ] Refresh-token rotation enabled (`config.refreshToken = { … }`, since v0.11.0) — non-breaking, recommended in production.

**Deployment:**

- [ ] HTTPS enforced (cookies are already `secure: true`; HSTS is then set automatically by `createAuthHandle`).
- [ ] CSP adapted to the app (`config.securityHeaders.csp`) — the default `frame-ancestors 'none'` blocks only framing; a complete policy is app-specific.
- [ ] Monitoring for auth-handler latency and error rate active.
- [ ] Incident runbook for a compromised JWT secret prepared (`keyId` + `previousSecrets` allows uninterrupted rotation).
- [ ] Incident runbook for `twoFactor.encryptionKey` prepared — it has **no** overlap mechanism, so a rotation locks out every TOTP user *and* blocks their re-enrolment; a backup code — or a passkey, which is not TOTP-gated — is the way back in (see the [key-rotation runbook](#key-rotation-runbook-twofactorencryptionkey)). Keep the key backed up separately from the database, and alert on the `2fa-enable` / `2fa-verify` decryption errors in `config.logger` — they never reach `handleError`.
- [ ] If you expose a cross-origin form-encoded endpoint *outside* `createAuthHandle` (OAuth 2.1 token endpoint, webhook): `kit.csrf: { trustedOrigins: ['*'] }` set in `svelte.config.js` (the build-time off-switch for the kernel gate — a *specific* origin list can't admit the header-less callers this concerns, see [Known Limitations](#known-limitations--security-gaps)), and confirmed every cookie-authenticated mutating route still flows through the auth handle. The kernel CSRF check never runs under `vite dev`, so this won't show up before a deployed build.
- [ ] If you run **`createFederatedAuthHandle`** (SSO consumer): the kernel CSRF gate stays **on** — the `trustedOrigins: ['*']` resolution above is off-limits there (no `validateCsrf` backstop behind the federated handle) unless you gate cookie-authenticated mutations yourself via the exported `validateCsrf` in your own hook (see [Federated Identity](#federated-identity-sso)).
- [ ] If you use **SvelteKit Remote Functions** (`kit.experimental.remoteFunctions`): confirmed each remote function checks `event.locals.user` (and per-user ownership) itself — the handle default-denies unauthenticated remote requests, but per-function checks are defense-in-depth. Only set `allowUnauthenticatedRemote: true` for deliberately public remote functions (see [Known Limitations](#known-limitations--security-gaps)).

**Your own tests:**

- [ ] E2E passkey flow against a real authenticator (registration + authentication) — the shipped tests cover the session core flow, the WebAuthn crypto at the parser level, and the auth-ceremony plumbing at the handler level: the challenge is bound to an opaque per-ceremony handle (HttpOnly cookie between `authentication-options` and `authentication-verify`), enabling both **discoverable/usernameless** _and_ email-first login. An end-to-end signature check against real hardware remains on the consumer side. **Your own client:** the cookie from the `authentication-options` response must be sent along with the `authentication-verify` request — `fetch`/`csrfFetch` do that same-origin automatically; the shipped `LoginPage` is already correct.

## Consumer Migration

Lifting an existing SvelteKit app onto `@urbicon-ui/auth` roughly follows the staged setup progression from [README → Getting Started](../README.md#getting-started) (Quickstart → Production → Advanced). The detailed migration order and app-specific steps (e.g. schema diffs, role mapping, replacing existing stores) belong in the respective consumer repo — not in this package.
