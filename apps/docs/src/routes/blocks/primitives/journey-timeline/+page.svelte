<script lang="ts">
  import { asset, resolve } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { JourneyTimeline, type JourneyNode } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  // A utility-billing run — the issue's driving consumer, as a chronicle.
  const stages: JourneyNode[] = [
    {
      id: 'readings',
      title: 'Meter readings',
      status: 'complete',
      subtitle: 'All units collected',
      meta: '3 Jun',
      segmentLabel: '2 days · validation'
    },
    {
      id: 'validate',
      title: 'Validation',
      status: 'complete',
      subtitle: 'Anomalies resolved',
      meta: '5 Jun',
      connector: 'dashed',
      segmentLabel: 'manual review'
    },
    {
      id: 'statements',
      title: 'Statements',
      status: 'active',
      subtitle: 'Generating documents',
      meta: '6 Jun'
    },
    { id: 'dispatch', title: 'Dispatch', status: 'pending', subtitle: 'Email + postal' }
  ];

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
    <PlaygroundConfigurator
      componentName="JourneyTimeline"
      {propDocs}
      {variantKeys}
      {codeGenerator}
      controls={[
        {
          type: 'dropdown',
          key: 'orientation',
          label: 'Orientation',
          items: [
            { label: 'vertical', value: 'vertical' },
            { label: 'horizontal', value: 'horizontal' }
          ],
          defaultValue: 'vertical'
        },
        {
          type: 'dropdown',
          key: 'detail',
          label: 'Detail',
          items: [
            { label: 'inline', value: 'inline' },
            { label: 'panel', value: 'panel' }
          ],
          defaultValue: 'inline'
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
      values={{ orientation: 'vertical', detail: 'inline', size: 'md' }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="w-full max-w-xl">
          <JourneyTimeline
            items={stages}
            orientation={values.orientation}
            detail={values.detail}
            size={values.size}
          >
            {#snippet node(item)}
              <p class="text-text-secondary text-sm">
                Full record for “{item.title}” renders here while the node is in focus.
              </p>
            {/snippet}
          </JourneyTimeline>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
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
