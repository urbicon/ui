<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { FormField } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Wrapping a custom file input"
      description="The slot receives wiring metadata (id, describedBy, invalid, required, disabled). Spread or apply these so screen readers can find the label and any error/helper text."
      code={`<FormField label="Document" required helper="PDF, JPG, PNG — max 10 MB">
  {#snippet children({ id, describedBy, invalid, required })}
    <input
      {id}
      type="file"
      aria-describedby={describedBy}
      aria-invalid={invalid}
      {required}
    />
  {/snippet}
</FormField>`}
      language="svelte"
    >
      <FormField label="Document" required helper="PDF, JPG, PNG — max 10 MB">
        {#snippet children(ctx)}
          <input
            id={ctx.id}
            type="file"
            aria-describedby={ctx.describedBy}
            aria-invalid={ctx.invalid}
            required={ctx.required}
            class="border-border-subtle w-full rounded-md border px-3 py-2 text-sm"
          />
        {/snippet}
      </FormField>
    </CodeExample>

    <CodeExample
      title="With error"
      code={`<FormField label="Document" error="Required" required>
  {#snippet children({ id, describedBy, invalid })}
    <input {id} type="file" aria-describedby={describedBy} aria-invalid={invalid} />
  {/snippet}
</FormField>`}
      language="svelte"
    >
      <FormField label="Document" error="Required" required>
        {#snippet children(ctx)}
          <input
            id={ctx.id}
            type="file"
            aria-describedby={ctx.describedBy}
            aria-invalid={ctx.invalid}
            class="border-border-subtle w-full rounded-md border px-3 py-2 text-sm"
          />
        {/snippet}
      </FormField>
    </CodeExample>
  </div>
</Section>

<Section marker id="customization" title="Customization">
  <div class="space-y-3">
    <p class="text-text-secondary text-sm leading-relaxed">
      Built-in form primitives (<code class="text-text-primary">Input</code>,
      <code class="text-text-primary">Select</code>,
      <code class="text-text-primary">Textarea</code>) already render their own label + helper +
      error — <em>FormField is not needed there</em>. Use
      <code class="text-text-primary">FormField</code> only for composite controls that don't have
      those slots, e.g. <code class="text-text-primary">FileUpload</code>, custom number-spinner
      combinations, or media uploaders.
    </p>
    <p class="text-text-secondary text-sm leading-relaxed">
      FormField is a documented deviation from the standard styling contract: as a bare layout
      wrapper without a <code class="text-text-primary">tv()</code> config it has no
      <code class="text-text-primary">unstyled</code> mode and no
      <code class="text-text-primary">preset</code> support. Restyle it via
      <code class="text-text-primary">class</code> (the wrapper element) and
      <code class="text-text-primary">slotClasses</code> with the hand-maintained keys
      <code class="text-text-primary">wrapper</code>, <code class="text-text-primary">label</code>,
      <code class="text-text-primary">message</code>, and
      <code class="text-text-primary">helper</code> — e.g. a bolder label via the
      <code class="text-text-primary">label</code> key. The wrapped control keeps its own styling
      API. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a> for the
      general contract.
    </p>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Label association">
      <p>
        The wrapper renders a <code class="text-text-primary">&lt;label for=…&gt;</code> linked to
        the slot's <code class="text-text-primary">id</code>.
      </p>
    </Note>
    <Note title="Description and error share one slot">
      <p>
        Helper text gets an <code class="text-text-primary">id</code> referenced via
        <code class="text-text-primary">aria-describedby</code>. When an error is present the error
        message takes the spot and the helper is hidden — this matches WCAG guidance to surface the
        most actionable message to AT users.
      </p>
    </Note>
    <Note title="Errors are announced">
      <p>
        The error renders with <code class="text-text-primary">role="alert"</code>, so it is
        announced when the value changes during validation.
      </p>
    </Note>
  </NoteList>
</Section>
