<script lang="ts">
  // Regression fixture for `codeExamplePlugin`. Every example below is a shape
  // that the previous `<CodeExample([^>]*)>` regex mis-parsed. Real, compiler-valid
  // Svelte on purpose: the plugin runs Svelte's parser, so a hand-written string
  // could drift from what the compiler actually accepts.
  import CodeExample from '../../components/CodeExample/CodeExample.svelte';
</script>

<!-- Facet 1: a literal `>` inside a code={`…`} template literal. The old regex's
     [^>]* stopped at the `>` in `{#if count > 0}`, so the open tag "ended" early. -->
<CodeExample title="Literal gt in a template literal" code={`{#if count > 0}many{/if}`} />

<!-- Facet 2: a self-closing example has no </CodeExample>; the old non-greedy match
     ran on to the NEXT example's closing tag and swallowed it whole. -->
<CodeExample title="Self-closing with explicit code" code={`<Button>Setup</Button>`} />

<!-- …which silently killed this one's extraction. It must still be extracted. -->
<CodeExample title="Isolate after a self-closing example" isolate>
  <span data-testid="after-self-closing">extract me</span>
</CodeExample>

<!-- Both facets combined: literal `>` AND self-closing, followed by an isolate example. -->
<CodeExample title="Both facets" code={`{#each items as i}<i>{i > 1}</i>{/each}`} />

<CodeExample title="Isolate after both facets" isolate>
  <span data-testid="after-both-facets">extract me too</span>
</CodeExample>

<!-- A multi-attribute open tag spanning lines, with the `>` of a generic in an
     attribute value — the insertion point must stay inside the open tag. -->
<CodeExample
  title="Multi-line open tag"
  description={`Map<string, number> in a description`}
  isolate
>
  <span data-testid="multi-line-open-tag">nested</span>
</CodeExample>

<!-- Children carrying a template literal + `${}`: must survive escaping intact. -->
<CodeExample title="Escaping" isolate>
  <span data-testid="escaping">{`a ${1 + 1} b`}</span>
</CodeExample>

<!-- Opt-outs: an explicit `code` prop wins, and a non-isolate example is untouched. -->
<CodeExample title="Explicit code wins" isolate code={`<span>explicit</span>`}>
  <span data-testid="explicit">ignored by the extractor</span>
</CodeExample>

<CodeExample title="Not isolated">
  <span data-testid="not-isolated">no extraction</span>
</CodeExample>

<!-- Fail-loud: asks for extraction, has nothing to extract. -->
<CodeExample title="Self-closing isolate" isolate />
