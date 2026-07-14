<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Badge, Button, Checkbox, SegmentGroup, SegmentItem, Toolbar } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'three-tiers', title: 'Three Tiers', order: 1 },
    { id: 'tier-aware-components', title: 'Tier-aware Components', order: 2 },
    { id: 'context-cascade', title: 'Context Cascade', order: 3 },
    { id: 'override-pathway', title: 'Override Pathway', order: 4 },
    { id: 'bridge', title: 'Bridge Token', order: 5 }
  ];

  let demoTier = $state<'commit' | 'modify'>('commit');
  let commitOverride = $state('9999px');

  const tokenExample = `/* foundation.css — the three tier tokens */
@theme {
  --radius-commit:  9999px;                    /* pill — Button, ButtonGroup, Toolbar */
  --radius-modify:  var(--radius-sm);          /* tap surface — Input, Select, Tab */
  --radius-contain: var(--radius-xs);          /* container — Card, Alert, Dialog */
  --radius-bridge:  var(--radius-md);          /* adjacency — Menu panel ↔ pill trigger */
}`;

  const propExample =
    `<scr` +
    `ipt>
  import { Button, Toolbar } from '@urbicon-ui/blocks';
</scr` +
    `ipt>

<!-- Default: tier="commit" — pill -->
<Button>Launch</Button>

<!-- Explicit: tier="modify" — soft square -->
<Button tier="modify">Launch</Button>

<!-- Wrap in a Toolbar with tier="modify" — children inherit -->
<Toolbar tier="modify">
  <Button>Launch</Button>          <!-- inherits modify -->
  <Button tier="commit">Reset</Button>  <!-- explicit override -->
</Toolbar>`;

  const overrideExample = `/* Brand-level override — applies everywhere */
@theme {
  --radius-commit: var(--radius-lg);     /* squared pill */
  --radius-modify: var(--radius-xs);     /* tighter inputs */
}

/* Scoped override — only inside .editorial-stage */
.editorial-stage {
  --radius-commit: var(--radius-md);
}`;
</script>

<SeoMeta
  title="Tier System"
  description="The three-tier semantic radius system (commit / modify / contain) — how Urbicon UI primitives pick a border-radius and how consumers override per brand or per scope."
/>

<DocsPageLayout
  title="Tier System"
  description="A semantic vocabulary for border-radius. Three tiers — commit, modify, contain — let components, brand themes, and inline overrides speak the same language without anyone reaching for a raw pixel value."
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
>
  <!-- Three Tiers ─────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="three-tiers">Three Tiers</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Every primitive in the library belongs to exactly one of three tiers. The tier dictates the
      component's default radius and how it responds to a wrapping context. Brands tune the visual
      identity by changing the three token values once; component code never touches a raw pixel
      value.
    </p>

    <div
      class="border-border-subtle bg-surface-elevated mb-6 grid gap-4 rounded-2xl border p-6 sm:grid-cols-3"
    >
      <div class="text-center">
        <div class="bg-primary rounded-commit mx-auto mb-3 h-16 w-16"></div>
        <h3 class="text-text-primary mb-1 text-sm font-semibold">commit</h3>
        <p class="text-text-tertiary text-xs leading-relaxed">
          Pill (9999px). Action, identity, status. Buttons, ButtonGroup, Badge, Toolbar,
          SegmentGroup, Toggle, Stepper.
        </p>
      </div>
      <div class="text-center">
        <div class="bg-primary rounded-modify mx-auto mb-3 h-16 w-16"></div>
        <h3 class="text-text-primary mb-1 text-sm font-semibold">modify</h3>
        <p class="text-text-tertiary text-xs leading-relaxed">
          Small (~4px). Tap surface, editable. Input, Select, Combobox, Textarea, Checkbox,
          RadioGroup, Tab, Menu-Item.
        </p>
      </div>
      <div class="text-center">
        <div class="bg-primary rounded-contain mx-auto mb-3 h-16 w-16"></div>
        <h3 class="text-text-primary mb-1 text-sm font-semibold">contain</h3>
        <p class="text-text-tertiary text-xs leading-relaxed">
          Barely-rounded (~2px). Architectural surface, panel. Card, Alert, Dialog, Drawer, Tooltip,
          Popover.
        </p>
      </div>
    </div>

    <CodeExample title="The four tokens" code={tokenExample} language="css" preview={false} />

    <p class="text-text-tertiary mt-3 text-xs leading-relaxed">
      The token names are also the public-API vocabulary: a component reads <code
        class="text-text-primary">tier="commit"</code
      >
      and applies <code class="text-text-primary">rounded-commit</code> — the contract is symmetric.
    </p>
  </section>

  <!-- Tier-aware components ────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="tier-aware-components">
      Tier-aware Components
    </h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Seven primitives expose a <code class="text-text-primary">tier</code> prop AND read from a
      wrapping
      <code class="text-text-primary">TierContext</code> when the prop is unset. The other
      primitives use a fixed tier per component family — see
      <a href={resolve('/blocks')} class="text-primary hover:underline">the Blocks index</a> for the per-component
      defaults.
    </p>

    <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
      <table class="text-text-secondary w-full text-left text-sm">
        <thead
          class="border-border-subtle text-text-primary border-b text-xs tracking-wider uppercase"
        >
          <tr>
            <th class="px-4 py-3 font-semibold">Component</th>
            <th class="px-4 py-3 font-semibold">Default tier</th>
            <th class="px-4 py-3 font-semibold">Family</th>
            <th class="px-4 py-3 font-semibold">Why</th>
          </tr>
        </thead>
        <tbody class="divide-border-subtle divide-y">
          <tr>
            <td class="text-text-primary px-4 py-3 font-medium">Button</td>
            <td class="px-4 py-3"><code>commit</code></td>
            <td class="px-4 py-3">Action</td>
            <td class="px-4 py-3">Identity declaration — buttons read as decisive.</td>
          </tr>
          <tr>
            <td class="text-text-primary px-4 py-3 font-medium">Toggle</td>
            <td class="px-4 py-3"><code>commit</code></td>
            <td class="px-4 py-3">Action</td>
            <td class="px-4 py-3">Track radius mirrors Button visual weight.</td>
          </tr>
          <tr>
            <td class="text-text-primary px-4 py-3 font-medium">SegmentGroup</td>
            <td class="px-4 py-3"><code>commit</code></td>
            <td class="px-4 py-3">Navigation</td>
            <td class="px-4 py-3"
              >Track + indicator both follow tier for inline action-strip ergonomics.</td
            >
          </tr>
          <tr>
            <td class="text-text-primary px-4 py-3 font-medium">Stepper</td>
            <td class="px-4 py-3"><code>commit</code></td>
            <td class="px-4 py-3">Navigation</td>
            <td class="px-4 py-3">Indicator + separator are progress-marker affordances.</td>
          </tr>
          <tr>
            <td class="text-text-primary px-4 py-3 font-medium">RadioGroup</td>
            <td class="px-4 py-3"><code>commit</code></td>
            <td class="px-4 py-3">Form</td>
            <td class="px-4 py-3"
              >Indicator + dot read as commit-tier affordances even inside Form-family.</td
            >
          </tr>
          <tr>
            <td class="text-text-primary px-4 py-3 font-medium">Checkbox</td>
            <td class="px-4 py-3"><code>modify</code></td>
            <td class="px-4 py-3">Form</td>
            <td class="px-4 py-3"
              >Box is the canonical input-tap surface — modify is its native tier.</td
            >
          </tr>
          <tr>
            <td class="text-text-primary px-4 py-3 font-medium">Tab</td>
            <td class="px-4 py-3"><code>modify</code></td>
            <td class="px-4 py-3">Navigation</td>
            <td class="px-4 py-3"
              >Editorial-leaning navigation surface; commits would feel too loud.</td
            >
          </tr>
        </tbody>
      </table>
    </div>

    <CodeExample
      title="Prop and context contract"
      code={propExample}
      language="svelte"
      preview={false}
    />
  </section>

  <!-- Context cascade demo ─────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="context-cascade">Context Cascade</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      A wrapping component with a <code class="text-text-primary">tier</code> prop publishes that
      tier through <code class="text-text-primary">TierContext</code>. Every tier-aware child that
      does not set its own <code class="text-text-primary">tier</code> prop inherits the wrapping value.
      Switch the toolbar tier below to see Button, Toggle, Checkbox, and Badge respond in lockstep.
    </p>

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <div class="mb-4 flex items-center justify-between gap-4">
        <span class="text-text-secondary text-sm">Toolbar tier:</span>
        <SegmentGroup bind:value={demoTier} aria-label="Demo toolbar tier" size="sm">
          <SegmentItem value="commit">commit</SegmentItem>
          <SegmentItem value="modify">modify</SegmentItem>
        </SegmentGroup>
      </div>

      <Toolbar tier={demoTier} aria-label="Tier cascade demo" gap="md">
        <Button intent="primary" size="sm">Save</Button>
        <Button variant="ghost" intent="neutral" size="sm">Cancel</Button>
        <Checkbox size="sm" label="Auto-publish" />
        <Badge intent="primary" size="sm">3 unread</Badge>
      </Toolbar>

      <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
        Children with no <code class="text-text-primary">tier</code> prop inherit
        <code class="text-text-primary">{demoTier}</code>. Set
        <code class="text-text-primary">tier="commit"</code>
        on a single child to opt-out of the cascade.
      </p>
    </div>
  </section>

  <!-- Override pathway ─────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="override-pathway">
      Override Pathway
    </h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      The three tier tokens are CSS custom properties. Override them at any scope — global
      <code class="text-text-primary">@theme</code> for brand identity, a wrapping selector for a
      stage-specific look, or an inline <code class="text-text-primary">style</code> attribute for one-off
      experiments. The same Button code re-flows across all three.
    </p>

    <div class="border-border-subtle bg-surface-elevated mb-4 rounded-2xl border p-6">
      <div class="mb-4 flex items-center justify-between gap-4">
        <span class="text-text-secondary text-sm">
          <code class="text-text-primary">--radius-commit</code>:
        </span>
        <SegmentGroup
          bind:value={commitOverride}
          aria-label="Demo radius-commit override"
          size="sm"
        >
          <SegmentItem value="9999px">9999px (default)</SegmentItem>
          <SegmentItem value="0.75rem">0.75rem</SegmentItem>
          <SegmentItem value="0.25rem">0.25rem</SegmentItem>
          <SegmentItem value="0">0</SegmentItem>
        </SegmentGroup>
      </div>

      <div style="--radius-commit: {commitOverride}">
        <div class="flex flex-wrap items-center gap-3">
          <Button intent="primary">Launch Project</Button>
          <Button variant="outlined" intent="neutral">Cancel</Button>
          <Badge intent="success">Active</Badge>
          <Badge intent="danger" counter size="sm">12</Badge>
        </div>
      </div>

      <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
        The override sits on the parent <code class="text-text-primary">&lt;div style&gt;</code> —
        every <code class="text-text-primary">rounded-commit</code> utility inside that subtree picks
        up the new value. No prop changes, no component edits.
      </p>
    </div>

    <CodeExample
      title="Brand-level + scoped overrides"
      code={overrideExample}
      language="css"
      preview={false}
    />
  </section>

  <!-- Bridge token ──────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="bridge">Bridge Token</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      <code class="text-text-primary">--radius-bridge</code> covers a narrow adjacency case: a
      floating panel anchored to a commit-tier (pill) trigger. The panel itself is container-tier
      content, but its radius wants to visually pair with the trigger. The bridge token sits between
      the two — <code class="text-text-primary">var(--radius-md)</code> by default — so a Menu panel under
      a pill Button reads as connected, not as a stranded contain-surface.
    </p>

    <p class="text-text-secondary leading-relaxed">
      No component uses bridge as its primary surface radius; it appears only in
      <code class="text-text-primary">menu.variants.ts</code>. Brands tune via the foundation token
      like any other tier. See
      <a href={resolve('/blocks/primitives/menu')} class="text-primary hover:underline">Menu</a>
      for usage.
    </p>
  </section>
</DocsPageLayout>
