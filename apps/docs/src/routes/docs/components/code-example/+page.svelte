<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section,
    InfoCard,
    CodeExample as CodeExampleComponent,
    Note,
    NoteList,
    TypesReference
  } from '@urbicon-ui/docs';
  import { Button } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'usage', title: 'Usage Notes' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];

  const description =
    'Code example card with live preview, syntax highlighting, copy-to-clipboard, and a collapsible code panel.';
</script>

<SeoMeta title="CodeExample Component" {description} />

<DocsPageLayout
  title="CodeExample"
  {description}
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      componentName="CodeExample"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Basic Example' },
        {
          type: 'text',
          key: 'description',
          label: 'Description',
          defaultValue: 'Short explanation'
        },
        { type: 'text', key: 'code', label: 'Code', defaultValue: '<Button>Click</Button>' },
        { type: 'text', key: 'language', label: 'Language', defaultValue: 'svelte' },
        { type: 'checkbox', key: 'preview', label: 'Show Preview', defaultValue: true }
      ]}
      values={{
        title: 'Basic Example',
        description: 'Short explanation',
        code: '<Button>Click</Button>',
        language: 'svelte',
        preview: true
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <CodeExampleComponent
          title={values.title}
          description={values.description}
          code={values.code}
          language={values.language}
          preview={values.preview}
        >
          <Button>Click</Button>
        </CodeExampleComponent>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker
    id="usage"
    title="Usage Notes"
    subtitle="Best practices and important considerations"
    intent="default"
  >
    <div class="space-y-6">
      <InfoCard intent="info" title="Code is a prop, not the children">
        <p>
          The rendered snippet comes from the <code>code</code> prop — children are only the live
          preview. Either pass <code>code</code> explicitly, or set <code>isolate</code> so the
          <code>codeExamplePlugin</code> Vite plugin (from <code>@urbicon-ui/docs/vite</code>)
          extracts the children markup as <code>code</code> at build time. Without either, a warning placeholder
          renders instead of the code panel.
        </p>
      </InfoCard>

      <InfoCard intent="neutral" title="Collapsing follows the page toggle">
        <p>
          The code panel follows the page-wide code-visibility toggle provided by
          <code>DocsLayout</code>. Use <code>defaultExpanded</code> to override the initial state for
          a single example — readers can still toggle it locally.
        </p>
      </InfoCard>
    </div>
  </Section>

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Preview and code are one figure, two regions">
        <p>
          The preview stage and the code panel are separate regions, each named from the example's
          <code>title</code>, so a screen-reader user can tell which of the two they have landed in
          rather than hearing the same name twice.
        </p>
      </Note>
      <Note title="Nothing is preview-only">
        <p>
          Whatever the preview renders is also in the code panel, so a reader who cannot use the
          visual preview still gets the whole example. This is why <code>isolate</code> exists: it extracts
          the children as the snippet at build time instead of letting the two drift.
        </p>
      </Note>
      <Note title="The collapse is a button, not a heading">
        <p>
          Expanding the code panel is an ordinary button with <code>aria-expanded</code>, in the tab
          order, with a visible focus ring. The example title above it stays a heading, so the page
          outline does not change when a panel is folded.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section
    marker
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker id="installation" title="Installation">
    <CodeExampleComponent
      title="Import"
      code={`import { CodeExample } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/code-example/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
