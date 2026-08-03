<!-- urbicon-ignore raw-tailwind-color — the 4 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Kbd, LocaleSwitcher, Select } from '@urbicon-ui/blocks';
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Basic"
      description="Default trigger with flags; pass showFlag={false} to drop them."
      isolate
      previewClass="flex items-center gap-4"
    >
      <LocaleSwitcher showFlag />
      <LocaleSwitcher showFlag={false} />
    </CodeExample>

    <CodeExample
      title="In a settings panel"
      description="Realistic use — small outlined trigger inline with other preference rows."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <div
        class="bg-surface-elevated border-border-subtle w-full overflow-hidden rounded-2xl border"
      >
        <div class="border-border-subtle border-b px-5 py-3">
          <h3 class="text-text-primary text-sm font-semibold">Preferences</h3>
        </div>
        <div class="divide-border-subtle divide-y">
          <div class="flex items-center justify-between px-5 py-3">
            <p class="text-text-primary text-sm font-medium">Language</p>
            <LocaleSwitcher variant="outlined" size="sm" showFlag />
          </div>
          <div class="flex items-center justify-between px-5 py-3">
            <p class="text-text-primary text-sm font-medium">Region</p>
            <Select
              options={[
                { label: 'Europe', value: 'eu' },
                { label: 'North America', value: 'na' },
                { label: 'Asia', value: 'asia' }
              ]}
              value="eu"
              variant="outlined"
              size="sm"
            />
          </div>
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="customization" title="Customization">
  <CodeExample
    title="Branded trigger"
    description="Override the underlying Select trigger slot with a gradient brand-look."
    isolate
    previewClass="flex items-center gap-4"
  >
    <LocaleSwitcher
      showFlag
      slotClasses={{
        trigger:
          'bg-linear-to-r from-indigo-500 to-violet-500 text-white border-transparent shadow-md shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-600'
      }}
    />
  </CodeExample>
</Section>

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <p class="text-text-secondary text-sm leading-relaxed">
      Inherits the Select listbox semantics —
      <code class="text-text-primary">role="listbox"</code>,
      <code class="text-text-primary">aria-expanded</code>,
      <code class="text-text-primary">aria-selected</code> — plus a trigger
      <code class="text-text-primary">aria-label</code> from the i18n bundle.
      <Kbd keys="↑" />
      <Kbd keys="↓" />
      navigate,
      <Kbd keys="Enter" />
      selects,
      <Kbd keys="Esc" />
      closes. Locale names resolve from the active translation bundle.
    </p>
  </div>
</Section>
