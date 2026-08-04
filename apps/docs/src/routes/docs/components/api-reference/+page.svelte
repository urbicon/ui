<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference as ApiReferenceComponent,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'examples', title: 'Examples' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];

  const description =
    'Structured API reference table — renders prop names, types, defaults, and descriptions with source and required badges.';
</script>

<SeoMeta title="ApiReference Component" {description} />

<DocsPageLayout
  title="ApiReference"
  {description}
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <CustomDocs />

  <Section marker="02" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="It is a table, and it says so">
        <p>
          The props render through <code>@urbicon-ui/table</code>, so the browser exposes real rows
          and columns: a screen reader announces "row 4 of 26, column Type" instead of reading a
          wall of divs. Sorting a column updates <code>aria-sort</code> on its header.
        </p>
      </Note>
      <Note title="Badges are not the only signal">
        <p>
          Required props and their source are marked with a badge <em>and</em> with text in the badge,
          never with colour alone — the required marker reads "required", not a red dot.
        </p>
      </Note>
      <Note title="Type cross-links">
        <p>
          A type that resolves to a local definition renders as a link into the Types section on the
          same page. It is an ordinary in-page anchor, so it works with the keyboard and appears in
          the link list a screen reader can bring up.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section marker="03" id="api" title="API Reference" intent="secondary">
    <ApiReferenceComponent props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker="04" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { ApiReference } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/api-reference/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
