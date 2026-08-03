<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { Button } from '@urbicon-ui/blocks';
  import Docs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'control-types', title: 'Control Types' },
    { id: 'conditional', title: 'Conditional Controls' },
    { id: 'code-gen', title: 'Code Generation' },
    { id: 'prop-docs', title: 'PropDocs & Variants' },
    { id: 'accessibility', title: 'Accessibility' },
    { id: 'api', title: 'API Reference' },
    { id: 'installation', title: 'Installation' }
  ];

  const description =
    'Live component playground pairing a preview stage with prop controls and a generated snippet.';
</script>

<SeoMeta title="PlaygroundConfigurator Component" {description} />

<DocsPageLayout
  title="PlaygroundConfigurator"
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
    subtitle="A playground configuring a playground"
  >
    <!-- The knobs are this component's own props, and the stage is a second,
         smaller playground they steer. Until 2026-08 the knobs drove a styled
         `<span>` instead (label / bold / color / font size), so the generated
         snippet on the page documenting the generator read
         `<PlaygroundConfigurator bold color="success" label="Hello World"
         size={24} />` — four attributes, none of them a prop of this component,
         and `size` with a pixel number where the prop takes sm/md/lg. -->
    <PlaygroundConfigurator
      componentName="PlaygroundConfigurator"
      showHeader={false}
      controls={[
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: ['sm', 'md', 'lg'].map((v) => ({ label: v, value: v })),
          defaultValue: 'md'
        },
        { type: 'boolean', key: 'showHeader', label: 'Show header', defaultValue: true },
        {
          type: 'text',
          key: 'title',
          label: 'Title',
          defaultValue: 'Button',
          condition: { dependsOn: 'showHeader', equals: true }
        },
        {
          type: 'text',
          key: 'subtitle',
          label: 'Subtitle',
          defaultValue: 'Try the intents',
          condition: { dependsOn: 'showHeader', equals: true }
        },
        {
          type: 'boolean',
          key: 'defaultCodeExpanded',
          label: 'Code panel open',
          defaultValue: true
        }
      ]}
      values={{
        size: 'md',
        showHeader: true,
        title: 'Button',
        subtitle: 'Try the intents',
        defaultCodeExpanded: true
      }}
    >
      {#snippet children(values)}
        <div class="w-full">
          <PlaygroundConfigurator
            componentName="Button"
            shareKey="playground-inner"
            size={values.size}
            showHeader={values.showHeader}
            title={values.title}
            subtitle={values.subtitle}
            defaultCodeExpanded={values.defaultCodeExpanded}
            controls={[
              { key: 'label', type: 'text', label: 'Label', defaultValue: 'Save changes' },
              {
                key: 'intent',
                type: 'dropdown',
                label: 'Intent',
                items: [
                  { label: 'primary', value: 'primary' },
                  { label: 'neutral', value: 'neutral' },
                  { label: 'danger', value: 'danger' }
                ],
                defaultValue: 'primary'
              }
            ]}
            values={{ label: 'Save changes', intent: 'primary' }}
          >
            {#snippet children(inner)}
              <Button intent={inner.intent}>{inner.label}</Button>
            {/snippet}
          </PlaygroundConfigurator>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <Docs />

  <Section marker="05" id="accessibility" title="Accessibility">
    <NoteList>
      <Note title="Every control is a labelled form control">
        <p>
          The panel renders real inputs — text fields, checkboxes, selects, sliders — each with its
          own <code>&lt;label&gt;</code>. The label text is the knob's <code>label</code>, so a knob
          named "Size" announces as "Size", and a knob whose effect is screen-reader-only should say
          so there rather than reading as dead.
        </p>
      </Note>
      <Note title="The stage updates without stealing focus">
        <p>
          Changing a control re-renders the preview and leaves focus on the control. That is what
          makes the panel usable with a keyboard: a reader can walk the whole control set with Tab
          without the page pulling them back to the stage after each change.
        </p>
      </Note>
      <Note title="The generated snippet is text, not an image">
        <p>
          The code below the stage is real text in a code panel, so it is readable, selectable and
          copyable. A reader who cannot use the visual preview still gets the exact markup the
          current knob settings produce.
        </p>
      </Note>
      <Note title="Reset is a button and says what it resets">
        <p>
          A knob moved away from its default gets a marker, and the reset control is an ordinary
          button rather than a click target on the marker itself.
        </p>
      </Note>
    </NoteList>
  </Section>

  <Section
    marker="06"
    id="api"
    title="API Reference"
    subtitle="Complete list of component properties and their configurations"
    intent="secondary"
  >
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="07" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { PlaygroundConfigurator } from '@urbicon-ui/docs';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 w-full text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/docs/components/playground-configurator/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
