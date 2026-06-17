<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  /**
   * Isolated spike for the F3.7 light-dark() refactor.
   *
   * The tokens below are defined inside `[data-spike]`, so they sit at
   * higher specificity than the `:root.dark` block in semantic.css and
   * actually exercise CSS-native `light-dark()`. Without this scope,
   * `:root.dark` would always win and the spike would silently fall
   * back to the existing dark overrides — that's what was happening
   * when the spike file was imported alongside semantic.css.
   *
   * Verify in DevTools:
   *  - Click "Light" / "Dark" / "OS" — the swatches and the
   *    "Computed value" column update without reloading the stylesheet.
   *  - Inspect any swatch → Computed → look for `background-color`.
   *    The resolved oklch() should match the expected light/dark column.
   */
  import { onMount } from 'svelte';

  type Mode = 'auto' | 'light' | 'dark';
  let mode = $state<Mode>('auto');
  let computed = $state<Record<string, string>>({});

  // 13 core tokens, expanded with feedback intents. If these resolve
  // correctly the broader refactor (~80 tokens) is plausible.
  const tokens = [
    'color-surface-base',
    'color-surface-elevated',
    'color-surface-hover',
    'color-surface-active',
    'color-text-primary',
    'color-text-secondary',
    'color-primary',
    'color-primary-hover',
    'color-primary-active',
    'color-primary-subtle',
    'color-primary-emphasis',
    'color-success',
    'color-danger',
    'color-warning',
    'color-info'
  ] as const;

  let scopeEl = $state<HTMLDivElement | undefined>();

  function refreshComputed() {
    if (!scopeEl) return;
    const cs = getComputedStyle(scopeEl);
    const next: Record<string, string> = {};
    for (const token of tokens) {
      next[token] = cs.getPropertyValue(`--${token}`).trim() || '(unset)';
    }
    computed = next;
  }

  onMount(() => {
    refreshComputed();
  });

  $effect(() => {
    void mode;
    // Wait one frame so the new color-scheme has resolved.
    requestAnimationFrame(refreshComputed);
  });
</script>

<SeoMeta title="light-dark() spike" />

<div bind:this={scopeEl} data-spike data-mode={mode}>
  <header>
    <h1>F3.7 — <code>light-dark()</code> spike</h1>
    <p>
      Tokens are scoped to <code>[data-spike]</code> and use the CSS-native
      <code>light-dark()</code> function. Toggle the mode below to verify that the resolved values actually
      flip — without a page reload.
    </p>

    <fieldset>
      <legend>color-scheme</legend>
      <label><input type="radio" name="mode" value="auto" bind:group={mode} /> Auto (OS)</label>
      <label><input type="radio" name="mode" value="light" bind:group={mode} /> Light</label>
      <label><input type="radio" name="mode" value="dark" bind:group={mode} /> Dark</label>
    </fieldset>
  </header>

  <h2>Resolved token values (current mode)</h2>
  <p class="note">
    These are the <em>computed</em> values — what the browser ships to layout. If they read like
    OKLCH numbers (not raw <code>light-dark(...)</code>), the function is being resolved correctly.
  </p>

  <table>
    <thead>
      <tr>
        <th>Token</th>
        <th>Resolved value</th>
        <th>Swatch</th>
      </tr>
    </thead>
    <tbody>
      {#each tokens as token (token)}
        <tr>
          <td><code>--{token}</code></td>
          <td><code>{computed[token] ?? '…'}</code></td>
          <td>
            <span class="swatch" style="background: var(--{token});"></span>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <h2>Visual swatches</h2>
  <div class="grid">
    {#each tokens as token (token)}
      <div class="card" style="background: var(--{token});">
        <span class="card-label">{token}</span>
      </div>
    {/each}
  </div>

  <h2>Combined surface + text</h2>
  <div class="combo">
    <p>
      Surface: <code>--color-surface-base</code><br />
      Text: <code>--color-text-primary</code><br />
      Toggle the mode and watch this region invert.
    </p>
  </div>
</div>

<style>
  /*
   * Higher specificity than :root.dark / :root.light from semantic.css,
   * so the spike actually wins inside this scope.
   */
  [data-spike] {
    /* Without color-scheme set, light-dark() always resolves to the light value. */
    color-scheme: light dark;

    /* Surface */
    --color-surface-base: light-dark(var(--color-neutral-0), var(--color-neutral-900));
    --color-surface-elevated: light-dark(var(--color-neutral-50), var(--color-neutral-800));
    --color-surface-hover: light-dark(var(--color-neutral-100), var(--color-neutral-750));
    --color-surface-active: light-dark(var(--color-neutral-200), var(--color-neutral-700));

    /* Text */
    --color-text-primary: light-dark(var(--color-neutral-900), var(--color-neutral-100));
    --color-text-secondary: light-dark(var(--color-neutral-700), var(--color-neutral-300));

    /* Primary intent */
    --color-primary: light-dark(var(--color-primary-600), var(--color-primary-500));
    --color-primary-hover: light-dark(var(--color-primary-700), var(--color-primary-400));
    --color-primary-active: light-dark(var(--color-primary-800), var(--color-primary-300));
    --color-primary-subtle: light-dark(var(--color-primary-50), var(--color-primary-900));
    --color-primary-emphasis: light-dark(var(--color-primary-900), var(--color-primary-200));

    /* Feedback intents */
    --color-success: light-dark(var(--color-success-500), var(--color-success-400));
    --color-danger: light-dark(var(--color-danger-500), var(--color-danger-400));
    --color-warning: light-dark(var(--color-warning-500), var(--color-warning-400));
    --color-info: light-dark(var(--color-info-500), var(--color-info-400));

    background: var(--color-surface-base);
    color: var(--color-text-primary);
    min-height: 100vh;
    padding: 2rem;
    font-family: var(--font-sans, system-ui, sans-serif);
  }

  [data-spike][data-mode='light'] {
    color-scheme: light;
  }
  [data-spike][data-mode='dark'] {
    color-scheme: dark;
  }

  [data-spike] header {
    max-width: 70ch;
    margin: 0 0 2rem;
  }

  [data-spike] h1 {
    margin-top: 0;
    font-size: 1.5rem;
  }

  [data-spike] h2 {
    margin: 2rem 0 1rem;
    font-size: 1.125rem;
  }

  [data-spike] .note {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
  }

  [data-spike] fieldset {
    display: inline-flex;
    align-items: center;
    gap: 1rem;
    border: 1px solid var(--color-text-secondary);
    border-radius: 0.5rem;
    padding: 0.5rem 1rem;
    margin-top: 1rem;
  }

  [data-spike] legend {
    padding: 0 0.5rem;
    font-size: 0.875rem;
  }

  [data-spike] label {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
  }

  [data-spike] table {
    width: 100%;
    max-width: 80ch;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  [data-spike] th,
  [data-spike] td {
    text-align: left;
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-text-secondary);
  }

  [data-spike] th {
    font-weight: 600;
  }

  [data-spike] code {
    font-family: ui-monospace, monospace;
    font-size: 0.8125rem;
  }

  [data-spike] .swatch {
    display: inline-block;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--color-text-secondary);
  }

  [data-spike] .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.75rem;
    max-width: 80ch;
  }

  [data-spike] .card {
    aspect-ratio: 2 / 1;
    border-radius: 0.5rem;
    padding: 0.75rem;
    display: flex;
    align-items: flex-end;
    border: 1px solid color-mix(in oklch, currentColor 25%, transparent);
  }

  [data-spike] .card-label {
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
    background: var(--color-surface-elevated);
    color: var(--color-text-primary);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }

  [data-spike] .combo {
    max-width: 80ch;
    padding: 1.5rem;
    border-radius: 0.5rem;
    background: var(--color-surface-elevated);
    color: var(--color-text-primary);
    border: 1px solid var(--color-primary-subtle);
  }
</style>
