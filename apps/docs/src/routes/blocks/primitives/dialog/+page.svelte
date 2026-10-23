<script lang="ts">
  import { Dialog } from '@urbicon-ui/blocks';
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
</script>

<SeoMeta
  title="Dialog Component"
  description="A modal overlay for a task the user must complete or dismiss before returning to the page. Built on the native <dialog> element."
/>

<DocsPageLayout
  title="Dialog"
  description="A modal overlay for a task the user must complete or dismiss before returning to the page. Built on the native <dialog> element."
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
>
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Dialog } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('blocks/primitives/dialog/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
