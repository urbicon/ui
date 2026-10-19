<script lang="ts">
  import SeoMeta from '#lib/SeoMeta.svelte';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { Textarea } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta title="Textarea Component" description="A multi-line text field." />

<DocsPageLayout
  title="Textarea"
  description="A multi-line text field."
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
      code={`import { Textarea } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('blocks/primitives/textarea/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
