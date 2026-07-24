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
  import { Input } from '@urbicon-ui/blocks';
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
  title="Input Component"
  description="Text input fields with validation states, icons, and form integration."
/>

<DocsPageLayout
  title="Input"
  description="Text input fields with validation states, icons, and form integration."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Primitives', href: resolve('/blocks/primitives') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Input"
      {propDocs}
      {variantKeys}
      controls={[
        { type: 'text', key: 'label', label: 'Label', defaultValue: 'Email' },
        {
          type: 'text',
          key: 'placeholder',
          label: 'Placeholder',
          defaultValue: 'name@example.com'
        },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'outlined', value: 'outlined' },
            { label: 'filled', value: 'filled' },
            { label: 'ghost', value: 'ghost' },
            { label: 'underline', value: 'underline' }
          ],
          defaultValue: 'outlined'
        },
        {
          type: 'dropdown',
          key: 'intent',
          label: 'Intent',
          items: [
            { label: 'default', value: 'default' },
            { label: 'success', value: 'success' },
            { label: 'warning', value: 'warning' },
            { label: 'danger', value: 'danger' }
          ],
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'xs', value: 'xs' },
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' },
            { label: 'xl', value: 'xl' }
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
        { type: 'checkbox', key: 'readonly', label: 'Readonly', defaultValue: false },
        { type: 'checkbox', key: 'required', label: 'Required', defaultValue: false },
        {
          type: 'text',
          key: 'helper',
          label: 'Helper Text',
          defaultValue: 'We will never share your email'
        },
        { type: 'text', key: 'error', label: 'Error Text', defaultValue: '' }
      ]}
      values={{
        label: 'Email',
        placeholder: 'name@example.com',
        variant: 'outlined',
        intent: 'default',
        size: 'md',
        tier: 'modify',
        clearable: false,
        disabled: false,
        readonly: false,
        required: false,
        helper: 'We will never share your email',
        error: ''
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Input
          label={values.label || undefined}
          placeholder={values.placeholder || undefined}
          variant={values.variant}
          intent={values.intent}
          size={values.size}
          tier={values.tier}
          clearable={values.clearable}
          disabled={values.disabled}
          readonly={values.readonly}
          required={values.required}
          helper={values.helper || undefined}
          error={values.error || undefined}
        />
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
      code={`import { Input } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/primitives/input/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
