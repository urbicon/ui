<script lang="ts">
  import { CodeExample, Section, InfoCard } from '@urbicon-ui/docs';
</script>

<Section marker id="examples" title="Examples" subtitle="Page-level layout, shown as code">
  <div class="flex flex-col gap-6">
    <InfoCard intent="info" title="Why there is no live preview">
      DocsLayout is a full-page layout — it renders the header, sticky table of contents, and
      scrollspy of the page you are reading right now. Nesting a second instance inside a page
      creates two competing scrollspies and hero bars, so the examples below are code-only.
    </InfoCard>

    <CodeExample
      title="Basic page"
      description="Title, description, and a ToC driven by the navigation array — each entry's id must match a Section id."
      language="svelte"
      preview={false}
      code={`<DocsLayout
  title="Badge"
  description="Status and labels"
  maxWidth="lg"
  showToc
  navigation={[
    { id: 'examples', title: 'Examples' },
    { id: 'api', title: 'API Reference' }
  ]}
>
  <Section id="examples" title="Examples">...</Section>
  <Section id="api" title="API Reference">...</Section>
</DocsLayout>`}
    />

    <CodeExample
      title="Collapsing hero with breadcrumbs"
      description="Passing breadcrumbs enables the sticky-bar pattern: crumbs + code toggle first, then a compact bar with title and scrollspy once the header scrolls away. stability and sourceHref render the editorial badge and source link."
      language="svelte"
      preview={false}
      code={`<DocsLayout
  title="Combobox"
  description="Searchable single-select input"
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Primitives', href: '/blocks/primitives' }
  ]}
  stability="stable"
  sourceHref="https://example.com/blob/main/Combobox.svelte"
  showToc
  navigation={nav}
>
  <Section id="playground" title="Playground">...</Section>
</DocsLayout>`}
    />
  </div>
</Section>
