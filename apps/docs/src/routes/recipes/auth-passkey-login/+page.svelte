<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import { LoginPage } from '@urbicon-ui/auth';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const { title, description, features } = recipeMeta;

  const recipeCode =
    `// 1. src/lib/server/auth-setup.ts — auth deps + shared WebAuthn ceremony config
import { createAuthDeps, createPasskeyHandlers } from '@urbicon-ui/auth/server';
import type { WebAuthnConfig } from '@urbicon-ui/auth/server';
import { createPrismaRepos } from '@urbicon-ui/auth/server/adapters/prisma';
import { createLettermintTransport } from '@urbicon-ui/auth/server/email/lettermint';
import { env } from '$env/dynamic/private';
import { prisma } from './prisma';

export const authDeps = createAuthDeps({
  config: { jwt: { secret: env.JWT_SECRET }, appUrl: env.PUBLIC_APP_URL },
  repos: createPrismaRepos(prisma),
  email: createLettermintTransport({ token: env.LETTERMINT_TOKEN })
});

const webauthn: WebAuthnConfig = {
  rpId: 'example.com',        // your registrable domain (no scheme/port)
  rpName: 'My App',
  origin: env.PUBLIC_APP_URL  // e.g. https://app.example.com
  // challengeStore defaults to in-memory; pass a ChallengeStore for >1 instance
};

// One factory returns all six passkey handlers (both ceremonies + list/delete).
export const passkey = createPasskeyHandlers(authDeps, webauthn);

// 2. src/routes/api/auth/passkey/authentication-options/+server.ts
import { passkey } from '$lib/server/auth-setup';
export const POST = passkey.authenticationOptions.POST;

// 3. src/routes/api/auth/passkey/authentication-verify/+server.ts
import { passkey } from '$lib/server/auth-setup';
export const POST = passkey.authenticationVerify.POST;
// passkey.registrationOptions / passkey.registrationVerify (and passkey.list /
// passkey.item for the PasskeyManager) wire up identically on sibling routes.

// 4. src/routes/auth/login/+page.svelte
<scr` +
    `ipt lang="ts">
  import { LoginPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
  import { goto } from '$app/navigation';
</scr` +
    `ipt>

<LoginPage
  t={en}
  mode="both"
  passkeyApiPath="/api/auth/passkey"
  onSuccess={() => goto('/')}
/>`;
</script>

<SeoMeta title={`${title} Recipe`} {description} />

<div class="mx-auto max-w-6xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <InfoCard intent="info" title="Full-stack flow">
          This preview renders the real <code>LoginPage</code> with the passkey entry point. Signing in
          needs the server handlers from the code below wired into your SvelteKit routes.
        </InfoCard>
        <div
          class="border-border-subtle bg-surface-subtle mt-4 flex min-h-105 items-center justify-center rounded-xl border p-8"
        >
          <div class="w-full max-w-sm">
            <!-- Preview-only link targets — see auth-invitation-register. -->
            <LoginPage
              mode="both"
              passkeyApiPath="/api/auth/passkey"
              registerUrl={resolve('/auth/components/register-page')}
              forgotPasswordUrl={resolve('/auth/components/forgot-password-page')}
            />
          </div>
        </div>
      </Section>
    </div>

    <div class="space-y-8">
      <Section id="features" title="Key Features">
        <RecipeFeatures {features} />
      </Section>
    </div>
  </div>

  <Section id="code" title="Code" class="mt-12">
    <CodeExample title="{title} — full flow" code={recipeCode} language="svelte" preview={false} />
  </Section>
</div>
