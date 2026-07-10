<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { FormField } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);
  const relatedLinks = buildRelatedLinks(componentData);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];
</script>

<SeoMeta
  title="FormField Component"
  description="Layout wrapper for composite form fields with label, helper text, and error message."
/>

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="FormField"
  description="Layout wrapper for composite form fields that need a label, helper text, and error message but cannot rely on the built-in slots of Input/Select/Textarea."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Primitives', href: '/blocks/primitives' }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      showHeader={false}
      {propDocs}
      {variantKeys}
      componentName="FormField"
      controls={[
        { type: 'text', key: 'label', label: 'Label', defaultValue: 'Document' },
        {
          type: 'text',
          key: 'helper',
          label: 'Helper',
          defaultValue: 'PDF, JPG, PNG — max 10 MB'
        },
        { type: 'text', key: 'error', label: 'Error', defaultValue: '' },
        { type: 'checkbox', key: 'required', label: 'Required', defaultValue: false }
      ]}
      values={{
        label: 'Document',
        helper: 'PDF, JPG, PNG — max 10 MB',
        error: '',
        required: false
      }}
    >
      {#snippet children(values)}
        <FormField {...values}>
          {#snippet children(ctx)}
            <input
              id={ctx.id}
              type="file"
              aria-describedby={ctx.describedBy}
              aria-invalid={ctx.invalid}
              required={ctx.required}
              class="border-border-subtle bg-surface-base text-text-primary file:bg-surface-interactive file:text-text-primary hover:file:bg-surface-hover w-full rounded-md border px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:px-3 file:py-1.5 file:text-sm"
            />
          {/snippet}
        </FormField>
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
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section marker="05" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { FormField } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/primitives/form-field/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
