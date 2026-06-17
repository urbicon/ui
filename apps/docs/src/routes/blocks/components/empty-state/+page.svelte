<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { EmptyState, Button, InboxIcon, PlusIcon } from '@urbicon-ui/blocks';

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
  title="EmptyState Component"
  description="Centered placeholder block for no-data and no-results states."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="EmptyState"
  description="Centered placeholder block for 'no data yet' and 'no results' states. Pairs an icon with a heading, supporting text, and an optional CTA."
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
      componentName="EmptyState"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'No items yet' },
        {
          type: 'text',
          key: 'description',
          label: 'Description',
          defaultValue: 'Get started by adding the first item.'
        },
        {
          type: 'dropdown',
          key: 'density',
          label: 'Density',
          items: [
            { label: 'default', value: 'default' },
            { label: 'compact', value: 'compact' }
          ],
          defaultValue: 'default'
        }
      ]}
      values={{
        title: 'No items yet',
        description: 'Get started by adding the first item.',
        density: 'default'
      }}
    >
      {#snippet children(values)}
        <EmptyState
          title={String(values.title ?? '')}
          description={values.description as string | undefined}
          density={values.density as 'compact' | 'default' | undefined}
          icon={InboxIcon}
        >
          {#snippet cta()}
            <Button intent="primary">
              <PlusIcon />
              Add item
            </Button>
          {/snippet}
        </EmptyState>
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
      code={`import { EmptyState, BuildingIcon } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/empty-state/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
