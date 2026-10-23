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
</script>

<SeoMeta
  title="Sidebar Component"
  description="Fixed-position side panel, permanent on desktop and overlay on mobile."
/>

<DocsPageLayout
  title="Sidebar"
  description="Fixed-position side panel, permanent on desktop and overlay on mobile."
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
  <Section id="overview" title="Overview" titleHidden>
    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-5">
      <h2 class="text-text-primary text-sm font-semibold">Looking for an app shell?</h2>
      <p class="text-text-secondary mt-1.5 text-sm leading-relaxed">
        For the common pattern of a permanent left sidebar with a mobile hamburger and an offset
        main content area, prefer
        <a href={resolve('/blocks/components/sidebar-layout')}>SidebarLayout</a>. It wraps this
        primitive and resolves the CSS-variable scoping that otherwise leaves your main content
        underneath the sidebar.
      </p>
    </div>
  </Section>
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <CustomDocs />

  <ReferenceSections {componentData} />

  <Section marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Sidebar } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('blocks/primitives/sidebar/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
