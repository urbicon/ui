<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { FormField } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: true, order: 1 },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: { include: true },
    meta: { title: 'FormField Component', showToc: true }
  };
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Wrapping a custom file input"
      description="The slot receives wiring metadata (id, describedBy, invalid, required, disabled). Spread or apply these so screen readers can find the label and any error/hint."
      code={`<FormField label="Document" required hint="PDF, JPG, PNG — max 10 MB">
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
      <FormField label="Document" required hint="PDF, JPG, PNG — max 10 MB">
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

<Section marker="02" id="customization" title="Customization">
  <div class="prose prose-sm max-w-none">
    <p>
      Built-in form primitives (<code>Input</code>, <code>Select</code>, <code>Textarea</code>)
      already render their own label + helper + error — there <em>FormField is not needed</em>. Use
      <code>FormField</code>
      only for composite controls that don't have those slots, e.g.
      <code>FileUpload</code>, custom number-spinner combinations, or media uploaders.
    </p>
  </div>
</Section>

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="prose prose-sm max-w-none">
    <ul>
      <li>
        The wrapper renders a <code>&lt;label for=…&gt;</code> linked to the slot's <code>id</code>.
      </li>
      <li>
        Hints get an <code>id</code> referenced via <code>aria-describedby</code>. When an error is
        present, the error message takes the spot (and the hint is hidden) — this matches WCAG
        guidance to surface the most actionable message to AT users.
      </li>
      <li>
        The error renders with <code>role="alert"</code> so it is announced when the value changes during
        validation.
      </li>
    </ul>
  </div>
</Section>
