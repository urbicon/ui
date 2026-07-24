<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import { Toaster, toaster, Button } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 5 },
    { id: 'types', title: 'Types', order: 6 },
    { id: 'installation', title: 'Installation', order: 7 }
  ];

  let placement = $state<
    'top-right' | 'top-left' | 'top-center' | 'bottom-right' | 'bottom-left' | 'bottom-center'
  >('bottom-right');

  function intentMethod(intent: string) {
    if (intent === 'primary') return 'info';
    return intent;
  }

  function generateCode(v: Record<string, unknown>) {
    const method = intentMethod(String(v.intent));
    const opts: string[] = [];
    if (v.description) opts.push(`description: '${v.description}'`);
    if (v.duration !== 5000) opts.push(`duration: ${v.duration}`);
    if (!v.dismissible) opts.push('dismissible: false');
    if (!v.showProgress) opts.push('showProgress: false');
    const optsStr = opts.length ? `, { ${opts.join(', ')} }` : '';
    return `toaster.${method}('${v.title}'${optsStr});`;
  }
</script>

<SeoMeta
  title="Toast Component"
  description="Non-blocking notifications triggered via a global store. Supports intents, auto-dismiss, progress bars, and custom placements."
/>

<Toaster {placement} />

<DocsPageLayout
  title="Toast"
  description="Non-blocking notifications triggered via a global store. Supports intents, auto-dismiss, progress bars, and custom placements."
  maxWidth="2xl"
  showToc={true}
  {navigation}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Toaster"
      {propDocs}
      {variantKeys}
      codeGenerator={generateCode}
      controls={[
        {
          type: 'dropdown',
          key: 'placement',
          label: 'Placement',
          items: [
            { label: 'top-left', value: 'top-left' },
            { label: 'top-center', value: 'top-center' },
            { label: 'top-right', value: 'top-right' },
            { label: 'bottom-left', value: 'bottom-left' },
            { label: 'bottom-center', value: 'bottom-center' },
            { label: 'bottom-right', value: 'bottom-right' }
          ],
          defaultValue: 'bottom-right',
          group: 'Container'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'primary', value: 'primary' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' },
            { label: 'neutral', value: 'neutral' }
          ],
          defaultValue: 'success',
          group: 'Toast Options'
        },
        {
          type: 'text',
          key: 'title',
          label: 'Title',
          defaultValue: 'Changes saved',
          group: 'Toast Options'
        },
        {
          type: 'text',
          key: 'description',
          label: 'Description',
          defaultValue: 'Your settings have been updated.',
          group: 'Toast Options'
        },
        {
          type: 'slider',
          key: 'duration',
          label: 'Duration (ms)',
          min: 0,
          max: 10000,
          step: 500,
          defaultValue: 5000,
          group: 'Toast Options'
        },
        {
          type: 'checkbox',
          key: 'dismissible',
          label: 'Dismissible',
          defaultValue: true,
          group: 'Toast Options'
        },
        {
          type: 'checkbox',
          key: 'showProgress',
          label: 'Show Progress',
          defaultValue: true,
          group: 'Toast Options'
        }
      ]}
      values={{
        placement: 'bottom-right',
        intent: 'success',
        title: 'Changes saved',
        description: 'Your settings have been updated.',
        duration: 5000,
        dismissible: true,
        showProgress: true
      }}
      onValuesChange={(v) => (placement = v.placement as typeof placement)}
      showHeader={false}
    >
      {#snippet children(values)}
        <Button
          intent={values.intent === 'neutral' ? 'neutral' : values.intent}
          variant="filled"
          onclick={() =>
            toaster.add({
              intent: values.intent,
              title: values.title,
              description: values.description,
              duration: values.duration,
              dismissible: values.dismissible,
              showProgress: values.showProgress
            })}
        >
          Show Toast
        </Button>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section
    marker="04"
    id="api"
    title="API Reference"
    intent="secondary"
    meta={`${componentData?.stats?.totalProps ?? 0} props`}
  >
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <Section marker="05" id="types" title="Types">
    <TypesReference
      types={componentData?.types ?? []}
      title="Store & Type Definitions"
      description="Types for the toaster store API. ToastInput defines what you pass to toaster.add(), the shorthand methods accept ToastShorthandOpts."
    />
  </Section>

  <Section marker="06" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Toaster, toaster } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/toast/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
