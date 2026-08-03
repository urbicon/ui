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
  import type { LocalTypeDef } from '@urbicon-ui/docs';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'examples', title: 'Examples' },
    { id: 'empty', title: 'Empty State' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
  ];

  const playgroundTypes: LocalTypeDef[] = [
    {
      name: 'ComponentSize',
      type: 'type',
      definition: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
      documentation: 'Standard size scale for all components.',
      category: 'helper',
      scope: 'local',
      usedByProps: [
        { component: 'Button', propName: 'size', source: 'variant' },
        { component: 'Input', propName: 'size', source: 'variant' }
      ]
    },
    {
      name: 'MintProp',
      type: 'type',
      definition: "'scale' | 'ripple' | 'translate' | 'glow' | 'none'",
      documentation: 'Micro-interaction animation type.',
      category: 'helper',
      scope: 'local'
    },
    {
      name: 'MenuProps',
      type: 'interface',
      definition:
        'items: ControlOption[];\n  value?: string;\n  onValueChange?: (value: string) => void;\n  size?: ComponentSize;',
      documentation: 'Props for the Menu select component.',
      category: 'props',
      scope: 'local'
    }
  ];

  const description =
    'Expandable type definitions panel for component documentation, with inline code blocks, literal-value badges and cross-links into the API reference.';
</script>

<SeoMeta title="TypesReference Component" {description} />

<DocsPageLayout
  title="TypesReference"
  {description}
  maxWidth="lg"
  showToc={true}
  {navigation}
  breadcrumbs={[{ label: 'Doc Components', href: resolve('/docs') }]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section
    id="playground"
    title="Playground"
    intent="primary"
    subtitle="Configure and preview the types panel"
  >
    <PlaygroundConfigurator
      componentName="TypesReference"
      showHeader={false}
      controls={[
        { key: 'title', type: 'text', label: 'Title', defaultValue: 'Type Definitions' },
        {
          key: 'description',
          type: 'text',
          label: 'Description',
          defaultValue: 'Local types used by this component.'
        },
        {
          key: 'size',
          type: 'dropdown',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        }
      ]}
      values={{
        title: 'Type Definitions',
        description: 'Local types used by this component.',
        size: 'md'
      }}
    >
      {#snippet children(values)}
        <TypesReference
          types={playgroundTypes}
          title={values.title}
          description={values.description}
          size={values.size}
        />
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section marker="03" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="A named region with its own heading">
        <p>
          The panel renders a <code>&lt;section&gt;</code> labelled by the heading it draws from
          <code>title</code>, so it is one region in the landmark list rather than an unnamed block
          at the end of the page.
        </p>
      </Note>
      <Note title="Expanding a definition is a button">
        <p>
          Each row's toggle carries <code>aria-expanded</code> and is in the tab order with a visible
          focus ring. Definitions are collapsed by default, so a keyboard reader passes 20 type names
          rather than 20 type bodies.
        </p>
      </Note>
      <Note title="Cross-links are in-page anchors">
        <p>
          The "used by" links point at rows of the API table on the same page. They are ordinary
          anchors — they work with the keyboard, appear in a link list, and survive being copied out
          of the page.
        </p>
      </Note>
      <Note title="Literal values are text, not colour">
        <p>
          A union type's members render as badges whose meaning is in their text. Nothing on the
          panel is distinguished by colour alone.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section
    marker="04"
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { TypesReference } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 w-full text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/types-reference/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
