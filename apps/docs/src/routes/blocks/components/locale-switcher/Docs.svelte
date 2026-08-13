<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, LocaleSwitcher, Select } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    <code class="text-text-primary">LocaleSwitcher</code> reads and sets the language through the
    app's i18n setup, so mount it under your
    <code class="text-text-primary">&lt;I18nProvider&gt;</code>. Pass
    <code class="text-text-primary">locales</code> to choose which languages it offers.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Restrict the languages"
      description="Only the languages you list appear, in that order."
      isolate
      previewClass="flex items-center gap-4"
    >
      <LocaleSwitcher showFlag locales={['en', 'de', 'fr']} />
    </CodeExample>

    <CodeExample
      title="In a settings panel"
      description="A language row inside a settings card."
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

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Primary-tinted trigger"
      description="The slotClasses prop restyles individual parts: the trigger, its chevron, the open list. Your classes are added to the built-in ones, so the default sizing and keyboard behaviour stay."
      isolate
      previewClass="flex justify-center"
    >
      <LocaleSwitcher
        showFlag
        slotClasses={{
          trigger: 'bg-primary-subtle border-primary text-primary hover:border-primary',
          chevron: 'text-primary',
          listbox: 'border-primary'
        }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>,
      <code class="text-text-primary">preset</code> and provider-level overrides.
    </p>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      Inherits the Select listbox semantics: <code class="text-text-primary">role="listbox"</code>,
      <code class="text-text-primary">aria-expanded</code> and
      <code class="text-text-primary">aria-selected</code>, plus a trigger
      <code class="text-text-primary">aria-label</code>.
    </Note>
    <Note title="Keyboard">
      <Kbd keys="↑" />
      <Kbd keys="↓" />
      navigate,
      <Kbd keys="Enter" />
      selects,
      <Kbd keys="Esc" />
      closes.
    </Note>
    <Note title="Localized names">
      Each option's language name is shown in the current language.
    </Note>
  </NoteList>
</Section>
