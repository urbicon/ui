<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'store-api', title: 'Store API' },
    { id: 'customization', title: 'Customization' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];

  // Der `<Toaster />` steht jetzt im Playground (mit dessen `placement`-Regler
  // verdrahtet), damit er in jede Einbettung mitreist — der Landing-Hero hatte
  // sonst einen Knopf ohne Wirkung. Der frühere Seiten-`placement`-Zustand ist
  // damit weg: Er hing an keinem Regler und war nie umschaltbar.
</script>

<SeoMeta
  title="Toast Component"
  description="Non-blocking notifications triggered via a global store. Supports intents, auto-dismiss, progress bars, and custom placements."
/>

<DocsPageLayout
  title="Toast"
  description="Non-blocking notifications triggered via a global store. Supports intents, auto-dismiss, progress bars, and custom placements."
  maxWidth="2xl"
  showToc={true}
  {navigation}
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

  <Section
    marker="05"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <Section marker="06" id="types" title="Types">
    <!-- The wrapping Section owns `types` — that is the TOC anchor. The
         component renders its own `id="types"` by default (it is one half of
         the anchor pair ApiReference jumps to), so on this page, the only one
         that nests the two, it needs its own. -->
    <TypesReference
      id="types-table"
      types={componentData?.types ?? []}
      title="Store & Type Definitions"
      description="Types for the toaster store API. ToastInput defines what you pass to toaster.add(), the shorthand methods accept ToastShorthandOpts."
    />
  </Section>

  <Section marker="07" id="installation" title="Installation">
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
      href={asset('/blocks/primitives/toast/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
