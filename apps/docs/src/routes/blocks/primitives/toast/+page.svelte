<script lang="ts">
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

  // Der `<Toaster />` steht jetzt im Playground (mit dessen `placement`-Regler
  // verdrahtet), damit er in jede Einbettung mitreist — der Landing-Hero hatte
  // sonst einen Knopf ohne Wirkung. Der frühere Seiten-`placement`-Zustand ist
  // damit weg: Er hing an keinem Regler und war nie umschaltbar.
</script>

<SeoMeta
  title="Toast Component"
  description="Non-blocking notifications triggered via a global store."
/>

<DocsPageLayout
  title="Toast"
  description="Non-blocking notifications triggered via a global store."
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

  <ReferenceSections
    {componentData}
    typesDescription="Types for the toaster store API. ToastInput defines what you pass to toaster.add(). The shorthand methods accept ToastShorthandOpts."
  />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Toaster, toaster } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('blocks/primitives/toast/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
