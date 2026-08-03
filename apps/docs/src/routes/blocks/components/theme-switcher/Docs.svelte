<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Kbd, ThemeSwitcher, Toggle } from '@urbicon-ui/blocks';
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Cycle vs. toggle"
      description="Default cycles light → dark → system. Pass strategy='toggle' to flip between light and dark only."
      isolate
      previewClass="flex items-center gap-4"
    >
      <ThemeSwitcher />
      <ThemeSwitcher strategy="toggle" />
    </CodeExample>

    <CodeExample title="Variants and sizes" isolate previewClass="flex items-center gap-4">
      <ThemeSwitcher variant="ghost" size="sm" />
      <ThemeSwitcher variant="outlined" size="md" />
      <ThemeSwitcher variant="filled" size="lg" />
    </CodeExample>

    <CodeExample
      title="In a settings panel"
      description="Realistic use — outlined trigger inline with related appearance preferences."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <div
        class="bg-surface-elevated border-border-subtle w-full overflow-hidden rounded-2xl border"
      >
        <div class="border-border-subtle border-b px-5 py-3">
          <h3 class="text-text-primary text-sm font-semibold">Appearance</h3>
        </div>
        <div class="divide-border-subtle divide-y">
          <div class="flex items-center justify-between px-5 py-3">
            <p class="text-text-primary text-sm font-medium">Color theme</p>
            <ThemeSwitcher variant="outlined" size="sm" />
          </div>
          <div class="flex items-center justify-between px-5 py-3">
            <p class="text-text-primary text-sm font-medium">Reduce motion</p>
            <Toggle size="sm" intent="primary" />
          </div>
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="customization" title="Customization">
  <CodeExample
    title="Branded trigger"
    description="Override the button and icon slots for a gradient brand-look. Pass storageKey={false} for ephemeral switching without persistence."
    isolate
    previewClass="flex items-center gap-4"
  >
    <ThemeSwitcher
      slotClasses={{
        button:
          'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white hover:from-violet-600 hover:to-fuchsia-600 shadow-md shadow-violet-500/20',
        icon: 'h-5 w-5'
      }}
    />
  </CodeExample>
</Section>

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <p class="text-text-secondary text-sm leading-relaxed">
      The trigger carries a dynamic
      <code class="text-text-primary">aria-label</code> and
      <code class="text-text-primary">title</code> that name the active theme ("Light mode" / "Dark
      mode" / "System theme"). Focusable via
      <Kbd keys="Tab" />, activated with
      <Kbd keys="Enter" />
      /
      <Kbd keys="Space" />; uses
      <code class="text-text-primary">focus-visible:</code> for keyboard-only rings. In system mode
      the UI live-follows
      <code class="text-text-primary">prefers-color-scheme</code> changes natively via
      <code class="text-text-primary">color-scheme: light dark</code> — no JavaScript needed.
    </p>
  </div>
</Section>
