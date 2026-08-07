<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    PlaygroundConfigurator,
    Section,
    TableOfContents as Toc,
    TypesReference
  } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];

  const description =
    'Sticky sidebar navigation that tracks scroll position and highlights the active section. Hidden on mobile — DocsLayout provides the collapsible alternative there.';
</script>

<SeoMeta title="TableOfContents Component" {description} />

<DocsPageLayout
  title="TableOfContents"
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
      componentName="TableOfContents"
      controls={[
        {
          type: 'dropdown',
          key: 'position',
          label: 'Position',
          items: [
            { label: 'left', value: 'left' },
            { label: 'right', value: 'right' }
          ],
          defaultValue: 'right'
        },
        {
          type: 'dropdown',
          key: 'width',
          label: 'Width',
          items: ['sm', 'md', 'lg'].map((v) => ({ label: v, value: v })),
          defaultValue: 'md'
        },
        { type: 'checkbox', key: 'trackScroll', label: 'Track Scroll', defaultValue: true }
      ]}
      values={{ position: 'right', width: 'md', trackScroll: true }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
          <div class="space-y-24">
            <Section id="intro" title="Introduction">Content</Section>
            <Section id="setup" title="Setup">Content</Section>
            <Section id="usage" title="Usage">Content</Section>
          </div>
          <Toc
            position={values.position}
            width={values.width}
            trackScroll={values.trackScroll}
            navigation={[
              { id: 'intro', title: 'Introduction' },
              { id: 'setup', title: 'Setup' },
              { id: 'usage', title: 'Usage' }
            ]}
          />
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Named landmarks, because there are several">
        <p>
          The component renders an <code>&lt;aside&gt;</code> holding one to three
          <code>&lt;nav&gt;</code> elements — sections, related pages, and the code toggle block. Every
          one of them is labelled, because a documentation page already carries a handful of asides and
          navigations and an unnamed one is a stop that announces nothing.
        </p>
      </Note>
      <Note title="aria-current is location, not page">
        <p>
          The active entry points at a section of the page the reader is already on, so it carries
          <code>aria-current="location"</code>. <code>page</code> would claim it links to the current
          document, which is what the sidebar's entry for this page does.
        </p>
      </Note>
      <Note title="Scroll-spy marks, it does not move focus">
        <p>
          Scrolling only changes which entry is marked. Focus stays where the reader left it — the
          alternative, dragging focus along with the scroll position, would make the page unusable
          with a keyboard.
        </p>
      </Note>
      <Note title="Only the kickers are tagged with a language">
        <p>
          "On this page", "Related" and the toggle label come from the docs translations and carry a <code
            >lang</code
          > of their own; the entry labels do not, because they are the page's section titles and are
          written in the content language. Tagging the whole aside would declare those titles as the chrome
          locale — a worse mismatch than the three kicker words it would fix.
        </p>
      </Note>
      <Note title="Hidden below the sidebar breakpoint">
        <p>
          The component is display-hidden on narrow viewports rather than reflowed, so it is out of
          the reading order there as well as out of sight. <code>DocsLayout</code> renders its own collapsible
          table of contents for that case — a page that uses this component standalone has to provide
          the small-screen path itself.
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
    <CodeExample
      title="Import"
      code={`import { TableOfContents } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/table-of-contents/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
