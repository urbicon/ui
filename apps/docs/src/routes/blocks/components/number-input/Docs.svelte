<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, NumberInput } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let quantity = $state(1);
  let rate = $state(0.15);
  let servings = $state(4);
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Quantity in a line item"
      description="The canonical use: a bounded integer the user nudges rather than types. `min` keeps it out of negatives, `max` caps it at what is in stock, and the stepper clamps immediately instead of waiting for blur."
      isolate
      previewClass="flex max-w-xs flex-col gap-4"
    >
      <NumberInput label="Quantity" bind:value={quantity} min={0} max={99} step={1} />
    </CodeExample>

    <CodeExample
      title="Decimal rate with fixed precision"
      description="`step` and `precision` are separate: `step` is how far one press moves, `precision` is how many decimals are displayed and rounded to. Without `precision` the value shows as typed and the step's own decimals drive the rounding."
      isolate
      previewClass="flex max-w-xs flex-col gap-4"
    >
      <NumberInput
        label="Commission rate"
        bind:value={rate}
        min={0}
        max={1}
        step={0.05}
        precision={2}
        helper="Between 0 and 1"
      />
    </CodeExample>

    <CodeExample
      title="Without the stepper"
      description="`hideStepper` removes the buttons but not the behaviour — Arrow keys and the wheel still step. Useful in a dense row where two more hit targets per field would crowd the layout."
      isolate
      previewClass="flex max-w-xs flex-col gap-4"
    >
      <NumberInput label="Servings" bind:value={servings} min={1} max={12} hideStepper />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      <code class="text-text-primary">NumberInput</code> wraps
      <code class="text-text-primary">&lt;Input&gt;</code>, so
      <code class="text-text-primary">size</code>, <code class="text-text-primary">variant</code>,
      <code class="text-text-primary">label</code>, <code class="text-text-primary">helper</code>,
      <code class="text-text-primary">error</code> and the Input
      <code class="text-text-primary">slotClasses</code> keys all behave exactly as they do there.
      What it does not forward is deliberate: the numeric event handlers, the raw string
      <code class="text-text-primary">value</code>, the fixed
      <code class="text-text-primary">type</code>/<code class="text-text-primary">inputmode</code>,
      and
      <code class="text-text-primary">clearable</code> — Input's clear button would replace the stepper
      and write only Input's internal string, drifting the numeric model out of sync.
    </p>
    <p>
      <code class="text-text-primary">rightIcon</code> replaces the stepper with an adornment of
      your own. Pair it with <code class="text-text-primary">hideStepper</code> or supply your own
      controls — otherwise the field loses its increment affordance while keeping the keyboard one.
      See <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for the general contract.
    </p>
    <p>
      For money use
      <a href={resolve('/blocks/components/currency-input')} class="text-primary hover:underline"
        >CurrencyInput</a
      >
      instead: it stores minor units, so summing and comparison stay exact. NumberInput's values are plain
      numbers and carry the usual float caveats.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Spinbutton semantics">
      <p>
        The field is a <code class="text-text-primary">role="spinbutton"</code> carrying
        <code class="text-text-primary">aria-valuenow</code>,
        <code class="text-text-primary">aria-valuemin</code> and
        <code class="text-text-primary">aria-valuemax</code>, so assistive tech announces both the
        current value and the range it sits in.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="↑" /> / <Kbd keys="↓" /> step by <code class="text-text-primary">step</code> and
        clamp immediately. Typing is free-form while focused — a leading
        <code class="text-text-primary">-</code> and a single decimal separator (<code
          class="text-text-primary">.</code
        >
        or <code class="text-text-primary">,</code>) are both accepted — and the value clamps to the
        range on blur.
      </p>
    </Note>
    <Note title="The steppers stay out of the tab order">
      <p>
        Both stepper buttons carry <code class="text-text-primary">aria-hidden</code> and
        <code class="text-text-primary">tabindex="-1"</code>. The
        <code class="text-text-primary">spinbutton</code> role already exposes increment and decrement
        on the field itself, so the buttons are the pointer affordance for what the Arrow keys do — not
        a second pair of tab stops.
      </p>
    </Note>
    <Note title="Numeric keyboard on mobile">
      <p>
        <code class="text-text-primary">inputmode="decimal"</code> is fixed, so mobile keyboards open
        the numeric pad with a decimal separator rather than the full alphabetic layout.
      </p>
    </Note>
    <Note title="The wheel only steers a focused field">
      <p>
        Wheel stepping is gated on focus. An unfocused field scrolled past in a long form would
        otherwise change its value while the user is only trying to reach the bottom of the page.
      </p>
    </Note>
  </NoteList>
</Section>
