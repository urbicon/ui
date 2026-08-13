<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { ChartFrame } from '@urbicon-ui/blocks';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'when-to-use', title: 'When to use' },
    { id: 'examples', title: 'Examples' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];

  // Demo data for the playground mark.

  // ChartFrame's substance is the `children` snippet, not its props — so the
  // generated code keeps the snippet (with a placeholder) rather than emitting a
  // misleading self-closing `<ChartFrame />` that would render nothing.
  function codeGenerator(vals: Record<string, unknown>): string {
    return `<ChartFrame
  height={${vals.height}}
  margin={{ left: ${vals.marginLeft}, bottom: ${vals.marginBottom} }}
  ariaLabel="Weekly values"
>
  {#snippet children({ innerWidth, innerHeight })}
    <!-- map your data onto innerWidth / innerHeight and draw SVG marks -->
  {/snippet}
</ChartFrame>`;
  }
</script>

<SeoMeta
  title="ChartFrame Component"
  description="Responsive SVG chart shell: it measures its width, applies plot margins, and hands the plot geometry to a child snippet. The building block under every cartesian chart."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="ChartFrame"
  description="Responsive SVG chart shell: it measures its width, applies plot margins, and hands the plot geometry to a child snippet. The building block under every cartesian chart."
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
    <Playground />
  </Section>

  <CustomDocs />

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { ChartFrame } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/chart-frame/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
