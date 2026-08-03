<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    Alert,
    Button,
    Card,
    Checkbox,
    EyeOffIcon,
    Input,
    LockIcon,
    Separator
  } from '@urbicon-ui/blocks';
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const { features } = recipeMeta;

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

      <Button intent="primary" class="mt-6 w-full" type="submit"
        disabled={loading} {loading}>
        Sign in
      </Button>
    </form>
  </div>
</Card>`;
</script>

<SeoMeta title="Login Form Recipe" description={recipeMeta.description} />

<div class="mx-auto max-w-6xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <!-- Live Preview (2 cols) -->
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <InfoCard intent="info" title="Demo credentials">
          Try <strong>demo@example.com</strong> / <strong>password123</strong>
        </InfoCard>

        <div
          class="border-border-subtle bg-surface-subtle mt-4 flex min-h-96 items-center justify-center rounded-xl border p-8"
        >
          <div class="w-full max-w-sm">
            <Card class="border-border-subtle shadow-[var(--blocks-shadow-lg)]">
              <div class="p-8">
                <div class="mb-8 text-center">
                  <div
                    class="bg-primary text-text-on-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                  >
                    <LockIcon size={24} />
                  </div>
                  <p class="text-text-primary text-xl font-bold">Welcome back</p>
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
                        <EyeOffIcon size={16} />
                      </button>
                    </div>
                    <div class="flex items-center justify-between">
                      <Checkbox label="Remember me" size="sm" bind:checked={rememberMe} />
                      <a href="#forgot" class="text-primary text-sm hover:underline"
                        >Forgot password?</a
                      >
                    </div>
                    <Button
                      intent="primary"
                      class="w-full"
                      type="submit"
                      disabled={loading}
                      {loading}>Sign in</Button
                    >
                  </form>
                  <div class="mt-6">
                    <Separator />
                    <p class="text-text-tertiary mt-4 text-left text-sm">
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
      <Section id="features" title="Key Features">
        <RecipeFeatures {features} />
      </Section>
    </div>
  </div>

  <!-- Source Code -->
  <Section id="code" title="Code" class="mt-12">
    <CodeExample title="Login Form Recipe" code={recipeCode} language="svelte" preview={false} />
  </Section>
</div>
