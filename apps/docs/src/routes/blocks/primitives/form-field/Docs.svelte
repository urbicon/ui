<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { FormField } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Reach for <code class="text-text-primary">FormField</code> around a control that brings no
    label, helper or error of its own: a native file or colour input, a widget from somewhere else.
    The form blocks here take <code class="text-text-primary">label</code>,
    <code class="text-text-primary">helper</code> and <code class="text-text-primary">error</code>
    as props, so a <code class="text-text-primary">FormField</code> around one of them puts a second
    label above the first. The <code class="text-text-primary">children</code> snippet hands out a
    <code class="text-text-primary">FormFieldSlotContext</code>, and each of its fields reaches the
    control through a line you write.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Wrapping a native file input"
      description="`required` puts the asterisk on the label and appears in the snippet context. Whether the control enforces anything is down to the attribute you set on it, which is the same division of labour as for the id and the description."
      code={`<FormField label="Document" required helper="PDF, JPG or PNG, max 10 MB">
  {#snippet children({ id, describedBy, invalid, required })}
    <input
      {id}
      type="file"
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      {required}
    />
  {/snippet}
</FormField>`}
      language="svelte"
    >
      <FormField label="Document" required helper="PDF, JPG or PNG, max 10 MB">
        {#snippet children(ctx)}
          <input
            id={ctx.id}
            type="file"
            aria-describedby={ctx.describedBy}
            aria-invalid={ctx.invalid || undefined}
            required={ctx.required}
            class="border-border-subtle w-full rounded-md border px-3 py-2 text-sm"
          />
        {/snippet}
      </FormField>
    </CodeExample>

    <CodeExample
      title="A native control with an error"
      description="Setting `error` swaps the helper for the message, points `describedBy` at that message instead, and flips `invalid` for the control to pick up. `invalid` is a boolean, so pass it on as `invalid || undefined` unless you want an `aria-invalid=false` sitting in the markup."
      code={`<FormField label="Brand color" error="Pick a color with more contrast">
  {#snippet children({ id, describedBy, invalid })}
    <input
      {id}
      type="color"
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
    />
  {/snippet}
</FormField>`}
      language="svelte"
    >
      <FormField label="Brand color" error="Pick a color with more contrast">
        {#snippet children(ctx)}
          <input
            id={ctx.id}
            type="color"
            aria-describedby={ctx.describedBy}
            aria-invalid={ctx.invalid || undefined}
            class="border-border-subtle h-10 w-16 rounded-md border"
          />
        {/snippet}
      </FormField>
    </CodeExample>
  </div>
</Section>

<Section marker id="customization" title="Customization">
  <div class="space-y-3">
    <p class="text-text-secondary text-sm leading-relaxed">
      FormField takes <code class="text-text-primary">class</code> on its outer element and
      <code class="text-text-primary">slotClasses</code> keyed by
      <code class="text-text-primary">wrapper</code>, <code class="text-text-primary">label</code>,
      <code class="text-text-primary">helper</code> and
      <code class="text-text-primary">message</code>, which is the error. It carries no
      <code class="text-text-primary">tv()</code> config of its own, so
      <code class="text-text-primary">unstyled</code> and
      <code class="text-text-primary">preset</code> stop at this one block.
    </p>
    <p class="text-text-secondary text-sm leading-relaxed">
      See <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for the <code class="text-text-primary">class</code> and
      <code class="text-text-primary">slotClasses</code> contract shared across blocks.
    </p>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="One label, one control">
      <p>
        The <code class="text-text-primary">&lt;label for=…&gt;</code> points at the single
        <code class="text-text-primary">id</code> the snippet hands out, so a FormField labels one
        control. Two controls in one field want a
        <code class="text-text-primary">&lt;fieldset&gt;</code> with a legend instead, and a control
        that is not a labelable element wants
        <code class="text-text-primary">aria-labelledby</code> pointing at your own label.
      </p>
    </Note>
    <Note title="Errors are announced">
      <p>
        The error message renders with <code class="text-text-primary">role="alert"</code>, so a
        message that appears after a failed submit is read out without the user going looking for
        it.
      </p>
    </Note>
  </NoteList>
</Section>
