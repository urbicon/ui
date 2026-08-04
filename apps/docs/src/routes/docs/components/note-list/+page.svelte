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
    'Card of short titled notes separated by rules — the accessibility block of a documentation page.';
</script>

<SeoMeta title="NoteList Component" {description} />

<DocsPageLayout
  title="NoteList"
  {description}
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <PlaygroundConfigurator
      componentName="NoteList"
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'card', value: 'card' },
            { label: 'flush', value: 'flush' }
          ],
          defaultValue: 'card'
        },
        // Steers the demo, not the component: without `demoOnly` the generated
        // snippet would print `notes={3}` on a `<NoteList>` that has no such
        // prop. `headingLevel` is deliberately not a knob here — it belongs to
        // `Note`, and its effect is on the document outline, not on anything
        // the stage would show moving.
        {
          type: 'range',
          key: 'notes',
          label: 'Notes (demo)',
          defaultValue: 3,
          min: 1,
          max: 5,
          step: 1,
          demoOnly: true
        }
      ]}
      values={{ variant: 'card', notes: 3 }}
      showHeader={false}
    >
      {#snippet children(values)}
        {@const rows = [
          { title: 'Built-in ARIA', body: 'The trigger carries aria-expanded.' },
          { title: 'Keyboard', body: 'Arrow keys move, Escape closes.' },
          { title: 'Reduced motion', body: 'The slide is dropped, the panel still opens.' },
          { title: 'Focus', body: 'Focus returns to the trigger on close.' },
          { title: 'Labels', body: 'Icon-only controls carry an accessible name.' }
        ].slice(0, values.notes)}
        <div class="w-full">
          <NoteList variant={values.variant}>
            {#each rows as row (row.title)}
              <Note title={row.title}>{row.body}</Note>
            {/each}
          </NoteList>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

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
      code={`import { NoteList, Note } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/note-list/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
