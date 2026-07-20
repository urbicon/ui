<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Badge, Button } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let filters = $state<string[]>(['Active', 'Premium', 'Last 7 days']);
  const removeFilter = (f: string) => (filters = filters.filter((x) => x !== f));

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'label',
          'variant',
          'intent',
          'size',
          'counter',
          'pulse',
          'removable',
          'interactive',
          'border',
          'disabled'
        ],
        defaults: { variant: 'filled', intent: 'primary', size: 'md' },
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
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Badge Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Counter (numeric pill)"
      description="The counter prop locks min-width to height so single-digit numbers render as a circle. Compare a text badge with the same intent to see the effect."
      isolate
      previewClass="flex items-center gap-6"
    >
      <Badge intent="primary" size="sm">3 unread</Badge>
      <Badge intent="primary" counter size="sm">3</Badge>
      <Badge intent="danger" counter size="sm">12</Badge>
      <Badge intent="success" counter size="sm">99+</Badge>
    </CodeExample>

    <CodeExample
      title="Border (visual separation on colored surfaces)"
      description="The border prop adds a 2px ring in the page surface color — invisible on the default page background, but it cuts a clean halo when the badge overlays a colored avatar, image, or button."
      isolate
      previewClass="flex items-center gap-8"
    >
      <div
        class="bg-primary relative flex h-16 w-16 items-center justify-center rounded-full text-white"
      >
        JD
        <Badge intent="success" variant="dot" placement="bottom-end" />
      </div>
      <div
        class="bg-primary relative flex h-16 w-16 items-center justify-center rounded-full text-white"
      >
        JD
        <Badge intent="success" variant="dot" placement="bottom-end" border />
      </div>
      <div
        class="bg-warning relative flex h-16 w-16 items-center justify-center rounded-full text-white"
      >
        AB
        <Badge intent="danger" counter placement="top-end" border size="sm">5</Badge>
      </div>
    </CodeExample>

    <CodeExample title="Notification Counter" isolate previewClass="flex items-center gap-8">
      <div class="relative inline-block">
        <Button variant="outlined" intent="neutral">Inbox</Button>
        <Badge intent="danger" counter placement="top-end" border size="sm">3</Badge>
      </div>
      <div class="relative inline-block">
        <Button variant="outlined" intent="neutral">Updates</Button>
        <Badge intent="primary" counter placement="top-end" border size="sm">12</Badge>
      </div>
      <div class="relative inline-block">
        <Button variant="outlined" intent="neutral">Alerts</Button>
        <Badge intent="success" variant="dot" placement="top-end" border />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Patterns ─── -->

<Section marker="02" id="patterns" title="Patterns">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Badge serves five distinct use cases that look alike but behave differently. Picking the right
    pattern up-front avoids API-shape regret later — particularly around removable vs interactive,
    counter sizing, and placement-anchoring. A future <code class="text-text-primary">purpose</code>
    axis (<code class="text-text-primary">tag</code> /
    <code class="text-text-primary">counter</code>
    /
    <code class="text-text-primary">dot</code> / <code class="text-text-primary">chip</code>) will
    make this taxonomy first-class; until then, the five patterns below are the canonical reference.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="1. Status Tag — stateful label"
      description="Communicate the current state of an entity (Active/Inactive, Draft/Published, Online/Offline). Use `variant=soft` for ambient lists, `variant=outlined` for higher-contrast tables. Never removable, never a number."
      isolate
      previewClass="flex items-center gap-3"
    >
      <Badge variant="soft" intent="success">Active</Badge>
      <Badge variant="soft" intent="warning">Pending</Badge>
      <Badge variant="soft" intent="danger">Suspended</Badge>
      <Badge variant="outlined" intent="neutral">Draft</Badge>
      <Badge variant="outlined" intent="primary">Published</Badge>
    </CodeExample>

    <CodeExample
      title="2. Counter — numeric pill"
      description="`counter` locks the badge to a circle/pill geometry that holds 1–3 digits cleanly. Always pair with a `placement` when anchoring to a Button or Avatar — see the Notification Counter example above."
      isolate
      previewClass="flex items-center gap-3"
    >
      <Badge intent="primary" counter size="sm">3</Badge>
      <Badge intent="danger" counter size="sm">12</Badge>
      <Badge intent="success" counter size="sm">99+</Badge>
      <Badge intent="warning" counter>247</Badge>
    </CodeExample>

    <CodeExample
      title="3. Indicator Dot — presence/state marker"
      description="`variant=dot` strips all content and shrinks the badge to a presence indicator — typical on avatars (online/away/busy) or buttons (unread bell). Pair with `border` when overlaying a colored surface to cut a clean halo."
      isolate
      previewClass="flex items-center gap-6"
    >
      <div
        class="bg-primary-subtle text-primary-emphasis relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
      >
        JD
        <Badge intent="success" variant="dot" placement="bottom-end" border />
      </div>
      <div
        class="bg-warning-subtle text-warning-emphasis relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
      >
        AB
        <Badge intent="warning" variant="dot" placement="bottom-end" border />
      </div>
      <div
        class="bg-danger-subtle text-danger-emphasis relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
      >
        MK
        <Badge intent="danger" variant="dot" placement="bottom-end" border />
      </div>
    </CodeExample>

    <CodeExample
      title="4. Filter Chip — removable, user-applied"
      description="Use `removable` to show user-applied filters or selected tags that can be dismissed. Pair with `onRemove`. Press Delete / Backspace while focused to remove via keyboard."
      isolate
      previewClass="flex flex-wrap items-center gap-2"
    >
      {#each filters as filter (filter)}
        <Badge
          variant="soft"
          intent="primary"
          removable
          onRemove={() => removeFilter(filter)}
          size="sm"
        >
          {filter}
        </Badge>
      {/each}
      {#if filters.length === 0}
        <span class="text-text-tertiary text-sm">No filters · </span>
        <button
          class="text-primary text-sm underline"
          onclick={() => (filters = ['Active', 'Premium', 'Last 7 days'])}
        >
          reset
        </button>
      {/if}
    </CodeExample>

    <CodeExample
      title="5. Inline Label — categorization in prose"
      description="Plain, read-only marker rendered inside a sentence or list item. Prefer `variant=outlined` or `variant=soft` over `filled` so the badge reads as taxonomy, not as a state change."
      isolate
    >
      <p class="text-text-secondary text-sm leading-loose">
        The <Badge variant="outlined" intent="neutral" size="sm">Beta</Badge> release adds support for
        <Badge variant="soft" intent="primary" size="sm">OKLCH</Badge>
        color tokens and a redesigned
        <Badge variant="soft" intent="success" size="sm">Tier API</Badge>. Existing consumers can
        opt-in per component.
      </p>
    </CodeExample>

    <div class="border-border-subtle bg-surface-elevated mt-6 rounded-2xl border p-6">
      <h4 class="text-text-primary mb-3 text-sm font-semibold">When to pick which</h4>
      <div class="overflow-x-auto">
        <table class="text-text-secondary w-full text-left text-sm">
          <thead class="border-border-subtle text-text-primary border-b">
            <tr>
              <th class="py-2 pr-4 font-semibold">Pattern</th>
              <th class="py-2 pr-4 font-semibold">Key Prop</th>
              <th class="py-2 font-semibold">Recommended Variant</th>
            </tr>
          </thead>
          <tbody class="divide-border-subtle divide-y">
            <tr>
              <td class="py-2 pr-4 font-medium">Status Tag</td>
              <td class="py-2 pr-4">
                <code class="text-text-primary">variant</code>
              </td>
              <td class="py-2"
                ><code class="text-text-primary">soft</code> or
                <code class="text-text-primary">outlined</code></td
              >
            </tr>
            <tr>
              <td class="py-2 pr-4 font-medium">Counter</td>
              <td class="py-2 pr-4">
                <code class="text-text-primary">counter</code> ·
                <code class="text-text-primary">placement</code>
              </td>
              <td class="py-2"><code class="text-text-primary">filled</code></td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-medium">Indicator Dot</td>
              <td class="py-2 pr-4">
                <code class="text-text-primary">variant="dot"</code> ·
                <code class="text-text-primary">border</code>
              </td>
              <td class="py-2"><code class="text-text-primary">dot</code> (locked)</td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-medium">Filter Chip</td>
              <td class="py-2 pr-4">
                <code class="text-text-primary">removable</code> ·
                <code class="text-text-primary">onRemove</code>
              </td>
              <td class="py-2"><code class="text-text-primary">soft</code></td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-medium">Inline Label</td>
              <td class="py-2 pr-4">—</td>
              <td class="py-2"
                ><code class="text-text-primary">outlined</code> or
                <code class="text-text-primary">soft</code></td
              >
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
        Mixing patterns (e.g. counter + removable, or filter-chip with `intent=danger`) usually
        points at a different component — a deletable counter is a <code class="text-text-primary"
          >Chip</code
        >, a danger-tinted filter is a state-tag of the search itself.
      </p>
    </div>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Gradient Tags"
      description="Use slotClasses to turn badges into vibrant category tags."
      isolate
    >
      <Badge
        slotClasses={{
          base: 'bg-linear-to-r from-violet-500 to-fuchsia-500 text-white border-none shadow-md shadow-violet-500/20'
        }}
      >
        Featured
      </Badge>
      <Badge
        slotClasses={{
          base: 'bg-linear-to-r from-cyan-500 to-blue-500 text-white border-none shadow-md shadow-cyan-500/20'
        }}
      >
        New Release
      </Badge>
      <Badge
        slotClasses={{
          base: 'bg-linear-to-r from-amber-500 to-orange-500 text-white border-none shadow-md shadow-amber-500/20'
        }}
      >
        Trending
      </Badge>
    </CodeExample>

    <CodeExample
      title="Glassmorphism"
      description="Frosted glass badges over rich backgrounds."
      isolate
      previewClass="flex items-center gap-3 rounded-xl bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-6"
    >
      <Badge
        unstyled
        class="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md"
      >
        PRO
      </Badge>
      <Badge
        unstyled
        class="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md"
      >
        Beta
      </Badge>
      <Badge
        unstyled
        class="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md"
        pulse
      >
        Live
      </Badge>
    </CodeExample>

    <CodeExample
      title="Neon Glow"
      description="High-contrast neon badges for dark interfaces."
      isolate
      previewClass="flex items-center gap-3 rounded-xl bg-neutral-950 px-8 py-6"
    >
      <Badge
        unstyled
        class="rounded-full border border-emerald-400/60 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.3)]"
      >
        Online
      </Badge>
      <Badge
        unstyled
        class="rounded-full border border-sky-400/60 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.3)]"
      >
        Syncing
      </Badge>
      <Badge
        unstyled
        class="rounded-full border border-rose-400/60 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.3)]"
      >
        Offline
      </Badge>
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Drop all defaults and build a completely unique badge."
      isolate
    >
      <Badge
        unstyled
        class="text-text-primary inline-flex items-center gap-1.5 rounded-none border-2 border-current px-3 py-1 font-mono text-xs font-bold tracking-widest uppercase"
      >
        v2.4.0
      </Badge>
      <Badge
        unstyled
        class="inline-flex items-center gap-1.5 rounded-2xl bg-linear-to-br from-amber-200 to-orange-300 px-4 py-1.5 text-xs font-bold text-neutral-900 shadow-lg"
      >
        ★ Editor's Pick
      </Badge>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A tag style that repeats across the app — like the gradient categories above — is one
      <code class="text-text-primary">BlocksProvider</code> preset (<code class="text-text-primary"
        >presets.Badge</code
      >) applied via <code class="text-text-primary">preset</code>, not a copied
      <code class="text-text-primary">slotClasses</code>
      block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Badges render with <code class="text-text-primary">role="status"</code> by default,
          announcing content changes to screen readers. Removable badges include an accessible label
          for the remove button. Set <code class="text-text-primary">role="alert"</code> for time-sensitive
          notifications.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Interactive badges are focusable via
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          and activate with
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >. Removable badges also respond to
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Delete</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Backspace</kbd
          >.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Pulse animations and Mint effects are suppressed when
          <code class="text-text-primary">prefers-reduced-motion</code> is enabled.
        </p>
      </div>
    </div>
  </div>
</Section>
