<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Select } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

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

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Pill Trigger via slotClasses"
      description="Select spans two surfaces — the field (trigger, triggerText, placeholder, chevron, clear) and the floating list (listbox, option, group, groupLabel). Here the trigger becomes a pill and the listbox gets a matching radius with a stronger shadow; keyboard navigation and the form contract are untouched."
      isolate
      previewClass="flex flex-col gap-3 max-w-xs"
    >
      <Select
        label="Sort by"
        options={[
          { label: 'Newest first', value: 'newest' },
          { label: 'Price ascending', value: 'price-asc' },
          { label: 'Price descending', value: 'price-desc' }
        ]}
        value="newest"
        slotClasses={{
          trigger: 'rounded-full',
          listbox: 'rounded-xl shadow-[var(--blocks-shadow-lg)]',
          option: 'rounded-lg'
        }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      <code class="text-text-primary">unstyled</code> strips every slot's default classes while the
      combobox ARIA wiring, keyboard navigation, and hidden form input keep working — rebuild both
      surfaces through <code class="text-text-primary">slotClasses</code>. A field treatment your
      forms share (with Input and Combobox) belongs in
      <code class="text-text-primary">BlocksProvider</code> presets (<code class="text-text-primary"
        >presets.Select</code
      >) rather than per-instance overrides — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="ARIA Combobox">
      <p>
        The trigger uses <code class="text-text-primary">role="combobox"</code> with
        <code class="text-text-primary">aria-expanded</code>,
        <code class="text-text-primary">aria-haspopup="listbox"</code>, and
        <code class="text-text-primary">aria-controls</code>. Options use
        <code class="text-text-primary">role="option"</code> with
        <code class="text-text-primary">aria-selected</code>. Label, error, and helper text are
        linked via <code class="text-text-primary">aria-labelledby</code> and
        <code class="text-text-primary">aria-describedby</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
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
    </Note>
    <Note title="Form Submission">
      <p>
        When the <code class="text-text-primary">name</code> prop is set, a hidden
        <code class="text-text-primary">&lt;input&gt;</code> element carries the selected value for native
        form submission without JavaScript.
      </p>
    </Note>
  </NoteList>
</Section>
