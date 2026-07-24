<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { asset, resolve } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'overview', title: 'Overview', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'installation', title: 'Installation', order: 6 }
  ];
</script>

<SeoMeta
  title="SidebarLayout Component"
  description="App-shell layout that wires a Sidebar to a main content region with mobile header — solves CSS-variable scoping for content offset."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="SidebarLayout"
  description="App-shell layout for permanent-on-desktop / overlay-on-mobile sidebars. Wraps the Sidebar primitive, exposes --sidebar-width on the layout root so the main content offset works without boilerplate, and renders an optional mobile header with a hamburger opener."
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="overview" intent="primary">
    <p class="text-text-secondary text-sm leading-relaxed">
      The documentation site you are reading now is itself wrapped in
      <code class="text-text-primary">SidebarLayout</code>. Resize your viewport below 1024px to see
      the mobile hamburger header in action — the sidebar becomes a slide-in overlay with a
      backdrop, and the main column reflows to full width.
    </p>
    <p class="text-text-secondary mt-3 text-sm leading-relaxed">
      For non-shell sidebars (right-side detail panels, drawers inside a page), use the
      <a class="text-primary hover:underline" href={resolve('/blocks/primitives/sidebar')}
        >Sidebar primitive</a
      > directly.
    </p>
  </Section>

  <CustomDocs />

  <Section
    marker="05"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="06" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { SidebarLayout } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/sidebar-layout/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>
</DocsPageLayout>
