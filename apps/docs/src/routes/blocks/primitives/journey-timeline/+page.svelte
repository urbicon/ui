<script lang="ts">
  import { asset, resolve } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { JourneyTimeline, type JourneyNode } from '@urbicon-ui/blocks';
  const relatedLinks = buildRelatedLinks(componentData);

  // A utility-billing run — the issue's driving consumer, as a chronicle.

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'statuses', title: 'Statuses', order: 3 },
    { id: 'when-to-use', title: 'vs. Stepper / Tab', order: 4 },
    { id: 'customization', title: 'Customization', order: 5 },
    { id: 'accessibility', title: 'Accessibility', order: 6 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = {
      orientation: 'vertical',
      size: 'md',
      detail: 'inline'
    };
    const props = Object.entries(vals)
      .filter(([key, value]) => {
        if (value === null || value === undefined) return false;
        if (key in defaults && value === defaults[key]) return false;
        if (value === false) return false;
        return true;
      })
      .map(([key, value]) => (typeof value === 'boolean' ? key : `${key}="${value}"`));
    const propsStr = props.length > 0 ? ` ${props.join(' ')}` : '';
    return `<JourneyTimeline {items}${propsStr} bind:focusId>
  {#snippet node(item)}
    <p>Full record for {item.title}…</p>
  {/snippet}
</JourneyTimeline>`;
  }
</script>

<SeoMeta
  title="JourneyTimeline Component"
  description="Retrospective chronicle timeline: one node in focus with rich detail, quiet context rows, a first-class time axis and meaning-bearing connectors."
/>

<DocsPageLayout
  title="JourneyTimeline"
  description="A retrospective chronicle (focus + context): an ordered record of what happened and where things stand — shipment tracking, audit trails, billing runs, travel logs. One node is in focus and shows rich detail inline or in a stable readout panel; the rest stay quiet context rows along a first-class time axis. Reach for Stepper for prospective wizards and Tab for peer views."
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
    <Playground />
  </Section>

  <CustomDocs />

  <Section
    marker="07"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="08" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { JourneyTimeline, type JourneyNode } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/journey-timeline/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
