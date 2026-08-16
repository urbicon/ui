<script lang="ts">
  import {
    Alert,
    Button,
    Card,
    Checkbox,
    EyeIcon,
    EyeOffIcon,
    Input,
    LockIcon,
    Separator
  } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  let email = $state('');
  let password = $state('');
  let rememberMe = $state(false);
  let showPassword = $state(false);
  let loading = $state(false);
  let error = $state('');
  let success = $state(false);

  // An empty field is not a wrong field: these pass while blank, and
  // canSubmit gates submission separately.
  let emailValid = $derived(email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  let passwordValid = $derived(password === '' || password.length >= 8);
  let canSubmit = $derived(email !== '' && password !== '' && emailValid && passwordValid);

  async function handleLogin() {
    if (!canSubmit) return;
    loading = true;
    error = '';
    // Stand-in for a session call — the demo accepts exactly one pair.
    await new Promise((r) => setTimeout(r, 1500));
    if (email === 'demo@example.com' && password === 'password123') {
      success = true;
    } else {
      error = 'Invalid email or password. Try demo@example.com / password123';
    }
    loading = false;
  }

  const recipeCode = `<\script lang="ts">
  import {
    Alert,
    Button,
    Card,
    Checkbox,
    EyeIcon,
    EyeOffIcon,
    Input,
    LockIcon,
    Separator
  } from '@urbicon-ui/blocks';

  let email = $state('');
  let password = $state('');
  let rememberMe = $state(false);
  let showPassword = $state(false);
  let loading = $state(false);
  let error = $state('');
  let success = $state(false);

  // An empty field is not a wrong field: these pass while blank, and
  // canSubmit gates submission separately.
  let emailValid = $derived(email === '' || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email));
  let passwordValid = $derived(password === '' || password.length >= 8);
  let canSubmit = $derived(email !== '' && password !== '' && emailValid && passwordValid);

  async function handleLogin() {
    if (!canSubmit) return;
    loading = true;
    error = '';
    // Stand-in for your session call — the demo accepts exactly one pair.
    await new Promise((r) => setTimeout(r, 1500));
    if (email === 'demo@example.com' && password === 'password123') {
      success = true; // a real app navigates here instead
    } else {
      error = 'Invalid email or password. Try demo@example.com / password123';
    }
    loading = false;
  }
<\/script>

<!-- Centre it in your page's own layout; the card caps its own width. -->
<div class="w-full max-w-sm">
  <Card variant="elevated" padding="lg">
    <div class="mb-8 text-center">
      <div
        class="bg-primary text-text-on-primary rounded-bridge mx-auto mb-4 flex h-12 w-12 items-center justify-center"
      >
        <LockIcon size={24} />
      </div>
      <h2 class="text-text-primary text-xl font-bold">Welcome back</h2>
      <p class="text-text-tertiary mt-1 text-sm">Sign in to your account</p>
    </div>

    {#if error}
      <div class="mb-6">
        <Alert intent="danger" variant="soft" size="sm" dismissible onDismiss={() => (error = '')}>
          {error}
        </Alert>
      </div>
    {/if}

    {#if success}
      <Alert intent="success" variant="soft" size="sm">
        Logged in successfully! Redirecting...
      </Alert>
    {:else}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
        class="space-y-5"
      >
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          bind:value={email}
          error={!emailValid ? 'Please enter a valid email' : undefined}
          required
        />
        <div class="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 8 characters"
            bind:value={password}
            error={!passwordValid ? 'Password must be at least 8 characters' : undefined}
            required
          />
          <!-- Icon-only, so the icon must track the state; aria-pressed and
               the swapping label tell a screen reader the same thing. -->
          <button
            type="button"
            class="text-text-tertiary hover:text-text-primary absolute top-8 right-3"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onclick={() => (showPassword = !showPassword)}
          >
            {#if showPassword}
              <EyeOffIcon size={16} />
            {:else}
              <EyeIcon size={16} />
            {/if}
          </button>
        </div>
        <div class="flex items-center justify-between">
          <Checkbox label="Remember me" size="sm" bind:checked={rememberMe} />
          <a href="#forgot" class="text-primary text-sm hover:underline">Forgot password?</a>
        </div>
        <Button intent="primary" class="w-full" type="submit" disabled={loading} {loading}>
          Sign in
        </Button>
      </form>
      <div class="mt-6">
        <Separator />
        <p class="text-text-tertiary mt-4 text-left text-sm">
          Don't have an account?
          <a href="#signup" class="text-primary font-medium hover:underline">Sign up</a>
        </p>
      </div>
    {/if}
  </Card>
</div>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="LoginPage.svelte"
      description="Sign in with `demo@example.com` / `password123` — any other pair takes the failure path."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="w-full max-w-sm">
        <Card variant="elevated" padding="lg">
          <div class="mb-8 text-center">
            <div
              class="bg-primary text-text-on-primary rounded-bridge mx-auto mb-4 flex h-12 w-12 items-center justify-center"
            >
              <LockIcon size={24} />
            </div>
            <h2 class="text-text-primary text-xl font-bold">Welcome back</h2>
            <p class="text-text-tertiary mt-1 text-sm">Sign in to your account</p>
          </div>

          {#if error}
            <div class="mb-6">
              <Alert
                intent="danger"
                variant="soft"
                size="sm"
                dismissible
                onDismiss={() => (error = '')}
              >
                {error}
              </Alert>
            </div>
          {/if}

          {#if success}
            <Alert intent="success" variant="soft" size="sm">
              Logged in successfully! Redirecting...
            </Alert>
          {:else}
            <form
              onsubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              class="space-y-5"
            >
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                bind:value={email}
                error={!emailValid ? 'Please enter a valid email' : undefined}
                required
              />
              <div class="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  bind:value={password}
                  error={!passwordValid ? 'Password must be at least 8 characters' : undefined}
                  required
                />
                <!-- Icon-only, so the icon must track the state; aria-pressed and
                     the swapping label tell a screen reader the same thing. -->
                <button
                  type="button"
                  class="text-text-tertiary hover:text-text-primary absolute top-8 right-3"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onclick={() => (showPassword = !showPassword)}
                >
                  {#if showPassword}
                    <EyeOffIcon size={16} />
                  {:else}
                    <EyeIcon size={16} />
                  {/if}
                </button>
              </div>
              <div class="flex items-center justify-between">
                <Checkbox label="Remember me" size="sm" bind:checked={rememberMe} />
                <a href="#forgot" class="text-primary text-sm hover:underline">Forgot password?</a>
              </div>
              <Button intent="primary" class="w-full" type="submit" disabled={loading} {loading}>
                Sign in
              </Button>
            </form>
            <div class="mt-6">
              <Separator />
              <p class="text-text-tertiary mt-4 text-left text-sm">
                Don't have an account?
                <a href="#signup" class="text-primary font-medium hover:underline">Sign up</a>
              </p>
            </div>
          {/if}
        </Card>
      </div>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="Errors wait for input">
        <p>
          An empty field is not a wrong field: <code class="text-text-primary">emailValid</code>
          and <code class="text-text-primary">passwordValid</code> pass while their field is blank,
          so the form does not load red. Submission is gated separately —
          <code class="text-text-primary">canSubmit</code> requires both fields filled and valid,
          and <code class="text-text-primary">handleLogin</code> bails without it — so holding the messages
          back lets nothing through.
        </p>
      </Note>
      <Note title="The card fakes the session, not the states">
        <p>
          <code class="text-text-primary">handleLogin</code> is a stand-in: swap its body for your
          session call and keep what surrounds it — the Button carries
          <code class="text-text-primary">loading</code>, failure lands in a dismissible Alert,
          success replaces the form. For sign-in with the logic included — sessions, passkeys, the
          forms around them —
          <a class="text-primary hover:underline" href={resolve('/recipes/auth-passkey-login')}
            >Passkey Login</a
          >
          renders <code class="text-text-primary">LoginPage</code> from
          <code class="text-text-primary">@urbicon-ui/auth</code>.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
