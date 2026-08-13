<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { CurrencyInput, centsToMajor, majorToCents } from '@urbicon-ui/blocks';

  let priceCents = $state(1234_56);

  let usdCents = $state(99_00);

  let jpyValue = $state(15_000);

  // Imagine these arrived as major-unit floats from an API.
  const apiAmount = 1234.56;
  let majorBackedCents = $state(majorToCents(apiAmount));
  const exportedAsMajor = $derived(centsToMajor(majorBackedCents));
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Follows the active locale"
      description="With no locale prop, grouping and decimal separators follow the active <I18nProvider> locale, applied on blur. The bound value stays an integer count of cents; the currency symbol is a fixed adornment."
      code={`<` +
        `script>
  import { CurrencyInput } from '@urbicon-ui/blocks';
  let priceCents = $state(1234_56); // grouped per the active locale
<` +
        `/script>
<CurrencyInput label="Price" bind:value={priceCents} />`}
      language="svelte"
    >
      <CurrencyInput label="Price" bind:value={priceCents} />
    </CodeExample>

    <CodeExample
      title="USD with prefix symbol"
      code={`<CurrencyInput
  label="Amount"
  bind:value={amountCents}
  locale="en-US"
  currency="USD"
  symbolPosition="prefix"
/>`}
      language="svelte"
    >
      <CurrencyInput
        label="Amount"
        bind:value={usdCents}
        locale="en-US"
        currency="USD"
        symbolPosition="prefix"
      />
    </CodeExample>

    <CodeExample
      title="JPY: zero decimal precision"
      description="Currencies like JPY have no minor units. Set precision={0} so the integer value is treated as-is."
      code={`<CurrencyInput
  bind:value={yen}
  locale="ja-JP"
  currency="JPY"
  precision={0}
/>`}
      language="svelte"
    >
      <CurrencyInput bind:value={jpyValue} locale="ja-JP" currency="JPY" precision={0} />
    </CodeExample>
  </div>
</Section>

<Section marker id="major-units" title="Working with major units">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      <code>CurrencyInput</code> stores values in <strong>minor units</strong> (cents) so summing,
      sorting, and persisting amounts stay free of floating-point drift. When integrating with an
      API or datastore that uses major-unit floats (e.g. <code>1234.56</code> for €1.234,56), use
      the exported <code>centsToMajor</code> / <code>majorToCents</code> helpers at the boundary, and
      keep the in-memory value in cents.
    </p>
  </div>

  <CodeExample
    title="Cents in, major units out"
    description="majorToCents on ingest, centsToMajor on export. The bound value stays in cents."
    code={`<script>
  import { CurrencyInput, centsToMajor, majorToCents } from '@urbicon-ui/blocks';

  // Major-unit float arrives from an external API.
  const apiAmount = 1234.56;
  let cents = $state(majorToCents(apiAmount)); // 123456
  const exportedAsMajor = $derived(centsToMajor(cents)); // 1234.56
<\/script>

<CurrencyInput label="Price" bind:value={cents} />
<p>Major: {exportedAsMajor}</p>`}
    language="svelte"
  >
    <CurrencyInput label="Price" bind:value={majorBackedCents} />
    <p class="text-text-secondary mt-2 text-sm">
      Stored as cents: <code>{majorBackedCents}</code> · Exported as major:
      <code>{exportedAsMajor}</code>
    </p>
  </CodeExample>

  <div class="text-text-secondary mt-4 space-y-3 text-sm leading-relaxed">
    <p>
      <strong>Float-precision caveat:</strong> a major-unit value that has already lost precision
      before reaching <code>majorToCents</code> (e.g. <code>0.1 + 0.2</code>) cannot be recovered.
      For values that must round-trip exactly across system boundaries, transport them as minor-unit
      integers (or as strings) instead of major-unit floats.
    </p>
  </div>
</Section>

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      <code>CurrencyInput</code> builds on <code>&lt;Input&gt;</code>, so its
      <code>InputProps</code> (label, helper, error, slotClasses, …) apply here too. The cents-based
      <code>value</code>, <code>locale</code>, <code>currency</code>,
      <code>symbolPosition</code>, and <code>precision</code> props add the locale-aware behaviour.
    </p>
    <p>
      Use <code>symbolPosition="none"</code> for headless numeric editing where you want the locale formatting
      (grouping / decimal separator) without the currency symbol.
    </p>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Inherited from Input">
      <p>
        Inherits <code>aria-invalid</code> / <code>aria-describedby</code> wiring from the
        underlying
        <code>&lt;Input&gt;</code> via the <code>label</code>, <code>error</code>, and
        <code>helper</code> props.
      </p>
    </Note>
    <Note title="Numeric keyboard">
      <p>
        Sets <code>inputmode="decimal"</code> so mobile keyboards open the numeric pad with a decimal
        separator.
      </p>
    </Note>
    <Note title="Raw value while focused">
      <p>
        While the field is focused it shows the raw typed value and formats on blur, so
        screen-reader users hear the number they typed.
      </p>
    </Note>
  </NoteList>
</Section>
