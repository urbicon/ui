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
  import { ChartFrame } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'when-to-use', title: 'When to use', order: 2 },
    { id: 'examples', title: 'Examples', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];

  // Demo data for the playground mark.
  const demo = [12, 18, 14, 22, 19, 26, 24];

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

<SeoMeta title="ChartFrame Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="ChartFrame"
  description="Responsive SVG chart shell — measures its width, applies plot margins, and hands the drawable plot geometry to a child snippet. The building block under every cartesian chart."
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
      {codeGenerator}
      componentName="ChartFrame"
      controls={[
        {
          type: 'number',
          key: 'height',
          label: 'Height',
          defaultValue: 200,
          min: 120,
          max: 360,
          step: 20
        },
        {
          type: 'number',
          key: 'marginLeft',
          label: 'Margin left',
          defaultValue: 40,
          min: 0,
          max: 80,
          step: 4
        },
        {
          type: 'number',
          key: 'marginBottom',
          label: 'Margin bottom',
          defaultValue: 28,
          min: 0,
          max: 60,
          step: 4
        }
      ]}
      values={{ height: 200, marginLeft: 40, marginBottom: 28 }}
    >
      {#snippet children(values)}
        <div class="w-full max-w-xl">
          <ChartFrame
            height={values.height}
            margin={{ left: values.marginLeft, bottom: values.marginBottom }}
            ariaLabel="Weekly values"
          >
            {#snippet children({ innerWidth, innerHeight })}
              {@const max = Math.max(...demo)}
              {@const pts = demo.map((v, i) => ({
                x: (i / (demo.length - 1)) * innerWidth,
                y: innerHeight - (v / max) * innerHeight
              }))}
              <!-- value axis + baseline make the margins visible -->
              <line x1="0" y1="0" x2="0" y2={innerHeight} class="stroke-border-subtle" />
              <line
                x1="0"
                y1={innerHeight}
                x2={innerWidth}
                y2={innerHeight}
                class="stroke-border-default"
              />
              <polyline
                points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                class="stroke-primary"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              {#each pts as p (p.x)}
                <circle cx={p.x} cy={p.y} r="3.5" class="fill-primary" />
              {/each}
            {/snippet}
          </ChartFrame>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { ChartFrame } from '@urbicon-ui/blocks';`}
      language="svelte"
      hasPreview={false}
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

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
