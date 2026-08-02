<script lang="ts">
  import { I18nProvider, type Locale } from '@urbicon-ui/i18n';
  import DateCell from '../DateCell.svelte';
  import NumberCell from '../NumberCell.svelte';

  /**
   * Renders one cell, optionally under an `<I18nProvider>`.
   *
   * The provider is the whole point: `locale` resolution runs through Svelte
   * context, so it cannot be exercised by calling `render()` on the cell
   * directly. Mirrors `packages/i18n/.../__fixtures__/SsrHarness.svelte`, and
   * like it lives in a `__fixtures__` folder that `files` keeps out of the
   * published tarball.
   */
  let {
    locale,
    cell,
    cellLocale
  }: {
    /** Provider locale; omitted renders the cell with no provider mounted. */
    locale?: Locale;
    cell: 'date' | 'number';
    /** The cell's own `locale` prop, when the test is about prop-over-provider. */
    cellLocale?: string;
  } = $props();

  const item = { id: 1, created: new Date('2026-03-12T10:30:00Z'), amount: 1234.56 };
</script>

{#snippet body()}
  {#if cell === 'date'}
    <DateCell {item} dateKey="created" locale={cellLocale} />
  {:else}
    <NumberCell {item} valueKey="amount" locale={cellLocale} />
  {/if}
{/snippet}

{#if locale}
  <I18nProvider {locale}>
    {@render body()}
  </I18nProvider>
{:else}
  {@render body()}
{/if}
