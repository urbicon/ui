<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section, PlaygroundConfigurator, InfoCard } from '@urbicon-ui/docs';
  import { Badge, Button, Input } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: true },
      playground: { enabled: false },
      variants: { enabled: false },
      examples: { enabled: true, order: 2 },
      api: { enabled: true, order: 9, groupBy: 'category', showInheritance: true },
      usage: false
    },
    llm: { include: true, maxSections: 5, priority: ['overview', 'api'] },
    meta: { title: 'PlaygroundConfigurator Component', showToc: true }
  };

  const buttonCode = (v: Record<string, unknown>) =>
    `<Button variant="${v.variant}" intent="${v.intent}" size="${v.size}"${v.disabled ? ' disabled' : ''}>${v.label}</Button>`;
</script>

<!-- All Control Types -->
<Section id="control-types" title="Control Types" subtitle="Every supported control in action">
  <CodeExample title="All Controls">
    <PlaygroundConfigurator
      componentName="Demo"
      showHeader={false}
      controls={[
        {
          key: 'name',
          type: 'text',
          label: 'Name',
          defaultValue: 'Urbicon',
          placeholder: 'Enter name…'
        },
        { key: 'count', type: 'number', label: 'Count', defaultValue: 3, min: 0, max: 20, step: 1 },
        {
          key: 'opacity',
          type: 'slider',
          label: 'Opacity',
          defaultValue: 80,
          min: 0,
          max: 100,
          step: 5
        },
        { key: 'accent', type: 'color', label: 'Accent', defaultValue: '#6366f1' },
        {
          key: 'variant',
          type: 'dropdown',
          label: 'Variant',
          items: [
            { label: 'Filled', value: 'filled' },
            { label: 'Outlined', value: 'outlined' },
            { label: 'Ghost', value: 'ghost' }
          ],
          defaultValue: 'filled'
        },
        { key: 'active', type: 'boolean', label: 'Active', defaultValue: true }
      ]}
      values={{
        name: 'Urbicon',
        count: 3,
        opacity: 80,
        accent: '#6366f1',
        variant: 'filled',
        active: true
      }}
    >
      {#snippet children(values)}
        <div class="flex flex-col items-center gap-3">
          <div
            class="text-text-on-primary flex h-20 w-20 items-center justify-center rounded-xl text-xl font-bold"
            style="background: {values.accent}; opacity: {values.opacity / 100}"
          >
            {values.count}
          </div>
          <span class="text-text-primary text-sm font-medium">{values.name}</span>
          <Badge variant={values.variant} intent={values.active ? 'success' : 'neutral'} size="sm">
            {values.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </CodeExample>
</Section>

<!-- Conditional Controls -->
<Section
  id="conditional"
  title="Conditional Controls"
  subtitle="Controls that appear based on other values"
>
  <CodeExample title="Conditional Visibility">
    <PlaygroundConfigurator
      componentName="Alert"
      showHeader={false}
      controls={[
        {
          key: 'intent',
          type: 'dropdown',
          label: 'Intent',
          items: [
            { label: 'Success', value: 'success' },
            { label: 'Warning', value: 'warning' },
            { label: 'Danger', value: 'danger' }
          ],
          defaultValue: 'success'
        },
        { key: 'dismissible', type: 'boolean', label: 'Dismissible', defaultValue: false },
        {
          key: 'autoDismiss',
          type: 'slider',
          label: 'Auto-dismiss (ms)',
          defaultValue: 3000,
          min: 1000,
          max: 10000,
          step: 500,
          condition: { dependsOn: 'dismissible', equals: true }
        }
      ]}
      values={{ intent: 'success', dismissible: false, autoDismiss: 3000 }}
    >
      {#snippet children(values)}
        <div
          class="w-full max-w-sm rounded-lg border px-4 py-3 text-sm
          {values.intent === 'success' ? 'border-success/30 bg-success-subtle text-success' : ''}
          {values.intent === 'warning' ? 'border-warning/30 bg-warning-subtle text-warning' : ''}
          {values.intent === 'danger' ? 'border-danger/30 bg-danger-subtle text-danger' : ''}"
        >
          <div class="flex items-center justify-between">
            <span>
              {values.intent === 'success' ? 'Operation completed.' : ''}
              {values.intent === 'warning' ? 'Please review.' : ''}
              {values.intent === 'danger' ? 'Action required!' : ''}
            </span>
            {#if values.dismissible}
              <button class="opacity-50 hover:opacity-100">✕</button>
            {/if}
          </div>
          {#if values.dismissible}
            <span class="mt-1 block text-xs opacity-60"
              >Auto-dismisses in {values.autoDismiss}ms</span
            >
          {/if}
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </CodeExample>
</Section>

<!-- Sizes -->
<Section id="sizes" title="Sizes" subtitle="Compact, default, and spacious layouts">
  <div class="flex flex-col gap-6">
    {#each ['sm', 'md', 'lg'] as const as sizeOption (sizeOption)}
      <CodeExample title="Size: {sizeOption}">
        <PlaygroundConfigurator
          componentName="Button"
          showHeader={false}
          size={sizeOption}
          controls={[
            { key: 'label', type: 'text', label: 'Label', defaultValue: 'Click me' },
            {
              key: 'intent',
              type: 'dropdown',
              label: 'Intent',
              items: [
                { label: 'Primary', value: 'primary' },
                { label: 'Neutral', value: 'neutral' }
              ],
              defaultValue: 'primary'
            }
          ]}
          values={{ label: 'Click me', intent: 'primary' }}
          codeGenerator={buttonCode}
        >
          {#snippet children(values)}
            <Button intent={values.intent}>{values.label}</Button>
          {/snippet}
        </PlaygroundConfigurator>
      </CodeExample>
    {/each}
  </div>
</Section>

<!-- Custom Code Generator -->
<Section
  id="code-gen"
  title="Custom Code Generator"
  subtitle="Pass your own code generator for tailored output"
>
  <CodeExample title="Button Builder">
    <PlaygroundConfigurator
      componentName="Button"
      showHeader={false}
      controls={[
        { key: 'label', type: 'text', label: 'Label', defaultValue: 'Submit' },
        {
          key: 'variant',
          type: 'dropdown',
          label: 'Variant',
          items: [
            { label: 'Filled', value: 'filled' },
            { label: 'Outlined', value: 'outlined' },
            { label: 'Ghost', value: 'ghost' }
          ],
          defaultValue: 'filled'
        },
        {
          key: 'intent',
          type: 'dropdown',
          label: 'Intent',
          items: [
            { label: 'Primary', value: 'primary' },
            { label: 'Success', value: 'success' },
            { label: 'Danger', value: 'danger' },
            { label: 'Neutral', value: 'neutral' }
          ],
          defaultValue: 'primary'
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
        },
        { key: 'disabled', type: 'boolean', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        label: 'Submit',
        variant: 'filled',
        intent: 'primary',
        size: 'md',
        disabled: false
      }}
      codeGenerator={buttonCode}
    >
      {#snippet children(values)}
        <Button
          variant={values.variant}
          intent={values.intent}
          size={values.size}
          disabled={values.disabled}
        >
          {values.label}
        </Button>
      {/snippet}
    </PlaygroundConfigurator>
  </CodeExample>
</Section>

<!-- PropDocs + VariantKeys -->
<Section
  id="prop-docs"
  title="PropDocs & VariantKeys"
  subtitle="Info tooltips and variant badges for controls"
>
  <CodeExample title="With Prop Documentation">
    <PlaygroundConfigurator
      componentName="Input"
      showHeader={false}
      propDocs={{
        clearable:
          'Show a clear button when the input has a value. Press Escape or click to clear.',
        placeholder: 'Hint text shown when the field is empty.'
      }}
      variantKeys={['variant', 'size']}
      controls={[
        { key: 'placeholder', type: 'text', label: 'Placeholder', defaultValue: 'Type here…' },
        {
          key: 'variant',
          type: 'dropdown',
          label: 'Variant',
          items: [
            { label: 'Outlined', value: 'outlined' },
            { label: 'Filled', value: 'filled' },
            { label: 'Ghost', value: 'ghost' }
          ],
          defaultValue: 'outlined'
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
        },
        { key: 'clearable', type: 'boolean', label: 'Clearable', defaultValue: false }
      ]}
      values={{ placeholder: 'Type here…', variant: 'outlined', size: 'md', clearable: false }}
    >
      {#snippet children(values)}
        <Input
          placeholder={values.placeholder}
          variant={values.variant}
          size={values.size}
          clearable={values.clearable}
        />
      {/snippet}
    </PlaygroundConfigurator>
  </CodeExample>
</Section>

<!-- Use Cases -->
<Section id="use-cases" title="Use Cases" subtitle="Where PlaygroundConfigurator fits in docs">
  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <InfoCard title="Component Docs">Live preview with knobs for every prop</InfoCard>
    <InfoCard title="Design System">Quick exploration of variants, sizes, and intents</InfoCard>
    <InfoCard title="Code Generation">Copy-paste ready Svelte code from the panel</InfoCard>
  </div>
</Section>
