<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { Select } from '@urbicon-ui/blocks';
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
    { id: 'installation', title: 'Installation', order: 6 }
  ];
</script>

<SeoMeta
  title="Select Component"
  description="Form-focused select dropdown with label, validation, keyboard navigation, grouped options, and form integration."
/>

<DocsPageLayout
  title="Select"
  description="Form-focused select dropdown with label, validation, keyboard navigation, grouped options, and form integration."
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
      componentName="Select"
      {propDocs}
      {variantKeys}
      controls={[
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'outlined', value: 'outlined' },
            { label: 'filled', value: 'filled' },
            { label: 'ghost', value: 'ghost' }
          ],
          defaultValue: 'outlined'
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
          defaultValue: 'md'
        },
        {
          type: 'dropdown',
          key: 'tier',
          label: 'Tier',
          items: [
            { label: 'modify (soft)', value: 'modify' },
            { label: 'commit (pill)', value: 'commit' }
          ],
          defaultValue: 'modify'
        },
        { type: 'checkbox', key: 'clearable', label: 'Clearable', defaultValue: false },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false },
        { type: 'checkbox', key: 'required', label: 'Required', defaultValue: false }
      ]}
      values={{
        variant: 'outlined',
        size: 'md',
        tier: 'modify',
        clearable: false,
        disabled: false,
        required: false
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <div class="w-full max-w-xs">
          <Select
            label="Framework"
            placeholder="Choose a framework"
            options={[
              { label: 'Svelte', value: 'svelte' },
              { label: 'React', value: 'react' },
              { label: 'Vue', value: 'vue' },
              { label: 'Angular', value: 'angular' }
            ]}
            variant={values.variant}
            size={values.size}
            tier={values.tier}
            clearable={values.clearable}
            disabled={values.disabled}
            required={values.required}
          />
        </div>
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
      code={`import { Select } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/select/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
