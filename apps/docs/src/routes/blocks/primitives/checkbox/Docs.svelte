<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Checkbox } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Task list"
      description="Checkboxes inside a realistic task surface — the most common pattern for to-dos, settings, and bulk-selection rows."
      isolate
      previewClass="flex justify-center max-w-sm w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-1 rounded-2xl border p-4">
        <Checkbox checked label="Design system tokens" helper="Completed yesterday" />
        <Checkbox checked label="Component variants" />
        <Checkbox label="Documentation pages" />
        <Checkbox label="Accessibility audit" />
      </div>
    </CodeExample>

    <CodeExample
      title="Helper & error"
      description="Helper and error text follow the same form-field contract as Input — `error` overrides `helper` when both are set."
      isolate
      previewClass="flex flex-col gap-4"
    >
      <Checkbox label="Newsletter" helper="We send at most one email per week" />
      <Checkbox label="Terms" error="You must accept the terms to continue" intent="danger" />
    </CodeExample>
  </div>
</Section>

<!-- ─── Micro-Interactions ─── -->

<Section marker="02" id="mint" title="Micro-Interactions (Mint)">
  <div class="space-y-8">
    <CodeExample
      title="Mint Presets"
      description="Hover or click each checkbox to see the effect — mint targets the box, not the label."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <Checkbox mint="scale" label="Scale on hover" checked />
      <Checkbox mint="glow" label="Glow on hover" checked intent="success" />
      <Checkbox mint={['scale', 'glow']} label="Combined scale + glow" checked intent="danger" />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Slot Class Overrides"
      description="Per-instance slotClasses tweak individual slots without going fully unstyled. The box exposes data-state, so overrides can target only the checked state."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <Checkbox checked label="Rounded checkbox" slotClasses={{ box: 'rounded-full' }} />
      <Checkbox
        checked
        label="Larger box"
        slotClasses={{ box: 'w-7 h-7 rounded-md', icon: 'w-5 h-5' }}
      />
      <Checkbox
        checked
        label="Brand gradient when checked"
        slotClasses={{
          box: 'data-[state=checked]:border-transparent data-[state=checked]:bg-linear-to-br data-[state=checked]:from-violet-500 data-[state=checked]:to-fuchsia-500'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Strip all default styles with unstyled and rebuild from scratch — both instances share one slotClasses object. The box exposes data-state for conditional styling."
      isolate
      previewClass="flex min-h-24 flex-col justify-center gap-3"
    >
      {@const terminal = {
        control:
          'inline-flex cursor-pointer items-center gap-3 font-mono text-sm text-text-primary',
        box: 'flex h-5 w-5 items-center justify-center rounded border-2 border-current transition-colors data-[state=checked]:bg-text-primary data-[state=checked]:text-surface-base',
        icon: 'h-3.5 w-3.5',
        label: 'select-none'
      }}
      <Checkbox unstyled checked label="Remember me" slotClasses={terminal} />
      <Checkbox unstyled label="Stay signed in" slotClasses={terminal} />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      The shared <code class="text-text-primary">terminal</code> object above is a preset in spirit
      — for app-wide reuse, register it under
      <code class="text-text-primary">presets.Checkbox</code>
      on <code class="text-text-primary">BlocksProvider</code> and apply it with
      <code class="text-text-primary">preset</code> instead of importing a class map everywhere. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Native Semantics</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Built on a native <code class="text-text-primary">&lt;input type="checkbox"&gt;</code>
          for correct form behavior and assistive technology support. The
          <code class="text-text-primary">indeterminate</code> property automatically conveys the
          mixed state, and <code class="text-text-primary">aria-checked="mixed"</code> is set explicitly
          for maximum screen reader compatibility.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Labels &amp; Descriptions</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The <code class="text-text-primary">label</code> prop creates an associated
          <code class="text-text-primary">&lt;label&gt;</code>. Helper and error text are linked via
          <code class="text-text-primary">aria-describedby</code>, and errors set
          <code class="text-text-primary">aria-invalid</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          to focus,
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          to toggle. The focus ring uses
          <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility and
          appears on the checkbox box via the
          <code class="text-text-primary">peer</code> pattern.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Color Contrast</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Error and helper messages use text alongside color to convey state. The checkbox icon
          (check / minus) meets WCAG AA contrast against all intent backgrounds.
        </p>
      </div>
    </div>
  </div>
</Section>
