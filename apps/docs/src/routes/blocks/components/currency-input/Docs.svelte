<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { CurrencyInput, centsToMajor, majorToCents } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: true, order: 1 },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: { include: true },
    meta: { title: 'CurrencyInput Component', showToc: true }
  };

  let priceCents = $state(1234_56);

  let usdCents = $state(99_00);

  let jpyValue = $state(15_000);

  let autoLocaleCents = $state(1234_56);

  // Imagine these arrived as major-unit floats from an API.
  const apiAmount = 1234.56;
  let majorBackedCents = $state(majorToCents(apiAmount));
  const exportedAsMajor = $derived(centsToMajor(majorBackedCents));
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Default — Euro with German locale"
      description="Cents are stored as integers; the € symbol is a static adornment, locale grouping (1.234,56) is applied on blur."
      code={`<` +
        `script>
  let priceCents = $state(1234_56); // 1.234,56 €
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
      title="JPY — zero decimal precision"
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

    <CodeExample
      title={`Auto locale — defers to the runtime (${new Intl.NumberFormat().resolvedOptions().locale})`}
      description="Pass locale='auto' to format using the user's browser language. Currency stays explicit, since locale and currency are orthogonal."
      code={`<CurrencyInput
  label="Price"
  bind:value={priceCents}
  locale="auto"
  currency="EUR"
/>`}
      language="svelte"
    >
      <CurrencyInput label="Price" bind:value={autoLocaleCents} locale="auto" currency="EUR" />
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="major-units" title="Working with major units">
  <div class="prose prose-sm max-w-none">
    <p>
      <code>CurrencyInput</code> stores values in <strong>minor units</strong> (cents) so summing,
      sorting, and persisting amounts stay free of floating-point drift. When integrating with an
      API or datastore that uses major-unit floats (e.g. <code>1234.56</code> for €1.234,56), use
      the exported <code>centsToMajor</code> / <code>majorToCents</code> helpers at the boundary — and
      keep the in-memory representation in cents.
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
&lt;/script&gt;

<CurrencyInput label="Price" bind:value={cents} />
&lt;p&gt;Major: &#123;exportedAsMajor&#125;&lt;/p&gt;`}
    language="svelte"
  >
    <CurrencyInput label="Price" bind:value={majorBackedCents} />
    <p class="text-text-secondary mt-2 text-sm">
      Stored as cents: <code>{majorBackedCents}</code> · Exported as major:
      <code>{exportedAsMajor}</code>
    </p>
  </CodeExample>

  <div class="prose prose-sm mt-4 max-w-none">
    <p>
      <strong>Float-precision caveat:</strong> a major-unit value that has already lost precision
      before reaching <code>majorToCents</code> (e.g. <code>0.1 + 0.2</code>) cannot be recovered.
      For values that must round-trip exactly across system boundaries, transport them as minor-unit
      integers (or as strings) instead of major-unit floats.
    </p>
  </div>
</Section>

<Section marker="03" id="customization" title="Customization">
  <div class="prose prose-sm max-w-none">
    <p>
      <code>CurrencyInput</code> wraps <code>&lt;Input&gt;</code>, so all
      <code>InputProps</code> (label, helper, error, slotClasses, …) flow through. The cents-based
      <code>value</code>, <code>locale</code>, <code>currency</code>,
      <code>symbolPosition</code>, and <code>precision</code> props add the locale-aware behaviour on
      top.
    </p>
    <p>
      Use <code>symbolPosition="none"</code> for headless numeric editing where you want the locale formatting
      (grouping / decimal separator) without the currency symbol.
    </p>
  </div>
</Section>

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="prose prose-sm max-w-none">
    <ul>
      <li>
        Inherits <code>aria-invalid</code> / <code>aria-describedby</code> wiring from the
        underlying
        <code>&lt;Input&gt;</code> via the <code>label</code>, <code>error</code>, and
        <code>helper</code> props.
      </li>
      <li>
        Sets <code>inputmode="decimal"</code> so mobile keyboards open the numeric pad with a decimal
        separator.
      </li>
      <li>
        Raw editing while focused — formatting happens on blur, so screen-reader users hear the
        unambiguous typed value.
      </li>
    </ul>
  </div>
</Section>
