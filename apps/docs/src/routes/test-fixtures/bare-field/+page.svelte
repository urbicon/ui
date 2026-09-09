<script lang="ts">
  // Playwright fixture for e2e/bare-field.spec.ts: the four fields that carry
  // `bare`, each beside its `ghost` twin as the control. `bare` is the one
  // variant whose whole definition is what the browser computes — no frame, no
  // fill, no padding, and a focus indicator that has to survive a fold in which
  // the base slot says `outline-none`. Not part of the docs nav.
  //
  // Every probe carries its own focus anchor: `:focus-visible` is what the
  // library styles, and a programmatic `.focus()` does not set it on a button.
  // Focusing the anchor and pressing Tab makes the next focus a keyboard one,
  // which does.
  import { Combobox, Input, Select, Textarea } from '@urbicon-ui/blocks';

  const options = [
    { label: 'Berlin', value: 'berlin' },
    { label: 'Lisbon', value: 'lisbon' }
  ];

  // One label wider than the 240px box, so the trigger text reaches the edge.
  const longOptions = [
    {
      label: 'A label long enough to run the whole width of this narrow field and then some',
      value: 'long'
    }
  ];
</script>

{#snippet anchor(name: string)}
  <button type="button" data-anchor={name} class="text-text-tertiary block text-xs">anchor</button>
{/snippet}

<div class="bg-surface-base min-h-screen space-y-6 p-6" data-testid="bare-field-fixtures">
  <h1 class="text-text-primary text-xl font-bold">Bare field fixtures</h1>

  <div class="max-w-md space-y-2" data-probe="input-bare">
    {@render anchor('input-bare')}
    <Input variant="bare" aria-label="Bare input" placeholder="bare" />
  </div>

  <div class="max-w-md space-y-2" data-probe="input-ghost">
    {@render anchor('input-ghost')}
    <Input variant="ghost" aria-label="Ghost input" placeholder="ghost" />
  </div>

  <div class="max-w-md space-y-2" data-probe="input-bare-error">
    {@render anchor('input-bare-error')}
    <Input variant="bare" aria-label="Invalid bare input" error="Required" />
  </div>

  <div class="max-w-md space-y-2" data-probe="textarea-bare">
    {@render anchor('textarea-bare')}
    <Textarea variant="bare" aria-label="Bare textarea" placeholder="bare" />
  </div>

  <div class="max-w-md space-y-2" data-probe="textarea-ghost">
    {@render anchor('textarea-ghost')}
    <Textarea variant="ghost" aria-label="Ghost textarea" placeholder="ghost" />
  </div>

  <div class="max-w-md space-y-2" data-probe="select-bare">
    {@render anchor('select-bare')}
    <Select variant="bare" aria-label="Bare select" {options} />
  </div>

  <div class="max-w-md space-y-2" data-probe="select-ghost">
    {@render anchor('select-ghost')}
    <Select variant="ghost" aria-label="Ghost select" {options} />
  </div>

  <div class="max-w-md space-y-2" data-probe="combobox-bare">
    {@render anchor('combobox-bare')}
    <Combobox variant="bare" aria-label="Bare combobox" {options} />
  </div>

  <div class="max-w-md space-y-2" data-probe="combobox-ghost">
    {@render anchor('combobox-ghost')}
    <Combobox variant="ghost" aria-label="Ghost combobox" {options} />
  </div>

  <!-- The clear-control lane: a narrow box and a value long enough to reach the
       button, so the spec can ask whether the text ends before it starts. -->
  <div class="w-[240px] space-y-2" data-probe="select-bare-clearable">
    {@render anchor('select-bare-clearable')}
    <Select
      variant="bare"
      clearable
      aria-label="Bare clearable select"
      value="long"
      options={longOptions}
    />
  </div>

  <div class="w-[240px] space-y-2" data-probe="select-outlined-clearable">
    {@render anchor('select-outlined-clearable')}
    <Select
      variant="outlined"
      clearable
      aria-label="Outlined clearable select"
      value="long"
      options={longOptions}
    />
  </div>

  <div class="w-[240px] space-y-2" data-probe="combobox-bare-value">
    {@render anchor('combobox-bare-value')}
    <Combobox
      variant="bare"
      clearable
      aria-label="Bare combobox with a value"
      options={longOptions}
    />
  </div>
</div>
