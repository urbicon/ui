<script lang="ts">
  import SeoMeta from '#lib/SeoMeta.svelte';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    ReferenceSections,
    Section
  } from '@urbicon-ui/docs';
  import { LocaleSwitcher } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '#lib/component-links.js';
  import { extractPlaygroundDocs } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);
</script>

<SeoMeta
  title="LocaleSwitcher Component"
  description="Dropdown for switching the application's display language."
/>

<DocsPageLayout
  title="LocaleSwitcher"
  description="Dropdown for switching the application's display language."
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
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
      code={`import { LocaleSwitcher } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>
</DocsPageLayout>
