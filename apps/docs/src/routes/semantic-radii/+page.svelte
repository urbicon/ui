<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    Avatar,
    Badge,
    Button,
    Card,
    Input,
    SegmentGroup,
    SegmentItem,
    Toolbar
  } from '@urbicon-ui/blocks';
  import { getIcon } from '@urbicon-ui/blocks';

  const BoldIcon = getIcon('bold');
  const ItalicIcon = getIcon('italic');
  const UnderlineIcon = getIcon('underline');

  let segValue = $state('filled');
</script>

<!-- Internal design reference (not linked in the navigation) — noindex,
     until it is integrated into the customization docs. -->
<SeoMeta
  title="Semantic radii · 3 tiers"
  description="Semantic radii grammar: commit (pill), modify (soft), contain (sharp). One component, one tier."
  noindex
/>

<div class="mx-auto max-w-4xl px-6 py-12">
  <!-- Header -->
  <header class="mb-10 flex items-baseline justify-between gap-6">
    <h1 class="text-text-primary flex items-center gap-3 text-3xl font-bold">
      <span class="text-success font-mono text-2xl">c</span>
      Semantic radii · 3 tiers
    </h1>
    <span class="text-text-tertiary font-mono text-sm">// one component, one tier</span>
  </header>

  <!-- Grammar legend -->
  <p class="text-text-secondary mb-3 font-mono text-sm leading-relaxed">
    <span class="text-text-primary font-semibold">commit</span>
    (action, identity, status) ·
    <span class="text-text-primary font-semibold">modify</span>
    (input, selection, navigation) ·
    <span class="text-text-primary font-semibold">contain</span>
    (card, panel, container)
  </p>
  <p class="text-text-tertiary mb-10 text-sm leading-relaxed">
    Every component lives in a default tier. Variants control fill, color, weight — never the
    radius. Containers like
    <span class="text-text-secondary font-mono">Toolbar</span>
    /
    <span class="text-text-secondary font-mono">ButtonGroup</span>
    propagate a tier to all tier-aware children.
  </p>

  <!-- Demo canvas -->
  <div class="bg-surface-subtle rounded-contain border-border-subtle space-y-10 border p-8">
    <!-- cta row -->
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-8">
      <span class="text-text-quaternary font-mono text-sm">cta</span>
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="filled" intent="neutral">Get started</Button>
        <Button variant="outlined" intent="neutral">Read more</Button>
        <Button variant="ghost" intent="neutral">More</Button>
        <Button variant="text" intent="neutral">Cancel</Button>
      </div>
    </div>

    <!-- form row -->
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-8">
      <span class="text-text-quaternary font-mono text-sm">form</span>
      <div class="flex flex-wrap items-center gap-3">
        <Input placeholder="email@urbicon.com" class="max-w-xs" />
        <Button variant="filled" intent="neutral">Subscribe</Button>
      </div>
    </div>

    <!-- seg row -->
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-8">
      <span class="text-text-quaternary font-mono text-sm">seg</span>
      <SegmentGroup bind:value={segValue} size="sm">
        <SegmentItem value="filled">filled</SegmentItem>
        <SegmentItem value="outline">outline</SegmentItem>
        <SegmentItem value="ghost">ghost</SegmentItem>
      </SegmentGroup>
    </div>

    <!-- tags row -->
    <div class="grid grid-cols-[auto_1fr] items-center gap-x-8">
      <span class="text-text-quaternary font-mono text-sm">tags</span>
      <div class="flex flex-wrap items-center gap-3">
        <Badge variant="soft" intent="success">
          <span class="bg-success rounded-commit mr-1 inline-block size-1.5"></span>
          STABLE
        </Badge>
        <Badge variant="outlined" intent="neutral">v0.1</Badge>
        <Badge variant="outlined" intent="neutral">primitive</Badge>
        <Avatar size="sm" intent="neutral" class="text-text-on-dark bg-neutral-900">u</Avatar>
      </div>
    </div>

    <!-- card row -->
    <div class="grid grid-cols-[auto_1fr] items-start gap-x-8">
      <span class="text-text-quaternary mt-4 font-mono text-sm">card</span>
      <Card variant="outlined" padding="md">
        <h3 class="text-text-primary text-base font-semibold">Button</h3>
        <p class="text-text-secondary mt-1 text-sm">versatile, accessible buttons.</p>
      </Card>
    </div>
  </div>

  <!-- Tier override / propagation showcase -->
  <div class="mt-10">
    <header class="mb-4 flex items-baseline justify-between gap-6">
      <h2 class="text-text-primary text-lg font-semibold">Override per container</h2>
      <span class="text-text-tertiary font-mono text-sm">// context beats default</span>
    </header>
    <p class="text-text-secondary mb-6 text-sm leading-relaxed">
      Tier-aware components read a
      <span class="text-text-primary font-mono">TierContext</span>
      that
      <span class="text-text-primary font-mono">Toolbar</span>
      and
      <span class="text-text-primary font-mono">ButtonGroup</span>
      set. That flips a row of buttons as a group — no manual setting per child, no mixed radii in a single
      row.
    </p>

    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <!-- Loose buttons -->
      <div class="bg-surface-subtle rounded-contain border-border-subtle border p-6">
        <p class="text-text-quaternary mb-4 font-mono text-xs">loose buttons · commit (default)</p>
        <div class="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" aria-label="Bold">
            <BoldIcon />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Italic">
            <ItalicIcon />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Underline">
            <UnderlineIcon />
          </Button>
        </div>
      </div>

      <!-- Toolbar with tier propagation -->
      <div class="bg-surface-subtle rounded-contain border-border-subtle border p-6">
        <p class="text-text-quaternary mb-4 font-mono text-xs">
          &lt;Toolbar tier="modify"&gt; · propagates
        </p>
        <Toolbar variant="ghost" tier="modify" aria-label="Formatting" padding="xs">
          <Button variant="ghost" size="sm" aria-label="Bold">
            <BoldIcon />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Italic">
            <ItalicIcon />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Underline">
            <UnderlineIcon />
          </Button>
        </Toolbar>
      </div>
    </div>

    <!-- Explicit per-component override -->
    <div
      class="bg-surface-subtle rounded-contain border-border-subtle mt-6 grid grid-cols-1 items-center gap-x-8 gap-y-3 border p-6 sm:grid-cols-[auto_1fr]"
    >
      <p class="text-text-quaternary font-mono text-xs">
        &lt;Input tier="commit"&gt; · per component
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <Input tier="commit" placeholder="Search..." class="max-w-xs" />
        <span class="text-text-tertiary text-xs">
          Search-bar style — pill instead of soft; the input moves into the commit tier via
          override.
        </span>
      </div>
    </div>
  </div>

  <!-- pros / cons -->
  <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
    <div class="flex gap-3">
      <span class="text-success font-mono">+</span>
      <p class="text-text-secondary text-sm leading-relaxed">
        <span class="text-text-primary">Teachable &amp; auditable:</span> every rounding carries meaning,
        every component has a default. Brandable via the three semantic tokens. Container propagation
        solves the "mixed radii in a row look wrong" problem without setting it per child.
      </p>
    </div>
    <div class="flex gap-3">
      <span class="text-warning font-mono">!</span>
      <p class="text-text-secondary text-sm leading-relaxed">
        <span class="text-text-primary">One detail stays the consumer's responsibility:</span>
        loose tier-aware components without a container wrap and with an explicitly set
        <code class="bg-surface-interactive rounded-modify px-1.5 py-0.5 font-mono text-xs">
          tier
        </code>
        side by side produce mixed radii — that's an override, not a system bug.
      </p>
    </div>
  </div>

  <!-- Token reference -->
  <div class="border-border-subtle mt-12 border-t pt-8">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Token reference</h2>
    <dl class="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-6 gap-y-3 font-mono text-sm">
      <dt class="text-text-primary">--radius-commit</dt>
      <dd class="text-text-secondary">commit · action, identity, status</dd>
      <dd class="text-text-quaternary">9999px</dd>
      <dt class="text-text-primary">--radius-modify</dt>
      <dd class="text-text-secondary">modify · input, selection, navigation</dd>
      <dd class="text-text-quaternary">var(--radius-sm)</dd>
      <dt class="text-text-primary">--radius-contain</dt>
      <dd class="text-text-secondary">contain · card, panel, container</dd>
      <dd class="text-text-quaternary">var(--radius-xs)</dd>
    </dl>
  </div>

  <!-- Component → Tier Mapping -->
  <div class="border-border-subtle mt-12 border-t pt-8">
    <h2 class="text-text-primary mb-4 text-lg font-semibold">Component → Tier</h2>
    <p class="text-text-tertiary mb-5 text-xs leading-relaxed">
      <span class="text-text-primary">Default</span>
      is the left column; <span class="text-text-primary">opt-in</span> the right. Components without
      an opt-in have no tier switch (by definition).
    </p>
    <dl
      class="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-6 gap-y-4 text-sm sm:grid-cols-[auto_1fr_auto]"
    >
      <dt class="text-text-primary font-mono">commit</dt>
      <dd class="text-text-secondary leading-relaxed">
        Button, ButtonGroup, Badge, Avatar (circle), SegmentGroup, Toggle, RadioGroup-Dot,
        Slider-Thumb
      </dd>
      <dd class="text-text-tertiary font-mono text-xs">+ tier=modify</dd>
      <dt class="text-text-primary font-mono">modify</dt>
      <dd class="text-text-secondary leading-relaxed">
        Input, Textarea, Select, Combobox, Checkbox, Tab, Menu-Item, Stepper
      </dd>
      <dd class="text-text-tertiary font-mono text-xs">+ tier=commit</dd>
      <dt class="text-text-primary font-mono">contain</dt>
      <dd class="text-text-secondary leading-relaxed">
        Card, Alert, Toolbar (Surface), Accordion, Collapsible, Dialog, Drawer, Tooltip,
        Popover-Panel, Skeleton, CommandPalette
      </dd>
      <dd class="text-text-tertiary font-mono text-xs">—</dd>
    </dl>
    <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
      <span class="text-text-secondary font-mono">Toolbar</span>
      is a
      <span class="text-text-secondary">contain</span>
      surface, but its
      <span class="text-text-secondary font-mono">tier</span>
      prop (default
      <span class="text-text-secondary font-mono">modify</span>
      ) propagates to all tier-aware children. Same logic for
      <span class="text-text-secondary font-mono">ButtonGroup</span>
      (default
      <span class="text-text-secondary font-mono">commit</span>
      ). Special case
      <span class="text-text-secondary font-mono">Avatar</span>: there the variants
      <span class="text-text-secondary font-mono">circle</span>
      /
      <span class="text-text-secondary font-mono">rounded</span>
      /
      <span class="text-text-secondary font-mono">square</span>
      are explicit shape statements — the shape itself is the message.
    </p>
  </div>
</div>
