<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import { Sidebar } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'overview', title: 'Overview' },
    { id: 'playground', title: 'Playground' },
    { id: 'usage', title: 'When to use' },
    { id: 'examples', title: 'Examples' },
    { id: 'customization', title: 'Customization' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<SeoMeta
  title="Sidebar Component"
  description="Responsive sidebar navigation — permanent on desktop, overlay on mobile. Collapsible mode for toggleable sidebars at all viewports."
/>

<DocsPageLayout
  title="Sidebar"
  description="Sidebar primitive — fixed-position panel, permanent on desktop and overlay on mobile. Use directly for detail panels and custom shells. For a standard application chrome (left rail + mobile hamburger), use SidebarLayout."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  {navigation}
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
        <a class="text-primary hover:underline" href={resolve('/blocks/components/sidebar-layout')}
          >SidebarLayout</a
        >. It wraps this primitive and resolves the CSS-variable scoping that otherwise leaves your
        main content underneath the sidebar.
      </p>
      <p class="text-text-secondary mt-2 text-sm leading-relaxed">
        Use the <code class="text-text-primary">Sidebar</code> primitive directly for right-side detail
        panels, custom shells, or any sidebar that opens as an overlay on click.
      </p>
    </div>
  </Section>
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

  <TypesReference types={componentData?.types ?? []} />

  <Section marker="06" id="installation" title="Installation">
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
      href={asset('/blocks/primitives/sidebar/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
