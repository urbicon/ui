<script lang="ts">
  import { RegisterPage } from '@urbicon-ui/auth';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  const recipeCode = `// 1. src/routes/api/auth/register/+server.ts — the bundled register handler
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
<\script lang="ts">
  import { RegisterPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
<\/script>

<!-- The invite link is /auth/register?token=<secret>&email=<invitee>. The token
     IS the proof of invitation — without it the request is refused. -->
<RegisterPage
  t={en}
  token={page.url.searchParams.get('token') ?? ''}
  defaultEmail={page.url.searchParams.get('email') ?? ''}
  onSuccess={() => goto('/')}
/>

// 4. src/routes/admin/invitations/+page.svelte — admin panel
<\script lang="ts">
  import { InvitationManager } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';

  const roles = [
    { value: 'ADMIN', label: 'Admin' },
    { value: 'USER', label: 'User' }
  ];
<\/script>

<InvitationManager t={en} {roles} apiPath="/api/invitations" />`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="RegisterPage.svelte"
      description="The form is live, but the docs site mints no invitations and runs no auth routes, so submitting ends in its error message."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <!-- Preview-only: point the component's own link prop at this site's
           docs page. A consuming app owns /auth/*; the docs site has no such
           route, so the default would 404 on click. The snippet keeps the
           real-world defaults, plus t and onSuccess (the demo inherits the
           site locale and has nowhere to navigate). The width cap is the
           stage's; in an app the component centres its own card. -->
      <RegisterPage
        class="w-full max-w-md"
        token=""
        loginUrl={resolve('/auth/components/login-page')}
      />
    </CodeExample>
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="The token is the gate, not the address">
        <p>
          Registration is gated on possession of the invitation token and on nothing else. Without a
          valid one the handler answers the same
          <code class="text-text-primary">invitation_required</code> 403 for every address, registered
          or not, so registration status never leaks. The email in the body is not trusted either: the
          invitation names the invitee, and a body naming a different address gets that same 403 rather
          than a way to redirect the invite.
        </p>
      </Note>
      <Note title="The account exists before the invite burns">
        <p>
          The handler creates the user first and claims the invitation second (<code
            class="text-text-primary">markUsedIfUnused</code
          >, an atomic flip). The email unique-constraint on create is the serialization point, so
          two tabs racing the same invite yield one account; and a create that fails never consumes
          the invitation, so the invitee retries instead of landing in "invite spent, no account".
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
