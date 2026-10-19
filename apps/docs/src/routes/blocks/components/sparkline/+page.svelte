<script lang="ts">
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import { Sparkline } from '@urbicon-ui/blocks';
  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta
  title="Sparkline Component"
  description="Tiny inline trend line without axes, sized to fit in table cells, cards, or text."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="Sparkline"
  description="Tiny inline trend line without axes, sized to fit in table cells, cards, or text."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Sparkline } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('blocks/components/sparkline/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
