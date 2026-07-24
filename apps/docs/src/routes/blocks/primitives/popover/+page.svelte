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
  import { Popover } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'usage', title: 'When to use', order: 2 },
    { id: 'examples', title: 'Examples', order: 3 },
    { id: 'customization', title: 'Customization', order: 4 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];
</script>

<SeoMeta
  title="Popover Component"
  description="Floating content panel anchored to a trigger with precise positioning, portal rendering, and size syncing."
/>

<DocsPageLayout
  title="Popover"
  description="Floating content panel anchored to a trigger with precise positioning, portal rendering, and size syncing."
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
      componentName="Popover"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'placement',
          label: 'Placement',
          items: [
            { label: 'top', value: 'top' },
            { label: 'top-start', value: 'top-start' },
            { label: 'top-end', value: 'top-end' },
            { label: 'bottom', value: 'bottom' },
            { label: 'bottom-start', value: 'bottom-start' },
            { label: 'bottom-end', value: 'bottom-end' },
            { label: 'left', value: 'left' },
            { label: 'right', value: 'right' }
          ],
          defaultValue: 'bottom-start'
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
          key: 'offsetDistance',
          label: 'Offset',
          min: 0,
          max: 24,
          step: 2,
          defaultValue: 4
        },
        { type: 'checkbox', key: 'syncWidth', label: 'Sync Width', defaultValue: false }
      ]}
      values={{
        placement: 'bottom-start',
        size: 'md',
        offsetDistance: 4,
        syncWidth: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Popover
          placement={values.placement}
          size={values.size}
          offsetDistance={values.offsetDistance}
          syncWidth={values.syncWidth}
        >
          {#snippet trigger()}
            <div
              class="bg-surface-base border-border-default hover:border-border-emphasis flex w-80 cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors"
            >
              <span class="text-text-secondary">Choose an option…</span>
              <svg class="text-text-tertiary h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clip-rule="evenodd"
                />
              </svg>
            </div>
          {/snippet}

          <div class="divide-border-subtle divide-y">
            {#each ['Design tokens', 'Component variants', 'Documentation'] as option (option)}
              <div
                class="text-text-primary hover:bg-surface-hover cursor-pointer px-3 py-2 transition-colors first:rounded-t-md last:rounded-b-md"
              >
                {option}
              </div>
            {/each}
          </div>
        </Popover>
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
      code={`import { Popover } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/popover/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
