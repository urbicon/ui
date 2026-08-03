<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import { ForgotPasswordPage } from '@urbicon-ui/auth';
  import { componentLinks } from '$lib/component-links';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';

  const { title, description, components: usedComponents, features } = recipeMeta;

  const recipeCode =
    `// 1. src/routes/api/auth/forgot-password/+server.ts — request a reset link
import { createForgotPasswordHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';
export const { POST } = createForgotPasswordHandler(authDeps);

// 2. src/routes/api/auth/reset-password/+server.ts — consume the token
import { createResetPasswordHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';
export const { POST } = createResetPasswordHandler(authDeps);

// 3. Observe delivery failures. forgot-password is fire-and-forget (so response
//    time can't reveal whether the account exists), so a broken mail transport
//    can't surface as an HTTP error — wire the hook in auth-setup.ts:
//    hooks: { onPasswordResetFailed: (email, err) => reportError(err) }

// 4. src/routes/auth/forgot-password/+page.svelte
<scr` +
    `ipt lang="ts">
  import { ForgotPasswordPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
</scr` +
    `ipt>

<ForgotPasswordPage t={en} />

// 5. src/routes/auth/reset-password/+page.svelte — token arrives as ?token=...
<scr` +
    `ipt lang="ts">
  import { ResetPasswordPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
  import { page } from '$app/state';

  const token = page.url.searchParams.get('token') ?? '';
</scr` +
    `ipt>

<!-- On success the page shows a confirmation + a link to loginUrl (default /auth/login). -->
<ResetPasswordPage t={en} {token} />`;
</script>

<SeoMeta title={`${title} Recipe`} {description} />

<div class="mx-auto max-w-6xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <InfoCard intent="info" title="Full-stack flow">
          This preview renders the real <code>ForgotPasswordPage</code> — step one of the two-page flow.
          Requesting a link and resetting need the handlers from the code below.
        </InfoCard>
        <div
          class="border-border-subtle bg-surface-subtle mt-4 flex min-h-[420px] items-center justify-center rounded-xl border p-8"
        >
          <div class="w-full max-w-sm">
            <!-- Preview-only link target — see auth-invitation-register. -->
            <ForgotPasswordPage loginUrl={resolve('/auth/components/login-page')} />
          </div>
        </div>
      </Section>
    </div>

    <div class="space-y-8">
      <Section id="features" title="Key Features" headingLevel={2}>
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

      <Section id="components" title="Components Used" headingLevel={2}>
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
