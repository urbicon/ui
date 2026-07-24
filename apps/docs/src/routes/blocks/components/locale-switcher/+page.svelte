<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { LocaleSwitcher } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { extractPlaygroundDocs } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];
</script>

<SeoMeta
  title="LocaleSwitcher Component"
  description="Language selector — a convenience wrapper around the Select primitive, powered by the i18n system with flag support and the Select styling axes."
/>

<DocsPageLayout
  title="LocaleSwitcher"
  description="Language selector — a convenience wrapper around the Select primitive, powered by the i18n system with flag support and the Select styling axes."
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="LocaleSwitcher"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'outlined', value: 'outlined' },
            { label: 'filled', value: 'filled' },
            { label: 'ghost', value: 'ghost' },
            { label: 'underline', value: 'underline' }
          ],
          defaultValue: 'outlined'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'sm'
        },
        { type: 'checkbox', key: 'showFlag', label: 'Show Flag', defaultValue: true },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{ variant: 'outlined', size: 'sm', showFlag: true, disabled: false }}
      showHeader={false}
    >
      {#snippet children(values)}
        <LocaleSwitcher {...values} />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.props?.length ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { LocaleSwitcher } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>
</DocsPageLayout>
