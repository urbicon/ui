<script lang="ts">
  import { LoginPage } from '@urbicon-ui/auth';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  const recipeCode = `// 1. src/lib/server/auth-setup.ts — auth deps + shared WebAuthn ceremony config
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
<\script lang="ts">
  import { LoginPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
  import { goto } from '$app/navigation';
<\/script>

<LoginPage
  t={en}
  mode="both"
  passkeyApiPath="/api/auth/passkey"
  onSuccess={() => goto('/')}
/>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="LoginPage.svelte"
      description="Try either path; the docs site runs none of the server routes, so both end in the form's error message instead of a session."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <!-- Preview-only link targets and width cap — see auth-invitation-register. -->
      <LoginPage
        class="w-full max-w-md"
        mode="both"
        passkeyApiPath="/api/auth/passkey"
        registerUrl={resolve('/auth/components/register-page')}
        forgotPasswordUrl={resolve('/auth/components/forgot-password-page')}
      />
    </CodeExample>
  </Section>

  <Section id="decisions" title="Two decisions and a boundary">
    <NoteList>
      <Note title="The challenge store is a deployment decision">
        <p>
          A ceremony is two requests. <code class="text-text-primary">authenticationOptions</code>
          mints a challenge, keeps it in the
          <code class="text-text-primary">challengeStore</code>, and pins a single-use handle to the
          browser in an HttpOnly cookie;
          <code class="text-text-primary">authenticationVerify</code> reads the handle back to find
          and consume that challenge. The in-memory default store only bridges the two requests on a
          single process: behind a load balancer or on serverless, the verify call can land where
          the challenge never was. Pass a persistent
          <code class="text-text-primary">ChallengeStore</code> in the
          <code class="text-text-primary">webauthn</code> config there.
        </p>
      </Note>
      <Note title="The passkey button works with the email empty">
        <p>
          Left blank, the options request names nobody and the browser offers every credential saved
          for this <code class="text-text-primary">rpId</code> (discoverable login). A filled email
          only narrows the prompt to that account's passkeys; whether the address exists is never
          answered. That is what lets <code class="text-text-primary">mode="both"</code> be one form
          instead of an identify-first step, and
          <code class="text-text-primary">mode="passkey"</code> drop the password fields entirely.
        </p>
      </Note>
      <Note title="Adding a passkey is a signed-in action">
        <p>
          <code class="text-text-primary">LoginPage</code> runs only the authentication ceremony, so
          it signs in with credentials that already exist. The first one is created by the
          registration ceremony, which requires a session: mount
          <code class="text-text-primary">passkey.registrationOptions</code> /
          <code class="text-text-primary">passkey.registrationVerify</code> on sibling routes and
          give account settings a
          <a class="text-primary hover:underline" href={resolve('/auth/components/passkey-manager')}
            >PasskeyManager</a
          >, whose list and delete run over
          <code class="text-text-primary">passkey.list</code> /
          <code class="text-text-primary">passkey.item</code>.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
