<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { DocsLayout as DocsPageLayout, Section, InfoCard, CodeExample } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';

  const navigation = [
    { id: 'overview', title: 'Overview' },
    { id: 'architecture', title: 'Architecture' },
    { id: 'pages', title: 'Auth Pages' },
    { id: 'management', title: 'Management' },
    { id: 'notifications', title: 'Notifications' },
    { id: 'setup', title: 'Setup Guide' }
  ];

  const depsCode = `// src/lib/server/auth.ts
import { createAuthDeps } from '@urbicon-ui/auth/server';
import { createPrismaRepos } from '@urbicon-ui/auth/server/adapters/prisma';
import { createLettermintTransport } from '@urbicon-ui/auth/server/email/lettermint';
import { prisma } from '$lib/server/db';
import { appLogger } from '$lib/server/logging';
import { APP_URL, JWT_SECRET, LETTERMINT_TOKEN } from '$env/static/private';

export const authDeps = createAuthDeps({
  config: {
    // Required, and never derived from request.url — the Host header is
    // attacker-controlled and would point reset links at their domain.
    appUrl: APP_URL,
    jwt: { secret: JWT_SECRET },
    password: { minLength: 8 },
    lockout: { maxAttempts: 5, durationMinutes: 15 },
    routes: { loginPage: '/auth/login' },
    logger: appLogger
  },
  // Same sink: a missing Prisma model drops its feature, reported here.
  repos: createPrismaRepos(prisma, { logger: appLogger }),
  email: createLettermintTransport({ token: LETTERMINT_TOKEN, from: 'noreply@example.com' })
});`;

  const hookCode = `// src/hooks.server.ts
import { createAuthHandle, DEFAULT_PUBLIC_ROUTES } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth';

export const handle = createAuthHandle({
  config: authDeps.config,
  repos: authDeps.repos,
  // publicRoutes REPLACES the defaults, so spread them in — without that the
  // /api/auth/* endpoints below lose their exemption and login answers 401.
  // Entries are startsWith prefixes: '/' here would exempt the whole app.
  publicRoutes: [...DEFAULT_PUBLIC_ROUTES, '/pricing']
});`;

  const handlersCode = `// Each auth flow needs a SvelteKit API route:
// src/routes/api/auth/login/+server.ts
import { createLoginHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth';
export const POST = createLoginHandler(authDeps);

// src/routes/api/auth/register/+server.ts
import { createRegisterHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth';
export const POST = createRegisterHandler(authDeps);

// src/routes/api/auth/forgot-password/+server.ts
import { createForgotPasswordHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth';
export const POST = createForgotPasswordHandler(authDeps);

// Same pattern for: reset-password, verify-email, logout, me`;

  const uiCode =
    '<!-- src/routes/auth/login/+page.svelte -->\n<' +
    "script>\n  import { LoginPage } from '@urbicon-ui/auth';\n  import { goto } from '$app/navigation';\n</" +
    'script>\n\n<!-- Locale auto-detected from i18n context -->\n<LoginPage\n  onSuccess={() => goto(\'/\')}\n  passkeyApiPath="/api/auth/passkey"\n  rememberMe\n/>';

  const cssCode = `/* app.css */
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css'; /* tokens + the blocks @source */
@import '@urbicon-ui/auth/style/index.css'; /* the auth @source */`;

  const handlerTable = [
    ['LoginPage', 'createLoginHandler', '/api/auth/login', 'PBKDF2 verify, lockout, JWT session'],
    [
      'RegisterPage',
      'createRegisterHandler',
      '/api/auth/register',
      'Invitation check, hash, verify email'
    ],
    [
      'ForgotPasswordPage',
      'createForgotPasswordHandler',
      '/api/auth/forgot-password',
      'Token email, timing-safe'
    ],
    [
      'ResetPasswordPage',
      'createResetPasswordHandler',
      '/api/auth/reset-password',
      'Token verify, re-hash'
    ],
    [
      'VerifyEmailPage',
      'createVerifyEmailHandler',
      '/api/auth/verify-email',
      'SHA-256 token check'
    ],
    ['PasskeyManager', 'createPasskey*Handler', '/api/auth/passkey/*', 'WebAuthn CBOR/COSE verify'],
    ['InvitationManager', 'createInvitationHandlers', '/api/invitations', 'authorize-gated CRUD'],
    [
      'NotificationListener',
      'createStreamHandler',
      '/api/notifications/stream',
      'SSE with keep-alive'
    ]
  ];
</script>

<SeoMeta
  title="Auth"
  description="Zero-dependency authentication, user management, and notification system for SvelteKit."
/>

<DocsPageLayout
  title="Auth"
  description="Authentication, user management, and notifications for a SvelteKit app: password and passkey login, sessions, registration with invitation gates, password reset, two-factor, and push. No runtime dependencies; sessions, passwords, passkeys and push all run on the Web Crypto API."
  maxWidth="2xl"
  showToc={true}
  {navigation}
>
  <Section id="overview" title="Overview" titleHidden intent="primary">
    <p class="text-text-secondary mb-4">
      <code>@urbicon-ui/auth</code> covers registration, login (password or passkey), password reset,
      sessions, two-factor, and notifications, with zero runtime dependencies. Each flow has two halves:
      a server handler you mount on an API route, and a UI component that calls it.
    </p>
    <p class="text-text-secondary">
      All UI components use <code>@urbicon-ui/blocks</code> primitives, support
      <code>unstyled</code> / <code>slotClasses</code> / snippet overrides, and auto-detect locale
      from the <code>@urbicon-ui/i18n</code> context.
    </p>
    <p class="text-text-secondary mt-4">
      For the complete reference — architecture, staged setup, federation (SSO), the adapter
      contract, and the known-limitations catalog with the production checklist — see the
      <a href={resolve('/auth/guide')} class="text-primary hover:underline"
        >Auth Reference (AUTH.md)</a
      >.
    </p>
  </Section>

  <Section id="architecture" title="Architecture">
    <p class="text-text-secondary mb-4">
      Each auth flow has two sides: a <strong>UI component</strong> (client) and a
      <strong>handler factory</strong> (server). The UI component sends a <code>fetch</code> to your SvelteKit
      API route; the handler factory is the endpoint behind it. What each handler verifies, hashes, or
      rate-limits is the last column below.
    </p>

    <div class="border-border-subtle overflow-x-auto rounded-lg border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface-subtle border-border-subtle border-b">
            <th class="text-text-primary px-4 py-2 text-left font-medium">UI Component</th>
            <th class="text-text-primary px-4 py-2 text-left font-medium">Server Handler</th>
            <th class="text-text-primary hidden px-4 py-2 text-left font-medium sm:table-cell"
              >Default Endpoint</th
            >
            <th class="text-text-primary hidden px-4 py-2 text-left font-medium md:table-cell"
              >What it does</th
            >
          </tr>
        </thead>
        <tbody>
          {#each handlerTable as [component, handler, endpoint, desc] (component)}
            <tr class="border-border-subtle border-b last:border-0">
              <td class="text-text-primary px-4 py-2 font-mono text-xs">{component}</td>
              <td class="text-text-secondary px-4 py-2 font-mono text-xs">{handler}</td>
              <td class="text-text-tertiary hidden px-4 py-2 font-mono text-xs sm:table-cell"
                >{endpoint}</td
              >
              <td class="text-text-tertiary hidden px-4 py-2 text-xs md:table-cell">{desc}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <p class="text-text-tertiary mt-3 text-xs">
      All server handlers are imported from <code>@urbicon-ui/auth/server</code>. Database access
      goes through the Adapter pattern: a Prisma adapter is included, and custom adapters implement
      the repository interfaces.
    </p>
  </Section>

  <Section id="pages" title="Auth Pages">
    <div class="grid gap-4 sm:grid-cols-2">
      <InfoCard title="LoginPage" href={resolve('/auth/components/login-page')}>
        Login form with email/password, optional passkey, and remember-me.
      </InfoCard>
      <InfoCard title="RegisterPage" href={resolve('/auth/components/register-page')}>
        Invitation-gated registration with password requirements checklist.
      </InfoCard>
      <InfoCard title="ForgotPasswordPage" href={resolve('/auth/components/forgot-password-page')}>
        Password reset request; timing-safe to prevent email enumeration.
      </InfoCard>
      <InfoCard title="ResetPasswordPage" href={resolve('/auth/components/reset-password-page')}>
        Password reset with confirmation field.
      </InfoCard>
      <InfoCard title="VerifyEmailPage" href={resolve('/auth/components/verify-email-page')}>
        Auto-verifying email confirmation on mount.
      </InfoCard>
    </div>
  </Section>

  <Section id="management" title="Management">
    <div class="grid gap-4 sm:grid-cols-2">
      <InfoCard title="InvitationManager" href={resolve('/auth/components/invitation-manager')}>
        Admin panel for invitation-gated registration with email toggle.
      </InfoCard>
      <InfoCard title="PasskeyManager" href={resolve('/auth/components/passkey-manager')}>
        WebAuthn credential management: register and delete passkeys.
      </InfoCard>
      <InfoCard title="AccountSettings" href={resolve('/auth/components/account-settings')}>
        Self-service panel: change name, email and password, or delete the account.
      </InfoCard>
      <InfoCard title="SessionManager" href={resolve('/auth/components/session-manager')}>
        Active-session list with "this device" badge and per-session sign-out.
      </InfoCard>
      <InfoCard title="TwoFactorManager" href={resolve('/auth/components/two-factor-manager')}>
        TOTP two-factor enrolment, backup codes, and re-auth-gated disable.
      </InfoCard>
    </div>
  </Section>

  <Section id="notifications" title="Notifications">
    <div class="grid gap-4 sm:grid-cols-2">
      <InfoCard title="NotificationCenter" href={resolve('/auth/components/notification-center')}>
        Notification list with mark-as-read, relative timestamps, and custom items.
      </InfoCard>
      <InfoCard title="NotificationBadge" href={resolve('/auth/components/notification-badge')}>
        Unread count badge, hidden when the count is 0.
      </InfoCard>
      <InfoCard
        title="NotificationListener"
        href={resolve('/auth/components/notification-listener')}
      >
        Headless SSE listener with automatic reconnection.
      </InfoCard>
      <InfoCard
        title="PushPermissionPrompt"
        href={resolve('/auth/components/push-permission-prompt')}
      >
        Opt-in prompt for push notifications via VAPID.
      </InfoCard>
    </div>
  </Section>

  <Section id="setup" title="Setup Guide">
    <p class="text-text-secondary mb-4">
      Integration requires five steps: configure dependencies, add the hook, create API routes, add
      UI pages, and import the stylesheet.
    </p>

    <h3 class="text-text-primary mb-2 text-lg font-semibold">1. Configure auth dependencies</h3>
    <CodeExample code={depsCode} language="typescript" preview={false} />

    <h3 class="text-text-primary mt-6 mb-2 text-lg font-semibold">2. Add the SvelteKit hook</h3>
    <p class="text-text-secondary mb-2 text-sm">
      The handle hook validates the session, redirects unauthenticated requests off protected
      routes, and adds CSRF and security headers. It takes one options object; the redirect target
      is <code>config.routes.loginPage</code> from step 1, not a hook option.
    </p>
    <CodeExample code={hookCode} language="typescript" preview={false} />

    <h3 class="text-text-primary mt-6 mb-2 text-lg font-semibold">3. Create API route handlers</h3>
    <p class="text-text-secondary mb-2 text-sm">
      Each UI component expects a corresponding API endpoint. The handler factories include all
      validation, hashing, rate limiting, and security.
    </p>
    <CodeExample code={handlersCode} language="typescript" preview={false} />

    <h3 class="text-text-primary mt-6 mb-2 text-lg font-semibold">4. Add UI pages</h3>
    <p class="text-text-secondary mb-2 text-sm">
      Components auto-detect locale from <code>@urbicon-ui/i18n</code>. No <code>t</code> prop needed
      when the i18n context is set up.
    </p>
    <CodeExample code={uiCode} language="svelte" preview={false} />

    <h3 class="text-text-primary mt-6 mb-2 text-lg font-semibold">5. Import the stylesheet</h3>
    <p class="text-text-secondary mb-2 text-sm">
      A Tailwind build never scans <code>node_modules</code> on its own. The package ships a
      stylesheet whose <code>@source</code> directive points Tailwind at its components — import it
      after the blocks one, or the <code>sm:</code> layouts and the link colour of the auth pages are
      missing from the compiled CSS.
    </p>
    <CodeExample code={cssCode} language="css" preview={false} />
  </Section>
</DocsPageLayout>
