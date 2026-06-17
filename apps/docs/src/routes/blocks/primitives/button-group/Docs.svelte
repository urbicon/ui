<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { ButtonGroup, Button } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'orientation',
          'variant',
          'intent',
          'size',
          'selection',
          'connected',
          'disabled'
        ],
        defaults: { variant: 'outlined', intent: 'neutral', size: 'md' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Button Group Component', showToc: true }
  };
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample title="Single Selection" isolate>
      <ButtonGroup selection="single" variant="outlined">
        <Button value="list">List</Button>
        <Button value="grid">Grid</Button>
        <Button value="cards">Cards</Button>
      </ButtonGroup>
    </CodeExample>

    <CodeExample title="Multiple Selection" isolate>
      <ButtonGroup selection="multiple" variant="outlined">
        <Button value="bold">Bold</Button>
        <Button value="italic">Italic</Button>
        <Button value="underline">Underline</Button>
      </ButtonGroup>
    </CodeExample>

    <CodeExample
      title="Variants"
      description="Each variant rendered with selection='single' so the active state is visible — adjacent filled buttons now show a hairline divider, ghost-active picks up a subtle ring + bold weight, outlined fills the active button."
      isolate
    >
      <div class="flex flex-wrap items-center gap-4">
        <ButtonGroup selection="single" value="1" variant="filled" intent="primary">
          <Button value="1">Filled</Button>
          <Button value="2">Group</Button>
        </ButtonGroup>
        <ButtonGroup selection="single" value="a" variant="outlined" intent="neutral">
          <Button value="a">Outlined</Button>
          <Button value="b">Group</Button>
        </ButtonGroup>
        <ButtonGroup selection="single" value="x" variant="ghost" intent="neutral">
          <Button value="x">Ghost</Button>
          <Button value="y">Group</Button>
        </ButtonGroup>
      </div>
    </CodeExample>

    <CodeExample title="Disconnected" isolate>
      <ButtonGroup connected={false} selection="single">
        <Button value="a">Option A</Button>
        <Button value="b">Option B</Button>
        <Button value="c">Option C</Button>
      </ButtonGroup>
    </CodeExample>

    <CodeExample title="Vertical" isolate>
      <ButtonGroup orientation="vertical" variant="outlined">
        <Button value="top">Top</Button>
        <Button value="mid">Middle</Button>
        <Button value="bot">Bottom</Button>
      </ButtonGroup>
    </CodeExample>

    <CodeExample title="Sizes" isolate>
      <div class="flex flex-wrap items-center gap-4">
        <ButtonGroup size="sm">
          <Button value="a">Small</Button>
          <Button value="b">Group</Button>
        </ButtonGroup>
        <ButtonGroup size="md">
          <Button value="a">Medium</Button>
          <Button value="b">Group</Button>
        </ButtonGroup>
        <ButtonGroup size="lg">
          <Button value="a">Large</Button>
          <Button value="b">Group</Button>
        </ButtonGroup>
      </div>
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Single-selection groups use
          <code class="text-text-primary">role="radiogroup"</code> with
          <code class="text-text-primary">role="radio"</code> +
          <code class="text-text-primary">aria-checked</code> on each button. Multiple-selection
          groups use
          <code class="text-text-primary">role="group"</code> with
          <code class="text-text-primary">role="checkbox"</code> +
          <code class="text-text-primary">aria-checked</code>. Provide
          <code class="text-text-primary">ariaLabel</code> when the group's purpose is not clear from
          context.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          moves focus between buttons.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          toggles selection.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Prop Inheritance</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <code class="text-text-primary">size</code>,
          <code class="text-text-primary">intent</code>,
          <code class="text-text-primary">variant</code>,
          <code class="text-text-primary">disabled</code>, and
          <code class="text-text-primary">mint</code> propagate to child Buttons via context. A Button
          can override any inherited value by setting the prop directly.
        </p>
      </div>
    </div>
  </div>
</Section>
