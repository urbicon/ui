<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import { Badge } from '@urbicon-ui/blocks';
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import { RegisterPage } from '@urbicon-ui/auth';
  import { componentLinks } from '$lib/component-links';
  import { recipeMeta } from './meta';

  const { title, description, components: usedComponents, features } = recipeMeta;

  const recipeCode =
    `// 1. src/routes/api/auth/register/+server.ts — the bundled register handler
import { createRegisterHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';
export const { POST } = createRegisterHandler(authDeps);

// 2. Invitation CRUD — YOU implement these with authDeps.repos.invitation.
//    They are NOT bundled (unlike the auth handlers) because the admin policy
//    is app-specific. Scope every write to the signed-in admin via locals.user.
// src/routes/api/invitations/+server.ts
import { json } from '@sveltejs/kit';
import { authDeps } from '$lib/server/auth-setup';

export async function GET({ locals }) {
  if (locals.user?.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });
  return json({ invitations: await authDeps.repos.invitation.list() });
}

export async function POST({ request, locals }) {
  if (locals.user?.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });
  const { email, role } = await request.json();
  // invitedById comes from the authenticated admin — never from the body.
  await authDeps.repos.invitation.create({ email, role, invitedById: locals.user.id });
  return json({ ok: true }, { status: 201 });
}

// 3. src/routes/auth/register/+page.svelte
<scr` +
    `ipt lang="ts">
  import { RegisterPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
  import { goto } from '$app/navigation';
</scr` +
    `ipt>

<RegisterPage t={en} onSuccess={() => goto('/')} />

// 4. src/routes/admin/invitations/+page.svelte — admin panel
<scr` +
    `ipt lang="ts">
  import { InvitationManager } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';

  const roles = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'USER', label: 'User' }
  ];
</scr` +
    `ipt>

<InvitationManager t={en} {roles} basePath="/api/invitations" />`;
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
          This preview renders the real <code>RegisterPage</code>. Registration only succeeds for an
          email an admin has invited — wire the register handler and invitation routes from the code
          below.
        </InfoCard>
        <div
          class="border-border-subtle bg-surface-subtle mt-4 flex min-h-[420px] items-center justify-center rounded-xl border p-8"
        >
          <div class="w-full max-w-sm">
            <RegisterPage />
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
