<script lang="ts">
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { asset } from '$app/paths';
  import { componentData } from './api';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';

  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta
  title="Sankey Component"
  description="Flow diagram for multi-stage data: nodes split into layers, and links are sized to the values that flow between them."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="Sankey"
  description="Flow diagram for multi-stage data: nodes split into layers, and links are sized to the values that flow between them."
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
      code={`import { Sankey } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('blocks/components/sankey/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
