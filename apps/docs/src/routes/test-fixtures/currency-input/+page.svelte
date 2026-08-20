<script lang="ts">
  // E2E fixture for the CurrencyInput mask (e2e/currency-input.spec.ts). What the
  // field owes the user is *where the caret ends up* after a keystroke, and no
  // jsdom run can answer that: jsdom has no key handling at all, so the tests
  // there have to hand-write the text edit they think a browser performs. Only a
  // real browser produces the edit and the caret together. The <output> mirrors
  // the bound cents so the spec can separate "the text looks right" from "the
  // amount is right" — the two came apart in the reported defect, where deleting
  // the decimal separator left the display intact and multiplied the value.
  import { CurrencyInput } from '@urbicon-ui/blocks';

  let priceCents = $state<number | null>(1234_56);
  let yen = $state<number | null>(15_000);
</script>

<svelte:head>
  <title>CurrencyInput Test Fixtures</title>
</svelte:head>

<div class="bg-surface-base min-h-screen p-8" data-testid="currency-input-fixtures">
  <h1 class="text-text-primary mb-6 text-xl font-bold">CurrencyInput fixtures</h1>

  <div class="max-w-xs space-y-8">
    <div data-testid="ci-de">
      <CurrencyInput label="Preis" bind:value={priceCents} locale="de-DE" />
      <output class="text-text-secondary text-sm" data-testid="ci-de-value">{priceCents}</output>
    </div>

    <div data-testid="ci-jpy">
      <CurrencyInput label="Yen" bind:value={yen} locale="ja-JP" currency="JPY" precision={0} />
      <output class="text-text-secondary text-sm" data-testid="ci-jpy-value">{yen}</output>
    </div>
  </div>
</div>
