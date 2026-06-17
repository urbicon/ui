<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';

  let status = $state<'loading' | 'anonymous' | 'authenticated'>('loading');
  let user = $state<{ email: string; name: string } | null>(null);

  onMount(async () => {
    try {
      const res = await fetch('/test-fixtures/auth/api/me');
      if (res.ok) {
        const data = await res.json();
        user = data.user ?? null;
        status = user ? 'authenticated' : 'anonymous';
      } else {
        status = 'anonymous';
      }
    } catch {
      status = 'anonymous';
    }
  });
</script>

<main>
  <h1>E2E Auth Fixture</h1>
  <p data-testid="auth-status">Status: {status}</p>
  {#if user}
    <p data-testid="auth-user">Logged in as {user.email}</p>
  {/if}
  <ul>
    <li><a href={resolve('/test-fixtures/auth/login')} data-testid="nav-login">Login</a></li>
    <li>
      <a href={resolve('/test-fixtures/auth/protected')} data-testid="nav-protected">Protected</a>
    </li>
  </ul>
</main>
