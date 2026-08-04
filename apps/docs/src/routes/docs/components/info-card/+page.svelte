<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section,
    InfoCard as InfoCardComponent,
    Note,
    NoteList,
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
    'Memo-style callout card for inline notes and tips, with intent accent colors and three sizes.';
</script>

<SeoMeta title="InfoCard Component" {description} />

<DocsPageLayout
  title="InfoCard"
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
      componentName="InfoCard"
      controls={[
        { type: 'text', key: 'title', label: 'Title', defaultValue: 'Success' },
        {
          type: 'text',
          key: 'children',
          label: 'Content',
          defaultValue: 'All systems operational'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            'info',
            'primary',
            'secondary',
            'success',
            'warning',
            'danger',
            'neutral',
            'example',
            'playground',
            'api'
          ].map((v) => ({ label: v, value: v })),
          defaultValue: 'success'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'lg'
        }
      ]}
      values={{
        title: 'Success',
        children: 'All systems operational',
        intent: 'success',
        size: 'lg'
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <InfoCardComponent intent={values.intent} size={values.size} title={values.title}
          >{values.children}</InfoCardComponent
        >
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section marker="02" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Each card is a named landmark">
        <p>
          Without <code>href</code> the card renders an <code>&lt;aside&gt;</code>, so it is a
          complementary landmark — named from <code>title</code>, or from the translated "Note" when
          there is none. Four callouts on a page are four landmarks: give each one a title, or a
          screen-reader user gets four stops that all announce the same word.
        </p>
      </Note>
      <Note title="The title is a real heading">
        <p>
          It renders <code>&lt;h3&gt;</code> by default, so the card appears in the document outline
          under the section it sits in. Set <code>headingLevel</code> when the card is nested deeper —
          a card inside a subsection that keeps the default jumps a level.
        </p>
      </Note>
      <Note title="The intent is decoration, the title is the message">
        <p>
          The accent colour carries no semantics: a screen reader announces a warning card exactly
          like an info card. Put the severity in the words — "This action cannot be undone" — never
          in the colour alone. The
          <code>icon</code> is <code>aria-hidden</code> for the same reason.
        </p>
      </Note>
      <Note title="A card is not a live region">
        <p>
          It is static prose in the reading order and is not announced when it appears. For
          something that has to interrupt — a failed save, a validation error —
          <code>Alert</code> from <code>@urbicon-ui/blocks</code> is the component that carries the live
          region.
        </p>
      </Note>
      <Note title="With href, the whole card is one link">
        <p>
          Passing <code>href</code> swaps the <code>&lt;aside&gt;</code> for an
          <code>&lt;a&gt;</code> labelled by the title, so the body text is inside the link rather than
          beside it. Keep the body short in that mode, and keep the title meaningful on its own — it is
          the entire accessible name.
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
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section marker="04" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { InfoCard } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/info-card/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
