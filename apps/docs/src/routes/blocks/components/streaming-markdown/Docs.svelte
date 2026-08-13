<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { StaticMarkdown, WithCitations, UrlPolicy, CustomRenderer } from './examples';

  import staticMarkdownCode from './examples/StaticMarkdown.svelte?raw';
  import withCitationsCode from './examples/WithCitations.svelte?raw';
  import urlPolicyCode from './examples/UrlPolicy.svelte?raw';
  import customRendererCode from './examples/CustomRenderer.svelte?raw';
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Static markdown — tables and task lists"
      description="A settled answer renders GFM tables and task lists the same whether the text arrived all at once or streamed chunk by chunk. Set headingLevelStart so message headings stay out of the page outline."
      code={staticMarkdownCode}
    >
      <StaticMarkdown />
    </CodeExample>

    <CodeExample
      title="Citations from sources"
      description="Ids in the sources prop activate the matching [n] markers in the text; each becomes a CitationChip whose popover shows the title, snippet, and a policy-checked link. Markers without a matching id stay plain text."
      code={withCitationsCode}
    >
      <WithCitations />
    </CodeExample>

    <CodeExample
      title="Untrusted input stays inert"
      description="The renderer never emits an HTML string, so untrusted model output cannot inject markup. With the default URL policy, scheme-smuggled links become inert text, external images become an alt-text chip, and raw HTML stays literal text."
      code={urlPolicyCode}
    >
      <UrlPolicy />
    </CodeExample>

    <CodeExample
      title="Custom node renderer"
      description="A renderers snippet replaces the built-in renderer for one node type. Use it for syntax highlighting, lightboxes, or router-aware links; here, a custom code-block presentation."
      code={customRendererCode}
    >
      <CustomRenderer />
    </CodeExample>
  </div>
</Section>

<Section marker id="customization" title="Customization">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      Every element maps to a named slot (<code>paragraph</code>, <code>heading1</code>–<code
        >heading6</code
      >, <code>inlineCode</code>, <code>codeBlock</code>, <code>table</code>, …). Restyle any of
      them via <code>slotClasses</code>, or register a reusable look as a
      <code>preset</code> on <code>BlocksProvider</code>. Use <code>renderers</code> only when you
      need to replace a whole node type (highlighting, custom links); use
      <code>slotClasses</code> for pure styling.
    </p>
    <p>
      The <code>urlPolicy</code> is strict by default. Widen it narrowly: allow a specific image CDN
      via <code>allowedImagePrefixes</code> rather than a broad prefix. Keep the policy object referentially
      stable; a new reference re-parses the whole content.
    </p>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Heading hierarchy">
      <p>
        Markdown <code class="text-text-primary">#</code> maps to the DOM level set by
        <code class="text-text-primary">headingLevelStart</code> (deeper levels shift along, clamped
        at <code class="text-text-primary">h6</code>). In a chat surface set it to
        <code class="text-text-primary">3</code> so a message's own headings slot beneath the page
        <code class="text-text-primary">&lt;h1&gt;</code> instead of competing with it. Visual sizing
        keeps following the author's level independently.
      </p>
    </Note>
    <Note title="Streaming cursor">
      <p>
        The pulsing cursor shown while <code class="text-text-primary">streaming</code> is
        <code class="text-text-primary">true</code> is decorative and carries
        <code class="text-text-primary">aria-hidden="true"</code>, so screen readers announce only
        the text. Its pulse is gated on
        <code class="text-text-primary">motion-safe:</code>, so it holds still under
        <code class="text-text-primary">prefers-reduced-motion</code>.
      </p>
    </Note>
    <Note title="Scrollable tables">
      <p>
        Wide tables scroll inside a focusable region (<code class="text-text-primary"
          >tabindex="0"</code
        >) labelled by <code class="text-text-primary">tableRegionLabel</code>, so keyboard users
        can reach and scroll the overflow (WCAG 2.1.1). Horizontal scroll stays inside the block —
        never the page.
      </p>
    </Note>
    <Note title="Blocked links and images">
      <p>
        A policy-blocked link renders as inert text with a dotted underline as the "this was a link"
        cue; a blocked image becomes an alt-text chip. The blocked state is visible, so the reader
        can tell something was withheld.
      </p>
    </Note>
  </NoteList>
</Section>
