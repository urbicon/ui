<script lang="ts">
  import { type JourneyNode, JourneyTimeline } from '@urbicon-ui/blocks';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { asset, resolve } from '$app/paths';
  import { componentData } from './api';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';

  const relatedLinks = buildRelatedLinks(componentData);

  // A utility-billing run — the issue's driving consumer, as a chronicle.

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
  description="A retrospective timeline that holds one event in focus with rich detail and keeps the rest as quiet context along a time axis."
/>

<DocsPageLayout
  title="JourneyTimeline"
  description="A retrospective timeline that holds one event in focus with rich detail and keeps the rest as quiet context along a time axis."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
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
      href={asset('blocks/primitives/journey-timeline/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
