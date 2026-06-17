<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Skeleton, Card } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['variant', 'size', 'animation', 'count', 'width', 'height', 'unstyled'],
        defaults: { variant: 'text', size: 'md', animation: 'pulse' },
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
    meta: { title: 'Skeleton Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Text Placeholder"
      description="Multi-line text loading state via the `count` prop — the most common pattern for paragraphs and copy blocks."
      isolate
      previewClass="w-full max-w-sm"
    >
      <Skeleton variant="text" count={4} />
    </CodeExample>

    <CodeExample
      title="Profile Card"
      description="Avatar + text combo with a trailing action button — a complete loading state for user cards."
      isolate
      previewClass="flex justify-center w-full"
    >
      <Card padding="lg" class="w-full max-w-xs">
        <div class="mb-4 flex items-center gap-3">
          <Skeleton variant="circular" size="lg" />
          <div class="flex flex-1 flex-col gap-2">
            <Skeleton variant="text" size="sm" class="w-3/4" />
            <Skeleton variant="text" size="xs" class="w-1/2" />
          </div>
        </div>
        <Skeleton variant="text" count={3} />
        <div class="mt-4">
          <Skeleton variant="rounded" width="96px" height="32px" />
        </div>
      </Card>
    </CodeExample>

    <CodeExample
      title="Table Rows"
      description="Repeat a row of skeletons to mirror tabular content while data is fetched."
      isolate
      previewClass="w-full"
    >
      <div
        class="border-border-subtle bg-surface-elevated w-full overflow-hidden rounded-xl border"
      >
        {#each [0, 1, 2, 3] as _, i (i)}
          <div
            class="border-border-subtle grid grid-cols-[1fr_1fr_120px_80px] items-center gap-4 px-4 py-3 [&:not(:last-child)]:border-b"
          >
            <Skeleton variant="text" size="sm" class="w-3/4" />
            <Skeleton variant="text" size="sm" class="w-5/6" />
            <Skeleton variant="rounded" width="80px" height="20px" />
            <Skeleton variant="text" size="sm" class="w-12" />
          </div>
        {/each}
      </div>
    </CodeExample>

    <CodeExample
      title="Content Feed"
      description="List-item placeholder for article previews, search results, or any vertical feed."
      isolate
      previewClass="flex flex-col gap-5 w-full max-w-md"
    >
      {#each [0, 1, 2] as _, i (i)}
        <div class="flex gap-4">
          <Skeleton variant="rounded" class="h-20 w-20 shrink-0" />
          <div class="flex flex-1 flex-col gap-2">
            <Skeleton variant="text" size="sm" class="w-5/6" />
            <Skeleton variant="text" size="xs" class="w-full" />
            <Skeleton variant="text" size="xs" class="w-2/3" />
          </div>
        </div>
      {/each}
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Slot Overrides"
      description="Use slotClasses to restyle the base element and the wrapper between multi-line items."
      isolate
      previewClass="flex flex-col gap-6 w-full max-w-sm"
    >
      <Skeleton
        variant="rectangular"
        size="sm"
        slotClasses={{ base: 'bg-primary/10 rounded-2xl' }}
      />
      <Skeleton
        variant="text"
        count={3}
        slotClasses={{
          base: 'bg-success/10 rounded-full',
          wrapper: 'gap-3'
        }}
      />
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Drop all defaults and build unique placeholder shapes — e.g. for dark, branded surfaces."
      isolate
      previewClass="flex flex-col gap-4 rounded-xl bg-neutral-950 px-8 py-6 w-full max-w-sm"
    >
      <div class="flex items-center gap-3">
        <Skeleton
          unstyled
          class="h-12 w-12 shrink-0 animate-pulse rounded-full bg-white/5 ring-1 ring-white/10"
        />
        <div class="flex flex-1 flex-col gap-2">
          <Skeleton
            unstyled
            class="h-4 w-3/4 animate-pulse rounded-full bg-linear-to-r from-white/10 via-white/5 to-white/10"
          />
          <Skeleton
            unstyled
            class="h-3 w-1/2 animate-pulse rounded-full bg-linear-to-r from-white/10 via-white/5 to-white/10 [animation-delay:150ms]"
          />
        </div>
      </div>
      <Skeleton
        unstyled
        class="h-32 w-full animate-pulse rounded-xl bg-white/5 ring-1 ring-white/10 [animation-delay:300ms]"
      />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Screen Reader</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Uses <code class="text-text-primary">role="status"</code> with
          <code class="text-text-primary">aria-label="Loading"</code>. A visually hidden "Loading…"
          text ensures screen readers announce the placeholder's purpose. When
          <code class="text-text-primary">count &gt; 1</code>, individual items are marked
          <code class="text-text-primary">aria-hidden="true"</code> so only the wrapper is announced.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Both <code class="text-text-primary">pulse</code> and
          <code class="text-text-primary">wave</code> animations respect
          <code class="text-text-primary">prefers-reduced-motion: reduce</code> via Tailwind's
          <code class="text-text-primary">motion-reduce:</code> variant. The skeleton still renders as
          a static colored block to indicate loading.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Semantic Role</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The <code class="text-text-primary">role="status"</code> attribute identifies the skeleton as
          a live region, allowing assistive technology to announce when loading completes and content
          replaces the placeholder.
        </p>
      </div>
    </div>
  </div>
</Section>
