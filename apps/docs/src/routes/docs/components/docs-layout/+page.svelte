<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import Docs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'examples', title: 'Examples' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Type Definitions' },
    { id: 'installation', title: 'Installation' }
  ];

  const typesForTypesReference = componentData.types ?? [];

  const description =
    'Documentation page layout with header hero, sticky table of contents, scrollspy, and a responsive content column.';
</script>

<SeoMeta title="DocsLayout Component" {description} />

<DocsPageLayout
  title="DocsLayout"
  {description}
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Docs />

  <Section marker="02" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="The landmarks a page gets for free">
        <p>
          The layout renders the page's <code>&lt;main&gt;</code>, the table of contents as a named
          <code>&lt;nav&gt;</code>, and the breadcrumb strip as a second one. A page built on it
          therefore starts with a complete landmark set — which is why hand-rolling a breadcrumb row
          instead of passing <code>breadcrumbs</code> costs more than the sticky bar.
        </p>
      </Note>
      <Note title="Scroll-spy marks, it does not move focus">
        <p>
          Scrolling sets <code>aria-current="location"</code> on the active table-of-contents link and
          changes nothing else. Focus stays where the reader put it — dragging it along with the scroll
          position would make the page unusable with a keyboard.
        </p>
      </Note>
      <Note title="The collapsing hero keeps its heading">
        <p>
          When the header scrolls away the compact bar takes over visually, but the page's
          <code>&lt;h1&gt;</code> stays in the document — the bar is a second presentation of it, not
          a replacement. A screen reader still finds one, and only one, top-level heading.
        </p>
      </Note>
      <Note title="Reader-controlled code visibility">
        <p>
          The code toggle in the header is a real control with <code>aria-pressed</code>, and every
          <code>CodeExample</code> on the page follows it. Someone who reads code rather than previews
          sets it once instead of expanding each example.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section
    marker="03"
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} types={typesForTypesReference} />
  </Section>

  <TypesReference types={typesForTypesReference} />

  <Section marker="04" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { DocsLayout } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/docs-layout/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
