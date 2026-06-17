<script lang="ts">
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  // import { ComponentName } from '@urbicon-ui/blocks';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import SeoMeta from '$lib/SeoMeta.svelte';
  // import CustomDocs from './Docs.svelte';
  // import { componentData } from './api';
  // import { buildRelatedLinks } from '$lib/component-links';

  // const relatedLinks = buildRelatedLinks(componentData);
  import { asset, resolve } from '$app/paths';
  import { page } from '$app/state';

  const COMPONENT_NAME = 'ComponentName';
  const COMPONENT_SLUG = 'component-name';
  const COMPONENT_DESC = 'Short, descriptive summary of the component.';

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'accessibility', title: 'Accessibility', order: 5 },
    { id: 'api', title: 'API Reference', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];
</script>

<SeoMeta title={`${COMPONENT_NAME} Component`} description={COMPONENT_DESC} />

<DocsPageLayout
  title={COMPONENT_NAME}
  description={COMPONENT_DESC}
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName={COMPONENT_NAME}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [{ label: 'filled', value: 'filled' }],
          defaultValue: 'filled'
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
        }
      ]}
      values={{ variant: 'filled', size: 'md' }}
      showHeader={false}
    >
      {#snippet children(_values: Record<string, unknown>)}
        <!-- Replace with actual component -->
        <div
          class="border-border-subtle text-text-secondary rounded-md border border-dashed px-4 py-2"
        >
          {COMPONENT_NAME} Preview
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <!-- Uncomment when Docs.svelte is created -->
  <!-- <CustomDocs /> -->

  <!-- Uncomment when api.ts is generated -->
  <!--
  <Section id="api" title="API Reference" intent="secondary" meta={`${componentData?.stats?.totalProps ?? 0} props`}>
    <ApiReference props={componentData?.props ?? []} />
  </Section>
  -->

  <Section id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { ${COMPONENT_NAME} } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset(`/blocks/primitives/${COMPONENT_SLUG}/llm.txt`)}
      rel="noopener">llm.txt</a
    >
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
