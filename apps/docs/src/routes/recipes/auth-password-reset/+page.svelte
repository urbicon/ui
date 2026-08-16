<script lang="ts">
  import { ForgotPasswordPage } from '@urbicon-ui/auth';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  const recipeCode = `// 1. src/routes/api/auth/forgot-password/+server.ts — request a reset link
import { createForgotPasswordHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';
export const { POST } = createForgotPasswordHandler(authDeps);

// 2. Observe delivery failures. forgot-password is fire-and-forget (so response
//    time can't reveal whether the account exists), so a broken mail transport
//    can't surface as an HTTP error — wire the hook in auth-setup.ts:
//    hooks: { onPasswordResetFailed: (email, err) => reportError(err) }

// 3. src/routes/auth/forgot-password/+page.svelte
<\script lang="ts">
  import { ForgotPasswordPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
<\/script>

<ForgotPasswordPage t={en} />`;

  const resetCode = `// 1. src/routes/api/auth/reset-password/+server.ts — consume the token
import { createResetPasswordHandler } from '@urbicon-ui/auth/server';
import { authDeps } from '$lib/server/auth-setup';
export const { POST } = createResetPasswordHandler(authDeps);

// 2. src/routes/auth/reset-password/+page.svelte — the token arrives as ?token=...
<\script lang="ts">
  import { ResetPasswordPage } from '@urbicon-ui/auth';
  import { en } from '@urbicon-ui/auth/i18n/en';
  import { page } from '$app/state';

  const token = page.url.searchParams.get('token') ?? '';
<\/script>

<!-- On success the page shows a confirmation + a link to loginUrl (default /auth/login). -->
<ResetPasswordPage t={en} {token} />`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <!-- Stacked CodeExamples carry no margin of their own; the wrapper spaces
         them (same as clickable-card and page-header). -->
    <div class="space-y-10">
      <CodeExample
        title="ForgotPasswordPage.svelte"
        description="Step one of the two-page flow. Send an address; with no auth routes behind the docs site, the demo stops at the form's error message."
        code={recipeCode}
        language="svelte"
        headingLevel={2}
      >
        <!-- Preview-only link target and width cap — see auth-invitation-register. -->
        <ForgotPasswordPage
          class="w-full max-w-md"
          loginUrl={resolve('/auth/components/login-page')}
        />
      </CodeExample>

      <CodeExample
        title="ResetPasswordPage.svelte"
        description="Step two, code only: the emailed link lands on this route with `?token=`, and the page sets the new password against it."
        code={resetCode}
        language="svelte"
        headingLevel={2}
        preview={false}
      />
    </div>
  </Section>

  <Section id="decisions" title="Three decisions">
    <NoteList>
      <Note title="Step two has no demo">
        <p>
          The reset page's one meaningful input is the token step one mails out. The docs site has
          no mailbox to read, and a made-up token would only demonstrate the failure path, so
          <code class="text-text-primary">ResetPasswordPage</code> ships here as code. In your app
          the emailed link carries <code class="text-text-primary">?token=</code>, and the route
          above hands it to the page.
        </p>
      </Note>
      <Note title="The confirmation never says whether the account exists">
        <p>
          <code class="text-text-primary">createForgotPasswordHandler</code> answers with the same
          confirmation for known and unknown addresses, and the mail leaves fire-and-forget,
          detached from the response, so neither the message nor the response time reveals whether
          an account exists. The cost: a broken mail transport cannot surface as an HTTP error,
          which is what the <code class="text-text-primary">onPasswordResetFailed</code> hook in the code
          is for.
        </p>
      </Note>
      <Note title="A used link is dead, and so are the sessions">
        <p>
          <code class="text-text-primary">consumeResetToken</code> claims the token atomically, so a
          link spends once even when submitted twice. A successful reset then bumps the user's
          <code class="text-text-primary">tokenVersion</code> and revokes every refresh token: access
          cookies issued before the reset fail their next check, and a stolen pre-reset refresh cookie
          cannot mint new ones.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
