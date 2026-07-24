<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { Combobox } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'async-search', title: 'Async Search', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];

  const demoOptions = [
    { label: 'United States', value: 'us' },
    { label: 'United Kingdom', value: 'uk' },
    { label: 'Germany', value: 'de' },
    { label: 'France', value: 'fr' },
    { label: 'Japan', value: 'jp' },
    { label: 'Australia', value: 'au' },
    { label: 'Canada', value: 'ca' },
    { label: 'Brazil', value: 'br' }
  ];
</script>

<SeoMeta
  title="Combobox Component"
  description="Searchable autocomplete input with keyboard navigation and custom filtering."
/>

<DocsPageLayout
  title="Combobox"
  description="Searchable autocomplete input with keyboard navigation and custom filtering."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Combobox"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'tier',
          label: 'Tier',
          items: [
            { label: 'modify (soft)', value: 'modify' },
            { label: 'commit (pill)', value: 'commit' }
          ],
          defaultValue: 'modify'
        },
        {
          type: 'text',
          key: 'placeholder',
          label: 'Placeholder',
          defaultValue: 'Search countries…'
        },
        {
          type: 'text',
          key: 'noResultsText',
          label: 'No Results Text',
          defaultValue: 'No results found'
        },
        { type: 'checkbox', key: 'clearable', label: 'Clearable', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        size: 'md',
        tier: 'modify',
        placeholder: 'Search countries…',
        noResultsText: 'No results found',
        clearable: false,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="w-64">
          <Combobox
            options={demoOptions}
            size={values.size}
            tier={values.tier}
            aria-label="Country"
            placeholder={values.placeholder || undefined}
            noResultsText={values.noResultsText || undefined}
            clearable={values.clearable}
            disabled={values.disabled}
          />
        </div>
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
      code={`import { Combobox } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/combobox/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
