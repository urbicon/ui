<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Badge, Button, Checkbox, SegmentGroup, SegmentItem, Toolbar } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'three-tiers', title: 'Three Tiers' },
    { id: 'tier-aware-components', title: 'Tier-aware Components' },
    { id: 'context-cascade', title: 'Context Cascade' },
    { id: 'override-pathway', title: 'Override Pathway' },
    { id: 'bridge', title: 'Bridge Token' }
  ];

  let demoTier = $state<'commit' | 'modify'>('commit');
  let commitOverride = $state('9999px');

  const tokenExample = `/* foundation.css — the tier tokens */
@theme {
  --radius-commit:  9999px;                    /* pill — Button, ButtonGroup, Badge */
  --radius-modify:  var(--radius-sm);          /* tap surface — Input, Select, Tab */
  --radius-contain: var(--radius-xs);          /* container — Card, Alert, Dialog */
  --radius-bridge:  var(--radius-md);          /* middle rung — adjacency + small content surfaces */
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
  title="Radius Tiers"
  description="The three-tier semantic radius system (commit / modify / contain): how Urbicon UI primitives pick a border-radius and how consumers override per brand or per scope."
/>

<DocsPageLayout
  title="Radius Tiers"
  description="A semantic vocabulary for border-radius. Three tiers (commit, modify, contain) let components, brand themes, and inline overrides speak the same language without anyone reaching for a raw pixel value."
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
>
  <!-- Three Tiers ─────────────────────────────────────────── -->
  <Section id="three-tiers" title="Three Tiers" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Every primitive in the library belongs to exactly one of three tiers. The tier dictates the
      component's default radius and how it responds to a wrapping context. Brands tune the visual
      identity by changing the three token values once, e.g.
      <code class="text-text-primary">@theme {'{'} --radius-commit: var(--radius-lg); {'}'}</code>
      (<a href="#override-pathway" class="text-primary hover:underline">Override Pathway</a>);
      component code never touches a raw pixel value.
    </p>

    <!-- Each swatch is shaped like the tier's typical component (pill button,
         input field, panel) — on identical 64px squares, modify's ~4px and
         contain's ~2px were indistinguishable, which is exactly the
         optical-size effect the Bridge section below describes. -->
    <div
      class="border-border-subtle bg-surface-elevated mb-6 grid gap-4 rounded-2xl border p-6 sm:grid-cols-3"
    >
      <div class="text-center">
        <div class="bg-primary rounded-commit mx-auto mb-3 h-11 w-36"></div>
        <h3 class="text-text-primary mb-1 text-sm font-semibold">commit</h3>
        <p class="text-text-tertiary text-xs leading-relaxed">
          Pill (9999px). Action, identity, status. Buttons, ButtonGroup, Badge, SegmentGroup,
          Toggle, Stepper.
        </p>
      </div>
      <div class="text-center">
        <div
          class="border-primary rounded-modify bg-primary-subtle mx-auto mb-3 h-11 w-36 border-2"
        ></div>
        <h3 class="text-text-primary mb-1 text-sm font-semibold">modify</h3>
        <p class="text-text-tertiary text-xs leading-relaxed">
          Small (~4px). Tap surface, editable. Input, Select, Combobox, Textarea, Checkbox, Tab,
          Menu-Item.
        </p>
      </div>
      <div class="text-center">
        <div
          class="border-border-default rounded-contain bg-surface-base mx-auto mb-3 h-11 w-full border shadow-[var(--blocks-shadow-sm)]"
        ></div>
        <h3 class="text-text-primary mb-1 text-sm font-semibold">contain</h3>
        <p class="text-text-tertiary text-xs leading-relaxed">
          Barely-rounded (~2px). Architectural surface, panel. Card, Alert, Dialog, Drawer, Tooltip,
          Popover, Toolbar (whose children inherit modify).
        </p>
      </div>
    </div>

    <CodeExample title="The tier tokens" code={tokenExample} language="css" preview={false} />

    <p class="text-text-tertiary mt-3 text-xs leading-relaxed">
      The token names are also the public-API vocabulary: a component reads <code
        class="text-text-primary">tier="commit"</code
      >
      and applies <code class="text-text-primary">rounded-commit</code>. The contract is symmetric.
      One exception: radio indicators keep their circle via
      <code class="text-text-primary">--radius-control</code> (see
      <a href="#override-pathway" class="text-primary hover:underline">Override Pathway</a>).
    </p>
  </Section>

  <!-- Tier-aware components ────────────────────────────────── -->
  <Section id="tier-aware-components" title="Tier-aware Components" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Interactive primitives take a <code class="text-text-primary">tier</code> prop and fall back
      to a wrapping
      <code class="text-text-primary">TierContext</code> when the prop is unset (<a
        href={resolve('/blocks')}
        class="text-primary hover:underline">the Blocks index</a
      > carries the per-component defaults). The defaults worth knowing:
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
            <td class="px-4 py-3">Identity declaration: buttons read as decisive.</td>
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
              >Box is the canonical input-tap surface: modify is its native tier.</td
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
  </Section>

  <!-- Context cascade demo ─────────────────────────────────── -->
  <Section id="context-cascade" title="Context Cascade" class="mb-12">
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
  </Section>

  <!-- Override pathway ─────────────────────────────────────── -->
  <Section id="override-pathway" title="Override Pathway" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      The tier tokens are CSS custom properties. Override them at any scope: global
      <code class="text-text-primary">@theme</code> for brand identity, a wrapping selector for a
      stage-specific look, or an inline <code class="text-text-primary">style</code> attribute for one-off
      experiments. The same Button code re-flows across all three.
    </p>
    <p class="text-text-secondary mb-6 leading-relaxed">
      One deliberate exception: the <strong>radio indicator</strong> reads
      <code class="text-text-primary">--radius-control</code>, not the tier's radius. Its circle is
      the only thing distinguishing it from a checkbox, so squaring the commit tier for austere
      buttons used to square the radios along with them. The token defaults to the same
      <code class="text-text-primary">9999px</code>, so nothing changes until you set
      <code class="text-text-primary">--radius-control</code> yourself. The checkbox keeps following
      the tier: a pill-shaped box there is a look you asked for by writing
      <code class="text-text-primary">tier="commit"</code>, not one a button theme imposed on you.
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
        The override sits on the parent <code class="text-text-primary">&lt;div style&gt;</code>:
        every <code class="text-text-primary">rounded-commit</code> utility inside that subtree picks
        up the new value.
      </p>
    </div>

    <CodeExample
      title="Brand-level + scoped overrides"
      code={overrideExample}
      language="css"
      preview={false}
    />
  </Section>

  <!-- Bridge token ──────────────────────────────────────────── -->
  <Section id="bridge" title="Bridge Token" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      <code class="text-text-primary">--radius-bridge</code> is the middle rung (<code
        class="text-text-primary">var(--radius-md)</code
      >
      by default) for the two cases where
      <code class="text-text-primary">contain</code> is too hard and
      <code class="text-text-primary">commit</code> too soft. The first is
      <strong>adjacency</strong>: a floating panel anchored to a commit-tier (pill) trigger is
      container-tier content, but its radius wants to pair with the trigger, so a Menu panel under a
      pill Button reads as connected rather than as a stranded contain-surface.
    </p>

    <p class="text-text-secondary mb-6 leading-relaxed">
      The second is <strong>optical size</strong>: radius scales with the area it turns, so the 2px
      edge that reads as precise on a 600px Card reads as a plain rectangle on a ~200px tile. A
      small tinted surface is <em>content</em>, not architecture, and takes the middle rung: the
      <code class="text-text-primary">ChatMessage</code> bubble,
      <code class="text-text-primary">Textarea</code> at
      <code class="text-text-primary">tier="commit"</code> (a pill would be absurd on a multi-line
      field), and <code class="text-text-primary">&lt;Card tier="bridge"&gt;</code>, which is how a
      consumer says "this tile is too small for the container radius" without hand-setting a
      <code class="text-text-primary">rounded-*</code> class and splitting the contain family.
    </p>

    <p class="text-text-secondary leading-relaxed">
      Anything that genuinely <em>is</em> a panel, dialog or container stays on
      <code class="text-text-primary">contain</code>. Brands tune bridge via the foundation token
      like any other tier. See
      <a href={resolve('/blocks/primitives/menu')} class="text-primary hover:underline">Menu</a>
      for the adjacency case and
      <a href={resolve('/blocks/primitives/card')} class="text-primary hover:underline">Card</a>
      for the optical one.
    </p>
  </Section>
</DocsPageLayout>
