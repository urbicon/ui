<script lang="ts">
  let { data } = $props();

  let pending = $state(false);

  async function logout() {
    pending = true;
    await fetch('/test-fixtures/auth/api/logout', { method: 'POST' });
    // Full reload so the next navigation hits the server fresh and the
    // handle hook re-evaluates without any cached client state.
    window.location.href = '/test-fixtures/auth/login';
  }
</script>

<main>
  <h1>Protected</h1>
  <p data-testid="protected-user">Signed in as {data.user?.email}</p>
  <button data-testid="logout-btn" onclick={logout} disabled={pending}>
    {pending ? 'Signing out…' : 'Sign out'}
  </button>
</main>
