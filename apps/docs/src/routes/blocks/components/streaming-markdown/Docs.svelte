<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { StaticMarkdown, WithCitations, UrlPolicy, CustomRenderer } from './examples';

  import staticMarkdownCode from './examples/StaticMarkdown.svelte?raw';
  import withCitationsCode from './examples/WithCitations.svelte?raw';
  import urlPolicyCode from './examples/UrlPolicy.svelte?raw';
  import customRendererCode from './examples/CustomRenderer.svelte?raw';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['size', 'streaming'],
        defaults: { size: 'md', streaming: true },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'StreamingMarkdown Component', showToc: true }
  };
</script>

<Section marker="01" id="examples" title="Examples">
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
      title="Hostile input, neutralized"
      description="Untrusted model output is safe by construction: the renderer never emits an HTML string. The strict-by-default URL policy turns scheme-smuggled links into inert text, blocks external images to an alt-text chip, and leaves raw HTML as literal text — no configuration required."
      code={urlPolicyCode}
    >
      <UrlPolicy />
    </CodeExample>

    <CodeExample
      title="Custom node renderer"
      description="A renderers snippet fully replaces the built-in renderer for one node type — the dependency-free hook point for syntax highlighting, lightboxes, or router-aware links. Here a custom code-block presentation."
      code={customRendererCode}
    >
      <CustomRenderer />
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="customization" title="Customization">
  <div class="prose prose-sm max-w-none">
    <p>
      Every element maps to a named slot (<code>paragraph</code>, <code>heading1</code>–<code
        >heading6</code
      >, <code>inlineCode</code>, <code>codeBlock</code>, <code>table</code>, …). Restyle any of
      them via <code>slotClasses</code>, or register a reusable look as a
      <code>preset</code> on <code>BlocksProvider</code>. Reach for <code>renderers</code> only when
      you need to replace a whole node type (highlighting, custom links); use
      <code>slotClasses</code> for pure styling.
    </p>
    <p>
      The <code>urlPolicy</code> is strict by default. Widen it deliberately and narrowly — allow a
      specific image CDN via <code>allowedImagePrefixes</code>, never a broad prefix. Keep the
      policy object referentially stable; a new reference re-parses the whole content.
    </p>
  </div>
</Section>

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Heading hierarchy</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Markdown <code class="text-text-primary">#</code> maps to the DOM level set by
          <code class="text-text-primary">headingLevelStart</code> (deeper levels shift along,
          clamped at <code class="text-text-primary">h6</code>). In a chat surface set it to
          <code class="text-text-primary">3</code> so a message's own headings slot beneath the page
          <code class="text-text-primary">&lt;h1&gt;</code> instead of competing with it. Visual sizing
          keeps following the author's level independently.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Streaming cursor</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The pulsing cursor shown while <code class="text-text-primary">streaming</code> is
          <code class="text-text-primary">true</code> is decorative and carries
          <code class="text-text-primary">aria-hidden="true"</code>, so screen readers announce only
          the text. Its pulse is gated on
          <code class="text-text-primary">motion-safe:</code>, so it holds still under
          <code class="text-text-primary">prefers-reduced-motion</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Scrollable tables</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Wide tables scroll inside a focusable region (<code class="text-text-primary"
            >tabindex="0"</code
          >) labelled by <code class="text-text-primary">tableRegionLabel</code>, so keyboard users
          can reach and scroll the overflow (WCAG 2.1.1). Horizontal scroll stays inside the block —
          never the page.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Blocked links and images</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          A policy-blocked link renders as inert text with a dotted underline as the "this was a
          link" cue; a blocked image becomes an alt-text chip. The blocked state is visible, not
          silent — the reader can tell something was withheld.
        </p>
      </div>
    </div>
  </div>
</Section>
