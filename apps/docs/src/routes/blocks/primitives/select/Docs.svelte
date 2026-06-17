<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Select } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['variant', 'size', 'clearable', 'disabled', 'required'],
        defaults: { variant: 'outlined', size: 'md' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Select Component', showToc: true }
  };

  let selectedRole = $state<string | null>('editor');

  const countries = [
    { label: 'Germany', value: 'de' },
    { label: 'France', value: 'fr' },
    { label: 'Spain', value: 'es' },
    { label: 'Italy', value: 'it' },
    { label: 'United Kingdom', value: 'uk' }
  ];

  const timezoneGroups = [
    {
      label: 'Americas',
      options: [
        { label: 'New York (EST)', value: 'est' },
        { label: 'Chicago (CST)', value: 'cst' },
        { label: 'Los Angeles (PST)', value: 'pst' }
      ]
    },
    {
      label: 'Europe',
      options: [
        { label: 'London (GMT)', value: 'gmt' },
        { label: 'Berlin (CET)', value: 'cet' },
        { label: 'Moscow (MSK)', value: 'msk' }
      ]
    },
    {
      label: 'Asia',
      options: [
        { label: 'Tokyo (JST)', value: 'jst' },
        { label: 'Shanghai (CST)', value: 'cst-cn' },
        { label: 'Mumbai (IST)', value: 'ist' }
      ]
    }
  ];
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Grouped options"
      description="Use the groups prop to organize long option lists under section labels — typical for timezones, countries by region, or categorized data."
      isolate
      previewClass="flex flex-col gap-3 max-w-xs"
    >
      <Select label="Timezone" groups={timezoneGroups} placeholder="Select timezone" />
    </CodeExample>

    <CodeExample
      title="Per-option disabled"
      description="Disable individual options while the rest of the list stays selectable. Keyboard navigation skips disabled options."
      isolate
      previewClass="flex flex-col gap-3 max-w-xs"
    >
      <Select
        label="Plan"
        options={[
          { label: 'Free', value: 'free' },
          { label: 'Starter', value: 'starter' },
          { label: 'Pro', value: 'pro' },
          { label: 'Enterprise (Contact us)', value: 'enterprise', disabled: true }
        ]}
        placeholder="Choose a plan"
      />
    </CodeExample>

    <CodeExample
      title="Helper & error"
      description="Helper and error text follow the same form-field contract as Input — `error` overrides `helper` when both are set."
      isolate
      previewClass="flex flex-col gap-4 max-w-xs"
    >
      <Select
        label="Language"
        options={countries}
        helper="Choose your preferred language"
        placeholder="Select..."
      />
      <Select
        label="Department"
        options={countries}
        error="Please select a department"
        placeholder="Select..."
      />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Form Integration"
      description="Select with hidden input for native form submission."
      isolate
      previewClass="flex justify-center max-w-sm w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-4 rounded-2xl border p-5">
        <Select
          label="User Role"
          name="role"
          bind:value={selectedRole}
          options={[
            { label: 'Viewer', value: 'viewer' },
            { label: 'Editor', value: 'editor' },
            { label: 'Admin', value: 'admin' }
          ]}
        />
        <p class="text-text-tertiary text-xs">
          Form value: <code class="text-text-primary">{selectedRole ?? 'null'}</code>
        </p>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA Combobox</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The trigger uses <code class="text-text-primary">role="combobox"</code> with
          <code class="text-text-primary">aria-expanded</code>,
          <code class="text-text-primary">aria-haspopup="listbox"</code>, and
          <code class="text-text-primary">aria-controls</code>. Options use
          <code class="text-text-primary">role="option"</code> with
          <code class="text-text-primary">aria-selected</code>. Label, error, and helper text are
          linked via <code class="text-text-primary">aria-labelledby</code> and
          <code class="text-text-primary">aria-describedby</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Arrow Down</kbd
          >
          opens the dropdown.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Arrow Up/Down</kbd
          >
          navigates options.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Home/End</kbd
          >
          jump to first/last.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          closes and returns focus.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Form Submission</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          When the <code class="text-text-primary">name</code> prop is set, a hidden
          <code class="text-text-primary">&lt;input&gt;</code> element carries the selected value for
          native form submission without JavaScript.
        </p>
      </div>
    </div>
  </div>
</Section>
