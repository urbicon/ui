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
  import { PinInput } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'two-factor', title: 'Two-factor / OTP', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];
</script>

<SeoMeta
  title="PinInput Component"
  description="Segmented one-time-code / PIN entry with auto-advance, paste-to-fill, and optional masking."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="PinInput"
  description="Segmented one-time-code / PIN entry — a row of single-character cells with auto-advance, backspace-to-previous, paste-to-fill, and optional masking. Purpose-built for the 2FA/OTP flow."
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
      componentName="PinInput"
      controls={[
        {
          type: 'dropdown',
          key: 'length',
          label: 'Length',
          items: [
            { label: '4', value: 4 },
            { label: '6', value: 6 },
            { label: '8', value: 8 }
          ],
          defaultValue: 6
        },
        {
          type: 'dropdown',
          key: 'type',
          label: 'Type',
          items: [
            { label: 'numeric', value: 'numeric' },
            { label: 'alphanumeric', value: 'alphanumeric' }
          ],
          defaultValue: 'numeric'
        },
        { type: 'boolean', key: 'mask', label: 'Mask', defaultValue: false },
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
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'outlined', value: 'outlined' },
            { label: 'filled', value: 'filled' },
            { label: 'ghost', value: 'ghost' }
          ],
          defaultValue: 'outlined'
        }
      ]}
      values={{ length: 6, type: 'numeric', mask: false, size: 'md', variant: 'outlined' }}
    >
      {#snippet children(values)}
        <PinInput {...values} />
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
      code={`import { PinInput } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/pin-input/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
