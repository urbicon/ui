<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { BasicUsage, TrackCopy, HeaderActions } from './examples';

  import basicUsageCode from './examples/BasicUsage.svelte?raw';
  import trackCopyCode from './examples/TrackCopy.svelte?raw';
  import headerActionsCode from './examples/HeaderActions.svelte?raw';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['lang', 'wrap', 'showCopy'],
        defaults: { wrap: false, showCopy: true },
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
    meta: { title: 'CodeBlock Component', showToc: true }
  };
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Multi-line code"
      description="Pass the code as a string. It renders as raw text — no built-in highlighting — and long lines scroll horizontally inside the block, never the page. The header shows the language label and a copy button."
      code={basicUsageCode}
    >
      <BasicUsage />
    </CodeExample>

    <CodeExample
      title="Track copies with onCopy"
      description="onCopy fires only after the clipboard write succeeds — the reliable hook for analytics like 'install command copied', with no clipboard polling."
      code={trackCopyCode}
    >
      <TrackCopy />
    </CodeExample>

    <CodeExample
      title="Extra header actions"
      description="The actions snippet renders custom controls in the header, to the left of the copy button — e.g. 'Run', 'Open in editor', or a language switch."
      code={headerActionsCode}
    >
      <HeaderActions />
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Copy button label</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The copy button carries an <code class="text-text-primary">aria-label</code> that swaps
          from <code class="text-text-primary">copyLabel</code> ("Copy code") to
          <code class="text-text-primary">copiedLabel</code> ("Copied") for two seconds after a successful
          copy, so its accessible name always matches what the user sees. A denied or failed clipboard
          write leaves the label untouched — the UI never falsely confirms a copy that did not happen.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Status announcement</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          A visually hidden <code class="text-text-primary">role="status"</code> region announces "Copied"
          to screen readers. A label change on the button the user just pressed is not a reliable announcement;
          a dedicated live region is, so the region ships in the DOM up front and only its text content
          changes.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Scrollable region</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The code body is a focusable
          <code class="text-text-primary">role="region"</code> (<code class="text-text-primary"
            >tabindex="0"</code
          >) labelled by the language, so keyboard users can reach and scroll horizontally
          overflowing code (WCAG 2.1.1). Focus rings use
          <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
        </p>
      </div>
    </div>
  </div>
</Section>
