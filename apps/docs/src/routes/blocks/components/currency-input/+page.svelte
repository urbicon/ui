<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { CurrencyInput } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];
</script>

<SeoMeta
  title="CurrencyInput Component"
  description="Locale-aware monetary input that stores values in minor units (cents)."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="CurrencyInput"
  description="Locale-aware monetary input that stores values in minor units (cents). Raw editing on focus, formatted display with currency symbol on blur."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      showHeader={false}
      {propDocs}
      {variantKeys}
      componentName="CurrencyInput"
      controls={[
        { type: 'text', key: 'label', label: 'Label', defaultValue: 'Price' },
        {
          type: 'dropdown',
          key: 'locale',
          label: 'Locale',
          items: [
            { label: 'de-DE', value: 'de-DE' },
            { label: 'en-US', value: 'en-US' },
            { label: 'ja-JP', value: 'ja-JP' }
          ],
          defaultValue: 'de-DE'
        },
        {
          type: 'dropdown',
          key: 'currency',
          label: 'Currency',
          items: [
            { label: 'EUR', value: 'EUR' },
            { label: 'USD', value: 'USD' },
            { label: 'GBP', value: 'GBP' },
            { label: 'JPY', value: 'JPY' }
          ],
          defaultValue: 'EUR'
        },
        {
          type: 'dropdown',
          key: 'symbolPosition',
          label: 'Symbol Position',
          items: [
            { label: 'suffix', value: 'suffix' },
            { label: 'prefix', value: 'prefix' },
            { label: 'none', value: 'none' }
          ],
          defaultValue: 'suffix'
        }
      ]}
      values={{ label: 'Price', locale: 'de-DE', currency: 'EUR', symbolPosition: 'suffix' }}
    >
      {#snippet children(values)}
        <CurrencyInput {...values} value={1234_56} />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="05"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="06" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { CurrencyInput } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/currency-input/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
