# @urbicon-ui/auth

Zero-dependency authentication, user management, and notification system for SvelteKit. Part of the Urbicon UI monorepo.

## Architecture

```
@urbicon-ui/auth
├── Server (import from '@urbicon-ui/auth/server')
│   ├── Core: JWT (HMAC-SHA256), PBKDF2 password hashing, CSRF, rate-limiting, security headers
│   ├── Handlers: login, logout, register, forgot-password, reset-password, verify-email, me
│   ├── Handle-Hook: createAuthHandle() — session hydration, route guard, CSRF, headers
│   ├── Passkeys: WebAuthn registration + authentication (CBOR, ECDSA P-256, RSA verification)
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
| JWT sessions     | HMAC-SHA256, timing-safe comparison                      | —                       |
| Web Push         | ECDH + HKDF + AES-128-GCM                                | RFC 8291, 8292, 8188    |
| Passkeys         | CBOR decoder, ECDSA/RSA verification                     | WebAuthn Level 2, FIDO2 |
| Token hashing    | SHA-256                                                  | —                       |
| bcrypt migration | Dual-verify (detects `$2b$` prefix, re-hashes to PBKDF2) | —                       |

## Package Exports

| Export                                         | Condition           | Content                                                     |
| ---------------------------------------------- | ------------------- | ----------------------------------------------------------- |
| `@urbicon-ui/auth`                             | Client + types      | Stores, components, types                                   |
| `@urbicon-ui/auth/server`                      | Server only         | Handlers, auth core, adapters                               |
| `@urbicon-ui/auth/server/adapters/prisma`      | Server only         | Prisma adapter factory (`createPrismaRepos`)                |
| `@urbicon-ui/auth/server/adapters/in-memory`   | Server only         | In-memory adapter (`createInMemoryRepos`) — dev/test        |
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
  in markup (review R19).
- **`unstyled`** — strips *every* default class, including inner wrappers and list-item
  internals; structural state that only styling used to carry is exposed as data
  attributes instead (`data-met` on RegisterPage requirement rows, `data-unread` on
  NotificationCenter items). Functionality never disappears with the flag.
- **`slotClasses`** — per-slot class overrides (e.g. `root`, `card`, `form`, `field`)
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
consumers building their own UI. Since review R18 they ride the same
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

## Consumer Integration — staged setup

The full copy-paste walkthrough lives in [packages/auth/README.md →
Getting Started](../packages/auth/README.md#getting-started), structured as three
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
The login rate-limit default is injected whenever you don't explicitly opt out with
`rateLimit: null` — even if you configure only _other_ endpoints (e.g. `rateLimit: {
register }` still leaves login protected). The lockout default applies only when you
configured neither `rateLimit` nor `lockout`; opt out of either with `null`.
The wiring is four files: deps → `hooks.server.ts` (`createAuthHandle`) → one
`+server.ts` per handler (`createLoginHandler`, …) → a `<LoginPage>` route.

### Stage 2 — Production

Swap in `createPrismaRepos` + a real transport (`createLettermintTransport`) and turn on
the additive hardening layers: `csrf.doubleSubmit`, `refreshToken` rotation (+ a `refresh`
route stub via `createRefreshHandler`), per-handler `rateLimit`, `lockout`, and HTTPS
(which auto-enables HSTS). `appUrl` must be the real public origin — outbound email links
are built from it, never from `request.url` (the Host header is attacker-controlled). Work
through the **[Production-Readiness Checklist](#production-readiness-checklist)** before going
live.

### Stage 3 — Advanced

- **Custom persistence adapter** — see the [Adapter Authoring Guide](#adapter-authoring-guide); validate it against the exported conformance suite.
- **Post-login deep links** — the route guard preserves the originally requested path: an unauthenticated GET navigation redirects to `${loginPage}?redirectTo=<path+query>` (non-GET requests redirect without the param — a POST target must not be re-issued as a GET). The param is attacker-writable like any query string, so consume it **only** through the exported `sanitizeRedirect` (root and server export), which admits internal absolute paths and falls back on everything else (absolute/protocol-relative URLs, `/\` variants): `onSuccess={() => goto(sanitizeRedirect(page.url.searchParams.get('redirectTo'), '/dashboard'))}`.
- **JWT key rotation** — `jwt.keyId` + `jwt.previousSecrets` roll the signing secret without invalidating live sessions.
- **Passkeys (WebAuthn)** — mount the `createPasskeyHandlers(deps, webauthn)` route group (the four ceremony groups plus `list`/`item` for `<PasskeyManager>`'s list + remove; requires `deps.repos.passkey`, throws at wiring time without it) with a `webauthn: WebAuthnConfig` (persistent `challengeStore` at >1 instance; `requireUserVerification: true` to enforce UV) and add `<PasskeyManager>` + `<LoginPage mode="both">`.
- **Notifications & Web Push** — register domain events server-side, listen with `<NotificationListener>` + `<NotificationCenter>` client-side. **`notification.url` is untrusted at navigation time** — validate/allow-list it before `goto()`. The list/mark-read/read-all/delete routes that `createNotificationStore` calls are served by `createNotificationsHandlers(service)` — mount its `list`/`read`/`readAll`/`item` groups under the store's `apiPath` (default `/api/notifications`); every method derives `userId` from `locals.user` and goes through the ownership-scoped service methods (IDOR-safe by construction). **Endpoint takeover is key-gated**: `pushSubscription.create` upserts by endpoint, and reassigning the row to a *different* account requires the submitted keys to match the stored ones (compared constant-time on the decoded bytes) — the legitimate user-switch-in-the-same-browser case re-sends the browser's existing subscription (same endpoint *and* keys), while merely knowing the endpoint URL (say, from a log) is refused with `409` and no write (`'rejected'` outcome; all four outcomes — created/updated/reassigned/rejected — are conformance-tested). Endpoint URLs are still worth keeping out of logs (they are the push target), but takeover no longer rides on them alone. `recipients: 'online'` is presence-based, not account-based — it reaches the users with an open SSE stream in this process at send time, and nobody else (renamed from the misleading `'all'`; `send()` throws a migration error on the old value). The registry rejects duplicate keys and the legacy `'all'` value at registration time — note for dev-HMR setups: if you cache the registry on `globalThis` to survive hot reloads, module-scope `register()` calls re-run against the surviving instance and throw; cache the registrations together with the registry (or guard with `registry.get(key)`). A type declared with `recipients: 'admins'` requires a `resolveAdminRecipients` resolver on `createNotificationService` (e.g. `() => repo.findAdminUserIds()`) — the package has no role model of its own, so without it `send()` **throws** rather than silently delivering admin alerts to nobody. Push delivery failures are swallowed so one bad subscription can't break a send; pass `onPushResult` to observe them, and subscriptions the push service reports as gone (410/404) are pruned automatically. The preference/push-subscription endpoints are rate-limited per user by default (30/min PUT resp. 10/min POST+DELETE; `rateLimit: null` opts out), `createPreferencesHandler` requires the registry and rejects unregistered `typeKey`s (bounding per-user preference rows to the registered types), and stored subscriptions are capped per user (`maxSubscriptionsPerUser`, default 10, `409` beyond — re-subscribes of a known endpoint always pass).
- **Invitations (admin)** — `createInvitationHandlers(deps, { authorize, roles })` is the server half of `<InvitationManager>`: mount `POST` + `GET` on `/api/invitations` and `DELETE` on `/api/invitations/[id]`. `authorize` is **required and fail-closed** (no open default) — registration's account-enumeration defense holds only while invitations stay admin-minted, so any authenticated user must not be able to mint one. `roles` allow-lists the assignable roles, so a crafted request can't escalate past what the UI offers. When the client sets `sendEmail`, the handler sends an invite linking to `${appUrl}/auth/register` — best-effort: a mail failure still returns `201` with `emailSent: false` (logged), since the invitation row is the durable effect. Override the mail via `inviteEmail`.
- **Pre-verified invited signups** — registration is hard invitation-gated, so the invite (delivered to that exact address; the link-click proves receipt) already proves mailbox ownership. Pass `createRegisterHandler(deps, { autoVerifyInvited: true })` to create the account with `emailVerified: true` and skip the verification token **and** the verification mail entirely. Without it, the user — who is auto-logged-in on register — receives a "verify your email" mail *after* already being signed in, and `emailVerified` never flips. Defaults to `false` (backwards-compatible: token + mail issued as before, for consumers that genuinely gate on `emailVerified`). The flag is an option on the register handler's **second argument**, not something threaded through `createAuthHandle` — that hook only resolves the session and guards routes; every handler is mounted with its own `+server.ts`. Email *change* still verifies the new address independently (`createVerifyEmailChangeHandler`); there is no prior proof of ownership for it, so it is unaffected.
- **Session enrichment** — attach app-specific data (tenant/household id, plan, entitlements) to `locals.user` via `config.hooks.transformUser(user, event)`. It runs in the handle hook on every authenticated request with the sanitized `AuthUser` (never the password hash) and the request event; its return value becomes `locals.user` (type it through your `App.Locals`). `AuthUser` is intentionally fixed and the loaded row carries no custom columns, so load extras here keyed by `user.id` rather than adding a second `handle` that re-resolves the session. A throw fails the request, and whatever you return lands on `locals.user` — keep secrets out of it if `locals.user` is serialized to the client.
- **Account management (self-service)** — let a signed-in user manage their own account. Five server handlers (`createChangePasswordHandler`, `createChangeEmailHandler`, `createVerifyEmailChangeHandler`, `createUpdateProfileHandler`, `createDeleteAccountHandler`) plus the `<AccountSettings>` component (mount the first four under `/api/auth/account/*`; the verify-email-change route sits behind the link mailed to the new address). Invariants: every mutation except profile is **re-auth gated** (`verifyCurrentPassword`); `change-password` bumps `tokenVersion` + revokes all refresh families, then re-establishes the _current_ device (others log out — a voluntary change isn't a compromise, so the initiating device stays in, unlike `reset-password` which signs out everywhere); `change-email` verifies the **new** address (notice to the old one) and is account-enumeration safe (token+mail decoupled, always `success: true`, collision = no-op); `delete-account` is a hard delete (GDPR erasure) that fires `hooks.onAccountDeleted` with the sanitized user **before** the row is removed (a throw aborts), with the Prisma adapter dropping sent invitations in the same `$transaction`. Config: `rateLimit.{changePassword,changeEmail,deleteAccount}`, hooks `onEmailChangeRequested` / `onEmailChangeFailed` / `onEmailChanged` / `onAccountDeleted` (`onEmailChangeFailed` surfaces the decoupled token/mail failure, like `onPasswordResetFailed`).
- **Active-session listing** — let a user see and revoke their sessions. **Requires `config.refreshToken` rotation** — a "session" is a refresh-token family, so without rotation there is nothing server-side to list (the endpoint returns `available: false`). One route group — `createSessionsHandlers(deps)` with `list` (GET), `revoke` (POST) and `revokeOthers` (POST) — plus the `<SessionManager>` component. Each session row carries the user-agent (the component parses it to "Browser · OS" with a zero-dep heuristic) and a `createdAt`-based "last active"; the IP is listed only when the consumer opts in via `config.sessions.storeIp` (GDPR, default off). Revokes are **ownership-scoped** — `revokeFamilyForUser` returns 404 for a family that isn't the caller's, so a guessed family id can't sign out another user (IDOR). The session of the current request is flagged `current` (resolved from the request's refresh cookie). Login/register/passkey-verify tag their sessions with the device metadata via `resolveSessionMeta`, carried across rotation.
- **Two-factor authentication (TOTP)** — an opt-in authenticator-app second factor on top of the password. Set `config.twoFactor` (`encryptionKey` **required** — high-entropy, stable; it encrypts the secret at rest, and rotating it forces re-enrolment) and provide `repos.backupCode` (both shipped adapters include it). One route group — `createTwoFactorHandlers(deps)`: `setup`/`enable`/`disable` (authenticated, mount under `/api/auth/account/2fa/*`) plus `verify` (the **public** second login step, mount under `/api/auth/2fa/verify`); the `login` handler gates automatically on `user.totpEnabled`. UI: `<TwoFactorManager>` for enrol/disable + the two-step `<LoginPage>`. Invariants: the secret is **AES-256-GCM-encrypted at rest** and only ever returned (plaintext Base32 + otpauth URI) by `setup`; the login gate keys on `totpEnabled` **alone** so a missing `config.twoFactor` can never become a bypass (fail-closed) — it issues a signed, short-lived pending-2FA token (cookie `urbicon_2fa`, `__Host-`-prefixed when `cookieSecure`) instead of a session, leaving no session/refresh cookie and deferring `onLoginSuccess` to verify; verify accepts a TOTP **or** a single-use SHA-256 backup code, is **strictly rate-limited** (`createAuthDeps` injects a default), and consumes the pending cookie only on success (a wrong code keeps it for retry within the TTL); `disable` is **password re-auth gated** and clears the secret + every backup code; backup codes are cleared before re-issue at enable so a re-enrol leaves none doubly-redeemable. Passkey logins are **not** gated (a passkey is already a strong factor). The TOTP core (`server/totp.ts`, RFC 6238/4226/4648) and the pending-token/cookie/backup-code plumbing (`server/two-factor.ts`) are exported for custom flows. Config knobs: `twoFactor.{issuer,algorithm,digits,period,window,pendingTokenTtl,backupCodeCount}`, `rateLimit.twoFactor`. `algorithm` defaults to **SHA-1** — the only one Google/Microsoft Authenticator reliably support; the secret's high entropy carries the security, not the hash, so SHA-256 stays opt-in. **Note:** the verify rate-limit is per-IP (like login) and TOTP codes are replayable within their window in v1 — both deliberate trade-offs (see [Known Limitations](#known-limitations--security-gaps) / the roadmap's open questions).
- **Federated identity / SSO** — roadmap (`createFederatedAuthHandle()`).

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

## Prisma Schema

See `packages/auth/prisma/auth-schema.prisma` for the reference schema. Models: User, Invitation, PushSubscription, Notification, NotificationType, NotificationPreference, Passkey, TwoFactorBackupCode. The User model carries the 2FA columns `totpSecret` (AES-256-GCM-encrypted), `totpEnabled`, `totpConfirmedAt`. **Recommended:** add `onDelete: Cascade` to the `invitationsSent` relation — DB cascade already covers passkeys/tokens/notifications/push/prefs on user delete; only sent `Invitation` rows lack it (the delete-account handler otherwise removes them by hand in its `$transaction`).

## Adapter Authoring Guide

Persistence is behind a repository interface (`Repositories` in `packages/auth/src/lib/server/adapters/types.ts`). The auth core never talks to a database directly — it talks to `repos.user`, `repos.refreshToken`, etc. This section is the contract for writing your own adapter.

### What we ship, and the strategy

| Adapter               | Import                                                                           | Use                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Prisma**            | `@urbicon-ui/auth/server/adapters/prisma` (`createPrismaRepos`)                  | Production reference. Copy the models from `prisma/auth-schema.prisma`.                                       |
| **In-memory**         | `@urbicon-ui/auth/server/adapters/in-memory` (`createInMemoryRepos`)             | Dev/test only — heap Maps, single-process, wiped on restart. The five-minute quickstart and the test fixture. |
| **Conformance suite** | `@urbicon-ui/auth/server/adapters/conformance` (`describeRepositoryConformance`) | Not an adapter — the executable contract every adapter validates itself against.                              |

We deliberately **do not** ship one official adapter per ORM (Drizzle, Kysely, …). Each interface change would then have to be maintained × N adapters. Instead the interface **is** the contract and the conformance suite makes a third-party adapter _provably_ safe rather than hopefully-safe. A Drizzle worked example is below; ship it in your own app, validate it with the suite.

### The contract: what every adapter MUST guarantee

The interface JSDoc (`types.ts`) is authoritative; these are the invariants that are easy to get wrong. **Getting any of these wrong is a security bug**, not a style nit — a non-atomic token claim double-spends a single-use reset link; an unscoped delete lets one user silence another's security notifications.

| Operation                                                                                | Guarantee                                                                                                                                                                                                                                                                                                                           | Why                                                                                          |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `refreshToken.revoke(id)`                                                                | Compare-and-set: flip `revokedAt` null→now **only if still live**; return `true` iff this call won (`count === 1`).                                                                                                                                                                                                                 | Rotation race-safety — two concurrent rotations must yield exactly one live successor.       |
| `refreshToken.revokeFamilyForUser(userId, family)`                                       | Revoke the family in one write **scoped to `userId`** (`UPDATE … WHERE family = ? AND userId = ?`); return `true` iff a row the caller owns was revoked, else `false` (→ 404/no-op). Never revoke by `family` alone.                                                                                                                | IDOR — a guessed family id must not let one user sign another user out of their session.     |
| `user.consumeResetToken` / `consumeVerificationToken`                                    | Single conditional write that clears the token; return the user only on the winning claim, else `null`. Purge an expired token's hash.                                                                                                                                                                                              | One reset/verify link → one use; no double-spend under concurrency.                          |
| `user.consumeEmailChangeToken`                                                           | Single conditional write that swaps `email`←`pendingEmail` and sets `emailVerified`, clearing the pending fields — only if the token matches, is unexpired, **and** the target address is still free. A collision with another account is a **failed claim** (`null`), never a duplicate email. Purge an expired token's artifacts. | One email-change link → one use; respects `email` uniqueness under concurrency.              |
| `invitation.markUsedIfUnused(id)`                                                        | CAS: flip `usedAt` null→now; `true` iff this call won.                                                                                                                                                                                                                                                                              | One invitation → one registration.                                                           |
| `backupCode.consumeIfUnused(userId, hash)`                                               | Single conditional write scoped to `userId` that flips an unused code to used; `true` iff this call won. Never `SELECT` then `UPDATE`.                                                                                                                                                                                              | One backup code → one redemption; no cross-user redemption (IDOR).                           |
| `user.incrementTokenVersion`                                                             | Atomic `increment`, never read-modify-write.                                                                                                                                                                                                                                                                                        | Parallel "log out everywhere" must not lose an increment.                                    |
| `user.recordFailedLogin`                                                                 | Atomic `increment`; read the new count from the write. Set the lock with a write **guarded** on the DB-side count (`failedLoginAttempts >= maxAttempts`), not the value just read.                                                                                                                                                  | Lockout must not under-count under credential stuffing, nor set the lock from a stale count. |
| `passkey.updateCounter(id, n)`                                                           | CAS: bump only if stored `< n`; `false` if nothing advanced. `n === 0` → counterless, touch `lastUsedAt` only.                                                                                                                                                                                                                      | Cloned-authenticator detection.                                                              |
| `notification.markAsRead`/`delete`, `pushSubscription.delete`, `passkey.delete`/`rename` | Scope every mutation to the owner `userId`. A non-owner call must not mutate (no-op **or** throw both fine).                                                                                                                                                                                                                        | IDOR — knowing an id/endpoint must not let an attacker touch another user's row.             |
| `pushSubscription.create`                                                                | Upsert-by-`endpoint`: a row with the same endpoint is updated in place. Reassigning it to a *different* user is **key-gated**: only when the submitted keys equal the stored ones (constant-time on the decoded bytes) — otherwise return `'rejected'` without writing. Never fail on the unique endpoint.                          | Re-enabling push re-sends the browser's *existing* subscription (the duplicate POST is the normal case); key possession is what separates the legitimate user switch from an endpoint-URL takeover. |
| `user.delete`                                                                            | Hard-delete plus dependents: rely on `onDelete: Cascade` for passkeys/tokens/notifications/subscriptions/preferences, but delete the invitations the user **sent** by hand (the `invitedBy` FK has no cascade), ideally in one transaction. Conformance pins the hand-written half.                                                 | GDPR erasure must not leave orphans; the sent-invitations half is the part every adapter writes itself. |

The CAS/claim operations are why the interface returns `Promise<boolean>` (or the claimed entity) rather than `void`: the business logic in the core (`rotateRefreshToken`, the register/reset/verify handlers) reads that return value to detect a lost race. Implement each as a **single conditional statement** (`UPDATE … WHERE <still-claimable> RETURNING …`), never `SELECT` then `UPDATE` across an `await` — that gap is the race.

Three cross-cutting conventions round the contract off. **Owner-first parameters:** every owner-scoped mutation takes `(userId, id, …)` — `markAsRead(userId, id)`, `passkey.delete(userId, credentialId)`, `pushSubscription.delete(userId, endpoint)`, `backupCode.consumeIfUnused(userId, codeHash)`. With two plain strings a swapped call still compiles, so the single fixed order is what keeps a swap greppable. **Pre-normalized emails:** every email reaching a repository (lookups and create data) was already trimmed + lowercased by the package's validation — match and store verbatim, never re-normalize. **Feature tiers:** `UserRepository` is sectioned by feature (core · email verification · password reset · email change · TOTP); an adapter for an app that will never mount a feature may stub that section with throwing methods, since nothing calls a section whose feature is not wired — the shipped adapters implement everything (see the section comments in `adapters/types.ts`).

### Structural boundary — the `XLike` pattern

`createPrismaRepos<AppRole>(prisma)` accepts the consumer's generated client through a structural interface (`PrismaLike`). Every method returns `Promise<PrismaRow>` where `PrismaRow = any` — a single, intentional `eslint-disable` at the module boundary.

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

Whatever you build, prove it upholds the contract by running the shared suite from a `*.test.ts` (needs `vitest`):

```ts
import { describeRepositoryConformance } from '@urbicon-ui/auth/server/adapters/conformance';
import { createMyAdapter } from './my-adapter';

describeRepositoryConformance('my-adapter', {
  role: 'USER',
  // Declare the optional repos you implement; the rest are reported skipped.
  capabilities: {
    refreshToken: true,
    passkey: true,
    notification: true,
    pushSubscription: true,
    notificationPreference: true
  },
  // MUST hand back a fresh, isolated repo set per check (wipe schema / new tx).
  setup: () => createMyAdapter(freshTestDatabase())
});
```

The suite drives each atomic claim under `Promise.all` concurrency, asserts exactly one winner, and checks every ownership scope. It is exactly what the shipped Prisma and in-memory adapters run against in CI — including a negative control proving a non-atomic adapter is _rejected_, so the checks have teeth.

### Worked example — a Drizzle adapter

The same `XLike` + `mapX` + single-statement-CAS pattern in Drizzle. The trick on every claim is `UPDATE … WHERE <still-claimable> RETURNING …` and treating "0 rows returned" as "lost the race" — Drizzle's `.returning()` gives the row count for free.

```ts
import { and, eq, gt, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { RefreshTokenRepository, UserRepository /* … */ } from '@urbicon-ui/auth/server';

// `DrizzleLike` is the structural boundary — pass any drizzle db + your tables.
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
  } as UserRepository;
}

// invitation.markUsedIfUnused and passkey.updateCounter follow the identical
// "UPDATE … WHERE <claimable> RETURNING {id}; return rows.length === 1" shape.
```

Wire the per-repo factories into one `Repositories` object (mirroring `createPrismaRepos`), point `describeRepositoryConformance` at it, and you have a _proven_ adapter. `drizzle-orm` stays a `peerDependency`/optional in your app — never a runtime dependency of this package.

## Tests

630+ unit tests (48 files) + 5 E2E tests (`e2e/auth.spec.ts`). Run with:

```bash
cd packages/auth && bunx --bun vitest run   # unit
bun run test:e2e                            # Playwright (from the repo root)
```

**Covered:** crypto primitives (JWT, HMAC, PBKDF2, CBOR, WebAuthn parsing, TOTP/HOTP against RFC 6238/4226 vectors, AES-256-GCM secret encrypt/decrypt), CSRF, rate-limiter, session cookies, validation, notification registry/SSE/push, login handler (incl. 2FA gate), account-management and session-listing handlers, 2FA flow (setup/enable/disable/verify, backup-code single-use, pending-2FA token), E2E core flow (register → protected → logout → refresh rotation → reuse detection). **Adapter conformance** (`adapters/conformance.ts`): the atomic claim/scope guarantees run against the in-memory adapter **and** the Prisma adapter (via a faithful in-memory `PrismaLike` fake) — this is the first real test coverage for `adapters/prisma.ts` — plus a negative control that demonstrably fails a non-atomic adapter. The release history (v0.8.1 – v0.11.0) covers every hardening-1.0 milestone — details in the changelog.

**Still open (P2/P3):** end-to-end attestation/assertion with a real authenticator; conformance against a _real_ database engine (the Prisma path is currently covered via the `PrismaLike` fake, not against a running Postgres).

## Error Contract

Every handler (and the `createAuthHandle` gates) answers errors with one JSON shape: `{ error: string, code: AuthErrorCode, … }` — `error` is human-readable English prose, `code` the stable machine value from the append-only `AUTH_ERROR_CODES` set (never repurposed, only extended; the same code can appear under different HTTP statuses when the context differs, e.g. `invalid_code` is 400 on 2FA-enable and 401 on 2FA-verify). Validation failures additionally carry the full field list as `errors`, and the first field message replaces the generic prose. Rate limits answer `429 rate_limited` with a `Retry-After` header; the CSRF gate `403 csrf_failed`; the previously-plaintext SSE-stream refusals are JSON as of v6.17.0 (native `EventSource` clients never see bodies, so that change is inert there). The push-subscription writes distinguish `push_endpoint_conflict` (endpoint owned by another account — permanent) from `push_subscription_limit` (per-user device cap). The one deliberate exception: `createMeHandler` answers `401 { user: null }` — that is the session-status contract of the client store, not an error report.

Localized clients map `code` via `errorMessageFromCode(code, t, error)` (exported from the package root): known code → locale bundle, unknown code or missing translation → the server prose, neither → `undefined` for the caller's own fallback. `validation_error` deliberately prefers the field-level server prose. The pre-built components do this everywhere via their shared `errorTextFromBody` helper. One code is client-synthesized rather than served: `network_error` (the request never reached the server — offline, DNS, CORS), produced by the stores and mapped to `auth.errors.networkError` like any other code.

## Known Limitations & Security Gaps

As of: 2026-06-15. The auth core is **stable** — all hardening-1.0 items are closed; the self-service surfaces added in v5.x (account management, session listing, TOTP 2FA) are initially marked **`beta`**. The complete fix history lives in the [CHANGELOG](../CHANGELOG.md); relevant versions per area are referenced in the feature-matrix tables of [packages/auth/README.md](../packages/auth/README.md).

### 🛡️ Defense-in-Depth (P2, after v1.0)

- **Monitoring recommendations** — for production deployments, track latency/error rate on the auth handlers; no package code needed, only a doc reference in the consumer app.

### Account Enumeration & Timing (Cluster G)

The package deliberately avoids revealing whether an account exists, via either response content **or** timing:

- **Login** — an unknown email goes through the same PBKDF2 verify as a wrong password (against a discarded dummy hash with the configured work factor) before returning `401`. There is no measurable "user does not exist" shortcut.
- **Forgot password** — always responds with `{ success: true }`; the token write + email send run decoupled from the response (fire-and-forget), so the response time doesn't reveal whether the account exists. Since a failure then no longer surfaces as an HTTP status, it is reported via `config.hooks.onPasswordResetFailed` (+ `console.error`) — hook it into your own error tracker so a broken mail transport doesn't silently lock users out of recovery. **Serverless/edge note:** runtimes that freeze the worker after the response is sent can cut off the downstream work (and its logging/the hook) — use a queue-backed email transport there so delivery stays reliable.
- **Register** — deliberately invitation-gated: without an (admin-created) invitation, every email returns the same `403 "invitation required"`, regardless of whether it is already registered. The more precise `403`/`409` messages are visible only to someone who already holds a valid invitation for exactly that address — that is not a usable enumeration vector, and the clear messages help the legitimately invited person.
- **WebAuthn auth options** — an unknown email returns the same `200` options response (empty `allowCredentials`) as a known one; discoverable/usernameless login works without any email at all (Cluster G.1).

### Rate-Limiting, Lockout & Route Scope (deliberate trade-offs)

- **Lockout DoS** — the login rate-limit is **per-IP**, the lockout is **account-based**. An attacker with many IPs (IPv6 rotation, proxy pool) can thereby deliberately lock out someone else's account without tripping their own IP rate-limit. This is the classic lockout trade-off (brute-force protection vs. DoS). If you don't want that, set `lockout: null` (then the per-IP rate-limit alone protects) — but the default deliberately leaves the lockout on, because brute-force protection is the more important risk for most apps. For visibility, consider adding your own monitoring on `lockedUntil` writes.
- **2FA verify rate-limit is per-IP, not per-account** — the public `/2fa/verify` endpoint is limited per-IP like login (`rateLimit.twoFactor`, strict default), not per-account — consistent with the package philosophy (account-level limits are themselves DoS-prone and opt-in). A distributed-IP attack would additionally need the victim's password (to set the pending-2FA cookie); with a ±1 window (10⁶ codes) + ~5-min TTL this remains practically hopeless. A per-account limiter is a deliberate later option.
- **TOTP replay within the same time window** — v1 relies solely on the strict verify rate-limit. A stored `lastUsedStep` that prevents re-redeeming the same code within its validity (±1 period) is noted as a later hardening (see roadmap, open questions).
- **`publicRoutes` are prefixes** — `createAuthHandle` matches public routes via `startsWith`. The default `'/api/auth/'` thereby makes **all** subroutes below it public (no auth guard). Don't place protectable app routes below it, or keep the list narrow when you add your own `/api/auth/*` endpoints.
- **Remote functions are guarded by `event.isRemoteRequest` (+ a `/remote` POST check), not `publicRoutes`.** For SvelteKit Remote Functions (`kit.experimental.remoteFunctions`) the pathname the guard sees is **client-controlled**, via either of two transports: **(1)** the `/_app/remote/…` calls (`query` / `command` / JS-enhanced `form`) — SvelteKit overwrites `event.url.pathname` from the `x-sveltekit-pathname` header *before* the `handle` hook runs; a plain `query` is even a **GET** (payload in `?payload=`), so the kernel's non-`GET` cross-site block doesn't catch it either; and **(2)** the no-JS `<form action="?/remote=…">` fallback — dispatched through the page pipeline from the `/remote` search param, decoupled from the pathname, with `event.isRemoteRequest` left **`false`**. Either way a spoofed (or genuinely) public route such as `/auth/login` would let an unauthenticated remote call run without a session and leak every reachable row. `createAuthHandle` **default-denies** (`401`) both: keyed on the unspoofable `event.isRemoteRequest`, and — for the fallback — a `POST` carrying a truthy `/remote` action param (mirroring SvelteKit's own dispatch gate; a normal action named `remote` serializes to an empty `?/remote` and is correctly left to the path guard). Set `allowUnauthenticatedRemote: true` **only** if you deliberately expose public remote functions — you then own their authorization (check `event.locals.user` inside each). **Defense-in-depth:** even with the guard active, prefer an explicit `event.locals.user` (+ per-user ownership) check inside each remote function rather than relying on the handle alone — the guard is a backstop, not a substitute for per-function authorization.
- **SvelteKit's built-in `csrf.checkOrigin` is a separate gate that runs _before_ this package's check.** SvelteKit's request kernel performs its own Origin-CSRF check *before* the `handle` hook runs (`@sveltejs/kit` → `src/runtime/server/respond.js`). If you route a cross-origin, form-encoded `POST` *around* `createAuthHandle` — an OAuth 2.1 token endpoint, a third-party webhook — that kernel gate rejects it with `403 "Cross-site POST form submissions are forbidden"` before your hook (and therefore this package's `validateCsrf`) ever runs. Three properties make this bite: it **can't be disabled per-route from a hook** (by the time `handle` runs the 403 is already returned — the only levers are the global `kit.csrf.*` config); it fires on **form content types only** (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`), so a JSON endpoint (MCP JSON-RPC, dynamic client registration) passes through but the OAuth **token** endpoint can't — RFC 6749 §4.1.3 mandates `application/x-www-form-urlencoded` and real callers (Claude, etc.) send **no `Origin` header**, which keeps the gate shut (a *missing* Origin can't be allow-listed via `trustedOrigins`); and it is **active in production builds only, not under `vite dev`**, so the 403 typically first surfaces *after deploy*, never in local development. **Resolution:** set `kit.csrf: { trustedOrigins: ['*'] }` in `svelte.config.js` (SvelteKit resolves `['*']` to a hard off-switch at build time; the deprecated equivalent is `kit.csrf.checkOrigin: false`) and let this package's `validateCsrf` be the single Origin gate — it is *stricter* than the kernel check (every mutating method, **all** content types incl. JSON, no allow-list, as step 1 of `createAuthHandle`), so for any request that flows through the handle the kernel check was redundant anyway. **Safe only when:** (1) every cookie-authenticated mutating route flows through `createAuthHandle` — including SvelteKit form actions such as an OAuth consent `?/approve`, and "cookie-authenticated" means *any* ambient-session-cookie route, not just this package's; and (2) the handle-bypassed routes are cookieless (bearer / PKCE / API-key) — they carry no ambient credential the browser auto-sends, so they're structurally not CSRF-able and the Origin gate protected nothing there. Edge case to flag rather than assume: if you depend on SvelteKit's `trustedOrigins` allow-list for legitimate cross-origin *browser* form posts, note `validateCsrf` is strict-same-origin with no allow-list equivalent.
- **SSE presence is process-local** — `createSSEManager` registers connections in this process only; there is no cross-instance seam. On multi-instance/serverless deployments, `isOnline` false-negatives make `send()` skip the live SSE event for users connected to another instance and fall back to push (delivery still happens, via the heavier channel, provided a push subscription exists), and `recipients: 'online'` broadcasts only reach the users connected to the instance running `send()`. Treat the notification system as single-instance until a shared presence backend exists — the same class of assumption as the in-memory rate-limit store.
- **In-memory adapter grows unbounded** — `createInMemoryRepos` doesn't clean up notifications/push subscriptions and doesn't call `deleteExpired` for refresh tokens automatically. Likewise `user.delete` there models no cross-repo cascade: only the user row is removed (orphaned refresh tokens/passkeys of a deleted user are harmless — rotation and the handle hook reject a token without an existing user). The real cascade is a DB guarantee of the Prisma adapter. This is fine for the declared dev/test scope; for long-lived processes use a persistent adapter.

### Production-Readiness Checklist

Before production use outside of controlled environments:

**Package setup (one-time):**

- [ ] Persistent-storage adapter for challenges, refresh tokens, and rate-limits configured (at >1 instance). Interfaces/adapters since v0.8.5 – v0.11.0.
- [ ] CSRF double-submit enabled (`config.csrf = { doubleSubmit: true }`, since v0.8.4). Optionally also `useHostPrefix: true` (HTTPS-only) against subdomain cookie injection — then also set `useHostPrefix: true` in the `csrf` config of the client stores/components.
- [ ] Refresh-token rotation enabled (`config.refreshToken = { … }`, since v0.11.0) — non-breaking, recommended in production.

**Deployment:**

- [ ] HTTPS enforced (cookies are already `secure: true`; HSTS is then set automatically by `createAuthHandle`).
- [ ] CSP adapted to the app (`config.securityHeaders.csp`) — the default `frame-ancestors 'none'` blocks only framing; a complete policy is app-specific.
- [ ] Monitoring for auth-handler latency and error rate active.
- [ ] Incident runbook for a compromised JWT secret prepared (`keyId` + `previousSecrets` allows uninterrupted rotation).
- [ ] If you expose a cross-origin form-encoded endpoint *outside* `createAuthHandle` (OAuth 2.1 token endpoint, webhook): `kit.csrf: { trustedOrigins: ['*'] }` set in `svelte.config.js`, and confirmed every cookie-authenticated mutating route still flows through the auth handle (see [Known Limitations](#known-limitations--security-gaps)). The kernel CSRF check is production-only, so this won't show up under `vite dev`.
- [ ] If you use **SvelteKit Remote Functions** (`kit.experimental.remoteFunctions`): confirmed each remote function checks `event.locals.user` (and per-user ownership) itself — the handle default-denies unauthenticated remote requests, but per-function checks are defense-in-depth. Only set `allowUnauthenticatedRemote: true` for deliberately public remote functions (see [Known Limitations](#known-limitations--security-gaps)).

**Your own tests:**

- [ ] E2E passkey flow against a real authenticator (registration + authentication) — the shipped tests cover the session core flow, the WebAuthn crypto at the parser level, and (since Cluster G.1) the auth-ceremony plumbing at the handler level: the challenge is bound to an opaque per-ceremony handle (HttpOnly cookie between `authentication-options` and `authentication-verify`), enabling both **discoverable/usernameless** _and_ email-first login. An end-to-end signature check against real hardware remains on the consumer side. **Your own client:** the cookie from the `authentication-options` response must be sent along with the `authentication-verify` request — `fetch`/`csrfFetch` do that same-origin automatically; the shipped `LoginPage` is already correct.

## Consumer Migration

Lifting an existing SvelteKit app onto `@urbicon-ui/auth` roughly follows the staged setup progression from [packages/auth/README.md → Getting Started](../packages/auth/README.md#getting-started) (Quickstart → Production → Advanced). The detailed migration order and app-specific steps (e.g. schema diffs, role mapping, replacing existing stores) belong in the respective consumer repo — not in this package.
