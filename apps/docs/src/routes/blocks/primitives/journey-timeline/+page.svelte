<script lang="ts">
  import { page } from '$app/state';
  import { asset, resolve } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { JourneyTimeline, type JourneyNode } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  // A utility-billing cockpit — the issue's driving consumer.
  const stages: JourneyNode[] = [
    { id: 'readings', title: 'Meter readings', status: 'complete', subtitle: 'Collected 3 Jun' },
    {
      id: 'allocate',
      title: 'Cost allocation',
      status: 'active',
      subtitle: 'Splitting shared costs'
    },
    { id: 'review', title: 'Review', status: 'pending', subtitle: 'Awaiting sign-off' },
    { id: 'dispatch', title: 'Dispatch', status: 'pending', subtitle: 'Send statements' }
  ];

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'statuses', title: 'Statuses', order: 3 },
    { id: 'scroll-spy', title: 'Scroll-spy', order: 4 },
    { id: 'customization', title: 'Customization', order: 5 },
    { id: 'accessibility', title: 'Accessibility', order: 6 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];

  function codeGenerator(vals: Record<string, unknown>): string {
    const defaults: Record<string, unknown> = { orientation: 'vertical', size: 'md' };
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
    <p>{item.subtitle}</p>
  {/snippet}
</JourneyTimeline>`;
  }
</script>

<SeoMeta
  title="JourneyTimeline Component"
  description="Connected timeline whose status-coloured markers are the progress indicator; exactly one focusable node expands to reveal rich per-step detail."
/>

<DocsPageLayout
  title="JourneyTimeline"
  description="A connected timeline whose status-coloured markers are the progress indicator, and where exactly one focusable node expands to reveal rich per-step detail — the DB-Navigator travel-log pattern. Reach for Stepper when you only need a compact progress indicator without a detail container."
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
      values={{ orientation: 'vertical', size: 'md' }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="w-full max-w-xl">
          <JourneyTimeline items={stages} orientation={values.orientation} size={values.size}>
            {#snippet node(item)}
              <p class="text-text-secondary text-sm">{item.subtitle}</p>
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

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
