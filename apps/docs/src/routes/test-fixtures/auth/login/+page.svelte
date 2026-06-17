<script lang="ts">
  let email = $state('');
  let password = $state('');
  let error = $state<string | null>(null);
  let pending = $state(false);

  async function submit() {
    error = null;
    pending = true;
    try {
      const res = await fetch('/test-fixtures/auth/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        window.location.href = '/test-fixtures/auth/protected';
      } else {
        const body = await res.json().catch(() => ({ error: 'Login failed' }));
        error = body.error ?? 'Login failed';
      }
    } finally {
      pending = false;
    }
  }
</script>

<main>
  <h1>E2E Auth — Login</h1>
  <label>
    Email
    <input
      data-testid="login-email"
      type="email"
      bind:value={email}
      autocomplete="username"
      required
    />
  </label>
  <label>
    Password
    <input
      data-testid="login-password"
      type="password"
      bind:value={password}
      autocomplete="current-password"
      required
    />
  </label>
  <button data-testid="login-submit" type="button" onclick={submit} disabled={pending}>
    {pending ? 'Signing in…' : 'Sign in'}
  </button>
  {#if error}
    <p data-testid="login-error" role="alert">{error}</p>
  {/if}
</main>
