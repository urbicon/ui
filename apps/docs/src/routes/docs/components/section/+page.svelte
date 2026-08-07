<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    PlaygroundConfigurator,
    Section as SectionComponent,
    TypesReference,
    InfoCard
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
    'Anchored content section with an editorial marker, title, subtitle and badges — the grid every documentation page is built on.';
</script>

<SeoMeta title="Section Component" {description} />

<DocsPageLayout
  title="Section"
  {description}
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <SectionComponent id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Section"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Playground Section' },
        {
          type: 'text',
          key: 'subtitle',
          label: 'Subtitle',
          defaultValue: 'Try different options'
        },
        {
          type: 'dropdown',
          key: 'headingLevel',
          label: 'Heading Level',
          items: [1, 2, 3, 4, 5, 6].map((n) => ({ label: String(n), value: n })),
          defaultValue: 2
        },
        { type: 'checkbox', key: 'centered', label: 'Centered', defaultValue: false },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: ['default', 'hero', 'primary', 'secondary'].map((v) => ({ label: v, value: v })),
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: ['sm', 'md', 'lg', 'xl'].map((v) => ({ label: v, value: v })),
          defaultValue: 'lg'
        },
        { type: 'checkbox', key: 'showBadges', label: 'Show Badges', defaultValue: true }
      ]}
      values={{
        title: 'Playground Section',
        subtitle: 'Try different options',
        headingLevel: 2,
        centered: false,
        intent: 'default',
        size: 'lg',
        showBadges: true
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <SectionComponent
          id="demo"
          title={values.title}
          subtitle={values.subtitle}
          headingLevel={values.headingLevel}
          centered={values.centered}
          intent={values.intent}
          size={values.size}
          badges={values.showBadges
            ? [{ text: 'New', variant: 'soft', intent: 'primary' }]
            : undefined}
        >
          <div class="text-text-secondary text-sm">
            Sections compose docs pages with consistent spacing and headings.
          </div>
          {#snippet footerSnippet()}
            <InfoCard intent="neutral" title="Tip" size="sm"
              >Use intents to visually separate content blocks.</InfoCard
            >
          {/snippet}
        </SectionComponent>
      {/snippet}
    </PlaygroundConfigurator>
  </SectionComponent>

  <CustomDocs />

  <SectionComponent marker id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Only a titled section is a region">
        <p>
          The element is always <code>&lt;section&gt;</code>, but a browser exposes it as a region
          landmark only once it has an accessible name — so the component points
          <code>aria-labelledby</code> at the heading it rendered, and omits the attribute entirely when
          there is no heading to point at. A section carrying only a subtitle or badges is a container,
          not a landmark, which is the honest answer: an unnamed region is a stop that announces nothing.
        </p>
      </Note>
      <Note title="Choose the level, not the size">
        <p>
          <code>headingLevel</code> sets the tag; <code>intent</code> sets the look. They are
          separate on purpose: a subsection that needs <code>h3</code> semantics can still carry the
          <code>primary</code> type scale, and nothing forces an author to break the outline to get the
          size they want. Out-of-range levels are clamped to 1–6.
        </p>
      </Note>
      <Note title="titleHidden keeps the heading, hides the header">
        <p>
          A playground stage does not need a visible "Playground" heading, but its table-of-contents
          entry still has to lead somewhere. <code>titleHidden</code> moves the whole header into the
          screen-reader layer, so the heading stays in the outline and the section keeps its name. Do
          not use it to quiet a section that simply has no title yet.
        </p>
      </Note>
      <Note title="The marker is editorial">
        <p>
          It renders as decorative text and is not part of the heading, so a screen reader announces
          "Examples", not "01 Examples". Nothing reads it back — the numbering is for the eye.
        </p>
      </Note>
      <Note title="The page counts, not you">
        <p>
          Write <code>marker</code> without a value and the section takes the next number in its page.
          Insert a section and everything after it renumbers itself; a section nested inside another never
          takes a number, so a demo inside a stage stays unstamped. A string still wins where a page numbers
          by hand.
        </p>
      </Note>
    </NoteList>
  </SectionComponent>

  <SectionComponent
    marker
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </SectionComponent>

  <TypesReference types={componentData?.types ?? []} />

  <SectionComponent marker id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Section } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </SectionComponent>

  <div class="mt-6 w-full text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/section/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
