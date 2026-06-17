<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import { Button, Input, Checkbox, Card, Alert, Badge, Separator } from '@urbicon-ui/blocks';
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import { componentLinks } from '$lib/component-links';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  let email = $state('');
  let password = $state('');
  let rememberMe = $state(false);
  let showPassword = $state(false);
  let loading = $state(false);
  let error = $state('');
  let success = $state(false);

  let emailValid = $derived(email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  let passwordValid = $derived(password === '' || password.length >= 8);
  let canSubmit = $derived(email !== '' && password !== '' && emailValid && passwordValid);

  async function handleLogin() {
    if (!canSubmit) return;
    loading = true;
    error = '';
    await new Promise((r) => setTimeout(r, 1500));
    if (email === 'demo@example.com' && password === 'password123') {
      success = true;
    } else {
      error = 'Invalid email or password. Try demo@example.com / password123';
    }
    loading = false;
  }

  const recipeCode =
    `<script lang="ts">
  import { Button, Input, Checkbox, Card, Alert } from '@urbicon-ui/blocks';

  let email = $state('');
  let password = $state('');
  let rememberMe = $state(false);
  let loading = $state(false);
  let error = $state('');

  let emailValid = $derived(
    email === '' || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)
  );
  let canSubmit = $derived(email !== '' && password.length >= 8 && emailValid);

  async function handleLogin() {
    if (!canSubmit) return;
    loading = true;
    error = '';
    await new Promise((r) => setTimeout(r, 1500));
    // Replace with your auth logic
    if (email === 'demo@example.com' && password === 'password123') {
      window.location.href = '/dashboard';
    } else {
      error = 'Invalid credentials';
    }
    loading = false;
  }
</scr` +
    `ipt>

<Card class="mx-auto max-w-sm shadow-lg">
  <div class="p-8">
    <h3 class="mb-6 text-center text-xl font-bold">Sign In</h3>

    {#if error}
      <Alert intent="danger" variant="soft" size="sm" dismissible
        onDismiss={() => (error = '')}>{error}</Alert>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
      <Input label="Email" type="email" placeholder="you@example.com"
        bind:value={email}
        error={!emailValid ? 'Invalid email' : undefined} />

      <Input label="Password" type="password"
        bind:value={password} class="mt-4" />

      <div class="mt-4 flex items-center justify-between">
        <Checkbox label="Remember me" bind:checked={rememberMe} />
        <a href="/forgot" class="text-sm text-primary">Forgot?</a>
      </div>

      <Button intent="primary" class="mt-6 w-full"
        disabled={!canSubmit} {loading}>
        Sign in
      </Button>
    </form>
  </div>
</Card>`;
</script>

<SeoMeta title="Login Form Recipe" />

<div class="mx-auto max-w-6xl px-6 py-12">
  <!-- Header -->
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
    <h1 class="text-text-primary mb-2 text-3xl font-bold">Login Form</h1>
    <p class="text-text-secondary mb-4 text-lg">
      Complete authentication form with validation, password visibility, and demo credentials.
    </p>
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
    <!-- Live Preview (2 cols) -->
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <InfoCard intent="info" title="Demo credentials">
          Try <strong>demo@example.com</strong> / <strong>password123</strong>
        </InfoCard>

        <div
          class="border-border-subtle bg-surface-subtle mt-4 flex min-h-[480px] items-center justify-center rounded-xl border p-8"
        >
          <div class="w-full max-w-sm">
            <Card class="border-border-subtle shadow-[var(--blocks-shadow-lg)]">
              <div class="p-8">
                <div class="mb-8 text-center">
                  <div
                    class="bg-primary text-text-on-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                  >
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      ><path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      /></svg
                    >
                  </div>
                  <h3 class="text-text-primary text-xl font-bold">Welcome back</h3>
                  <p class="text-text-tertiary mt-1 text-sm">Sign in to your account</p>
                </div>

                {#if error}
                  <div class="mb-6">
                    <Alert
                      intent="danger"
                      variant="soft"
                      size="sm"
                      dismissible
                      onDismiss={() => (error = '')}>{error}</Alert
                    >
                  </div>
                {/if}

                {#if success}
                  <Alert intent="success" variant="soft" size="sm"
                    >Logged in successfully! Redirecting...</Alert
                  >
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
                        error={!passwordValid
                          ? 'Password must be at least 8 characters'
                          : undefined}
                        required
                      />
                      <button
                        type="button"
                        class="text-text-tertiary hover:text-text-primary absolute top-8 right-3"
                        onclick={() => (showPassword = !showPassword)}
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {#if showPassword}
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                            />
                          {:else}
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          {/if}
                        </svg>
                      </button>
                    </div>
                    <div class="flex items-center justify-between">
                      <Checkbox label="Remember me" size="sm" bind:checked={rememberMe} />
                      <a href="#forgot" class="text-primary text-sm hover:underline"
                        >Forgot password?</a
                      >
                    </div>
                    <Button intent="primary" class="w-full" disabled={!canSubmit} {loading}
                      >Sign in</Button
                    >
                  </form>
                  <div class="mt-6">
                    <Separator />
                    <p class="text-text-tertiary mt-4 text-center text-sm">
                      Don't have an account? <a
                        href="#signup"
                        class="text-primary font-medium hover:underline">Sign up</a
                      >
                    </p>
                  </div>
                {/if}
              </div>
            </Card>
          </div>
        </div>
      </Section>
    </div>

    <!-- Sidebar -->
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

  <!-- Source Code -->
  <div class="mt-12">
    <CodeExample title="Login Form Recipe" code={recipeCode} language="svelte" preview={false} />
  </div>
</div>
