<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import { Badge } from '@urbicon-ui/blocks';
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import { LoginPage } from '@urbicon-ui/auth';
  import { componentLinks } from '$lib/component-links';
  import { recipeMeta } from './meta';

  const { title, description, components: usedComponents, features } = recipeMeta;

  const recipeCode =
    `// 1. src/lib/server/auth-setup.ts — auth deps + shared WebAuthn ceremony config
import { createAuthDeps } from '@urbicon-ui/auth/server';
import { createPrismaRepos } from '@urbicon-ui/auth/server/adapters/prisma';
import { createLettermintTransport } from '@urbicon-ui/auth/server/email/lettermint';
import type { PasskeyHandlerDeps } from '@urbicon-ui/auth/server';
import { env } from '$env/dynamic/private';
import { prisma } from './prisma';

export const authDeps = createAuthDeps({
  config: { jwt: { secret: env.JWT_SECRET }, appUrl: env.PUBLIC_APP_URL },
  repos: createPrismaRepos(prisma),
  email: createLettermintTransport({ apiKey: env.LETTERMINT_KEY })
});

export const passkeyDeps: PasskeyHandlerDeps = {
  webauthn: {
    rpId: 'example.com',        // your registrable domain (no scheme/port)
    rpName: 'My App',
    origin: env.PUBLIC_APP_URL  // e.g. https://app.example.com
    // challengeStore defaults to in-memory; pass a ChallengeStore for >1 instance
  },
  authConfig: authDeps.config,
  repos: { passkey: authDeps.repos.passkey, user: authDeps.repos.user }
};

// 2. src/routes/api/auth/passkey/authentication-options/+server.ts
import { createPasskeyAuthenticationOptionsHandler } from '@urbicon-ui/auth/server';
import { passkeyDeps } from '$lib/server/auth-setup';
export const { POST } = createPasskeyAuthenticationOptionsHandler(passkeyDeps);

// 3. src/routes/api/auth/passkey/authentication-verify/+server.ts
import { createPasskeyAuthenticationVerifyHandler } from '@urbicon-ui/auth/server';
import { passkeyDeps } from '$lib/server/auth-setup';
export const { POST } = createPasskeyAuthenticationVerifyHandler(passkeyDeps);
// registration-options + registration-verify wire up identically (Registration handlers).

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
  <div class="mb-10">
    <a
      href={resolve('/recipes')}
      class="text-text-tertiary hover:text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        /></svg
      >
      Back to Recipes
    </a>
    <h1 class="text-text-primary mb-2 text-3xl font-bold">{title}</h1>
    <p class="text-text-secondary mb-4 text-lg">{description}</p>
    <div class="flex flex-wrap gap-1.5">
      {#each usedComponents as comp (comp)}
        <a href={r(componentLinks[comp] ?? '#')}>
          <Badge
            variant="outlined"
            intent="primary"
            size="sm"
            class="hover:bg-primary-subtle transition-colors">{comp}</Badge
          >
        </a>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <InfoCard intent="info" title="Full-stack flow">
          This preview renders the real <code>LoginPage</code> with the passkey entry point. Signing in
          needs the server handlers from the code below wired into your SvelteKit routes.
        </InfoCard>
        <div
          class="border-border-subtle bg-surface-subtle mt-4 flex min-h-[420px] items-center justify-center rounded-xl border p-8"
        >
          <div class="w-full max-w-sm">
            <LoginPage mode="both" passkeyApiPath="/api/auth/passkey" />
          </div>
        </div>
      </Section>
    </div>

    <div class="space-y-8">
      <Section id="features" title="Key Features" headingLevel={3}>
        <ul class="space-y-2">
          {#each features as feature (feature)}
            <li class="text-text-secondary flex items-start gap-2 text-sm">
              <svg
                class="text-success mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                /></svg
              >
              {feature}
            </li>
          {/each}
        </ul>
      </Section>

      <Section id="components" title="Components Used" headingLevel={3}>
        <div class="space-y-2">
          {#each usedComponents as comp (comp)}
            <a
              href={r(componentLinks[comp] ?? '#')}
              class="text-text-secondary hover:bg-surface-hover hover:text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <svg
                class="text-primary h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 7l5 5-5 5M6 12h12"
                /></svg
              >
              {comp}
            </a>
          {/each}
        </div>
      </Section>
    </div>
  </div>

  <div class="mt-12">
    <CodeExample title="{title} — full flow" code={recipeCode} language="svelte" preview={false} />
  </div>
</div>
