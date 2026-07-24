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
  import { Tooltip, Button } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

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
  title="Tooltip Component"
  description="Contextual hints that appear on hover or focus. Supports placement, intents, sizes, and custom delays."
/>

<DocsPageLayout
  title="Tooltip"
  description="Contextual hints that appear on hover or focus. Supports placement, intents, sizes, and custom delays."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Tooltip"
      {propDocs}
      {variantKeys}
      controls={[
        { type: 'text', key: 'label', label: 'Label', defaultValue: 'Helpful hint' },
        {
          type: 'dropdown',
          key: 'placement',
          label: 'Placement',
          items: [
            { label: 'top', value: 'top' },
            { label: 'top-start', value: 'top-start' },
            { label: 'top-end', value: 'top-end' },
            { label: 'bottom', value: 'bottom' },
            { label: 'left', value: 'left' },
            { label: 'right', value: 'right' }
          ],
          defaultValue: 'top'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'neutral', value: 'neutral' },
            { label: 'primary', value: 'primary' },
            { label: 'secondary', value: 'secondary' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' }
          ],
          defaultValue: 'neutral'
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
          defaultValue: 'md'
        },
        {
          type: 'slider',
          key: 'showDelay',
          label: 'Show Delay (ms)',
          min: 0,
          max: 1000,
          step: 50,
          defaultValue: 200
        },
        {
          type: 'slider',
          key: 'hideDelay',
          label: 'Hide Delay (ms)',
          min: 0,
          max: 500,
          step: 50,
          defaultValue: 100
        },
        { type: 'checkbox', key: 'arrow', label: 'Show Arrow', defaultValue: true },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        label: 'Helpful hint',
        placement: 'top',
        intent: 'neutral',
        size: 'md',
        showDelay: 200,
        hideDelay: 100,
        arrow: true,
        disabled: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Tooltip
          label={String(values.label ?? '')}
          placement={values.placement}
          intent={values.intent}
          size={values.size}
          showDelay={values.showDelay}
          hideDelay={values.hideDelay}
          arrow={values.arrow}
          disabled={values.disabled}
        >
          <Button variant="outlined" size="sm">Hover me</Button>
        </Tooltip>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Tooltip } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/tooltip/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
