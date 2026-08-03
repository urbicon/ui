<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import { RegisterPage } from '@urbicon-ui/auth';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const { title, description, features } = recipeMeta;

  const recipeCode =
    `// 1. src/routes/api/auth/register/+server.ts — the bundled register handler
import { createRegisterHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';
export const { POST } = createRegisterHandler(authDeps);

// 2. src/lib/server/invitations.ts — the bundled invitation handlers.
//    You only supply the authorization gate (who may manage invitations)
//    and the roles an invite may carry; validation, the invitedBy scoping
//    (session user, never the body) and {error,code} responses ship with it.
import { createInvitationHandlers } from '@urbicon-ui/auth/server';
import { authDeps } from './auth-setup';

export const invitations = createInvitationHandlers(authDeps, {
  authorize: (user) => user.role === 'ADMIN',
  roles: ['ADMIN', 'USER']
});

// src/routes/api/invitations/+server.ts — create + list
import { invitations } from '$lib/server/invitations';
export const POST = invitations.POST;
export const GET = invitations.GET;

// src/routes/api/invitations/[id]/+server.ts — revoke (InvitationManager's delete)
import { invitations } from '$lib/server/invitations';
export const DELETE = invitations.DELETE;

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

<InvitationManager t={en} {roles} apiPath="/api/invitations" />`;
</script>

<SeoMeta title={`${title} Recipe`} {description} />

<div class="mx-auto max-w-6xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <InfoCard intent="info" title="Full-stack flow">
          This preview renders the real <code>RegisterPage</code>. Registration only succeeds for an
          email an admin has invited — wire the register handler and invitation routes from the code
          below.
        </InfoCard>
        <div
          class="border-border-subtle bg-surface-subtle mt-4 flex min-h-105 items-center justify-center rounded-xl border p-8"
        >
          <div class="w-full max-w-sm">
            <!-- Preview-only: point the component's own link prop at this site's
                 docs page. A consuming app owns /auth/*; the docs site has no
                 such route, so the default would 404 on click. The snippet above
                 keeps the real-world defaults. -->
            <RegisterPage loginUrl={resolve('/auth/components/login-page')} />
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
