<script lang="ts">
  import {
    ArrowDownIcon,
    ArrowUpIcon,
    BuildingIcon,
    Card,
    GaugeIcon,
    type IconComponent,
    ReceiptIcon,
    UsersIcon,
    WalletIcon
  } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  type Intent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

  interface Stat {
    label: string;
    value: string;
    /** Qualifies the value; a trending tile names its baseline here. */
    description: string;
    trend?: { direction: 'up' | 'down'; label: string };
    icon: IconComponent;
    intent: Intent;
    href: string;
  }

  const stats: Stat[] = [
    {
      label: 'Revenue (month)',
      value: '€42,150',
      description: 'vs. last month',
      trend: { direction: 'up', label: '+12.4%' },
      icon: WalletIcon,
      intent: 'success',
      href: '#revenue'
    },
    {
      label: 'Occupancy',
      value: '89.6%',
      description: 'vs. last quarter',
      trend: { direction: 'down', label: '−2.3 pt' },
      icon: GaugeIcon,
      intent: 'danger',
      href: '#occupancy'
    },
    {
      label: 'Open invoices',
      value: '5',
      description: '2 overdue',
      icon: ReceiptIcon,
      intent: 'warning',
      href: '#invoices'
    },
    {
      label: 'Properties',
      value: '12',
      description: '3 in progress',
      icon: BuildingIcon,
      intent: 'neutral',
      href: '#buildings'
    }
  ];

  // One wash per intent, as full class strings — Tailwind reads classes whole,
  // so none are assembled from the intent value. warning draws its glyph in
  // the emphasis step: its base hue is far lighter than success or danger
  // (L 0.75 vs 0.5 in the foundation scale) and fades on its own subtle wash.
  const ICON_TILE: Record<Intent, string> = {
    primary: 'bg-primary-subtle text-primary',
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning-emphasis',
    danger: 'bg-danger-subtle text-danger',
    neutral: 'bg-surface-subtle text-text-secondary'
  };

  const recipeCode = `<\script lang="ts">
  import {
    ArrowDownIcon,
    ArrowUpIcon,
    BuildingIcon,
    Card,
    GaugeIcon,
    type IconComponent,
    ReceiptIcon,
    WalletIcon
  } from '@urbicon-ui/blocks';

  type Intent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

  interface Stat {
    label: string;
    value: string;
    /** Qualifies the value; a trending tile names its baseline here. */
    description: string;
    trend?: { direction: 'up' | 'down'; label: string };
    icon: IconComponent;
    intent: Intent;
    href: string;
  }

  const stats: Stat[] = [
    {
      label: 'Revenue (month)',
      value: '€42,150',
      description: 'vs. last month',
      trend: { direction: 'up', label: '+12.4%' },
      icon: WalletIcon,
      intent: 'success',
      href: '#revenue'
    },
    {
      label: 'Occupancy',
      value: '89.6%',
      description: 'vs. last quarter',
      trend: { direction: 'down', label: '−2.3 pt' },
      icon: GaugeIcon,
      intent: 'danger',
      href: '#occupancy'
    },
    {
      label: 'Open invoices',
      value: '5',
      description: '2 overdue',
      icon: ReceiptIcon,
      intent: 'warning',
      href: '#invoices'
    },
    {
      label: 'Properties',
      value: '12',
      description: '3 in progress',
      icon: BuildingIcon,
      intent: 'neutral',
      href: '#buildings'
    }
  ];

  // One wash per intent, as full class strings — Tailwind reads classes whole,
  // so none are assembled from the intent value. warning draws its glyph in
  // the emphasis step: its base hue is far lighter than success or danger
  // (L 0.75 vs 0.5 in the foundation scale) and fades on its own subtle wash.
  const ICON_TILE: Record<Intent, string> = {
    primary: 'bg-primary-subtle text-primary',
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning-emphasis',
    danger: 'bg-danger-subtle text-danger',
    neutral: 'bg-surface-subtle text-text-secondary'
  };
<\/script>

<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  {#each stats as stat (stat.label)}
    {@const TrendIcon = stat.trend?.direction === 'up' ? ArrowUpIcon : ArrowDownIcon}
    {@const Icon = stat.icon}
    <!-- href renders the Card as an <a> with Card's own hover lift and focus
         ring. tier="bridge": the contain default reads as a bare corner at
         tile size. -->
    <Card variant="elevated" tier="bridge" href={stat.href}>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-text-tertiary text-xs font-medium">{stat.label}</p>
          <p class="text-text-primary mt-2 text-2xl font-semibold tabular-nums">{stat.value}</p>
          <div class="mt-1 flex items-center gap-2">
            <p class="text-text-tertiary text-xs">{stat.description}</p>
            {#if stat.trend}
              <span
                class={[
                  'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                  stat.trend.direction === 'up' ? 'text-success' : 'text-danger'
                ]}
              >
                <TrendIcon class="h-3 w-3" />
                {stat.trend.label}
              </span>
            {/if}
          </div>
        </div>
        <span
          class={[
            'grid h-9 w-9 shrink-0 place-items-center rounded-bridge',
            ICON_TILE[stat.intent]
          ]}
        >
          <Icon class="h-4 w-4" />
        </span>
      </div>
    </Card>
  {/each}
</div>`;

  const stripCode = `<\script lang="ts">
  import { Card } from '@urbicon-ui/blocks';
<\/script>

<!-- One quiet wash groups the numbers; in a sidebar foot or header row,
     per-number cards would be noise. -->
<Card variant="quiet">
  <div class="flex flex-wrap gap-6">
    <div>
      <p class="text-text-tertiary text-xs">Tenants</p>
      <p class="text-text-primary text-lg font-semibold tabular-nums">38</p>
    </div>
    <div>
      <p class="text-text-tertiary text-xs">Apartments</p>
      <p class="text-text-primary text-lg font-semibold tabular-nums">42</p>
    </div>
    <div>
      <p class="text-text-tertiary text-xs">Occupancy</p>
      <p class="text-text-primary text-lg font-semibold tabular-nums">90.5%</p>
    </div>
  </div>
</Card>`;

  const heroCode = `<\script lang="ts">
  import { Card, UsersIcon } from '@urbicon-ui/blocks';
<\/script>

<!-- One per page — elevation stops meaning anything when every tile has it. -->
<Card variant="elevated" padding="lg">
  <div class="flex items-center gap-5">
    <span class="bg-primary-subtle text-primary grid h-14 w-14 place-items-center rounded-bridge">
      <UsersIcon class="h-7 w-7" />
    </span>
    <div>
      <p class="text-text-tertiary text-sm font-medium">Active users</p>
      <p class="text-text-primary text-4xl font-semibold tabular-nums">1,284</p>
      <p class="text-success mt-1 text-sm font-medium">+86 in the last 7 days</p>
    </div>
  </div>
</Card>`;
</script>

<!-- urbicon-ignore intent-rainbow — the hues ARE the subject. A stat tile
     exists to signal how a number is doing, so this page shows success,
     warning and danger side by side; a page of neutral tiles would document
     nothing. -->

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <div class="space-y-10">
      <CodeExample
        title="The 4-up grid"
        description="Each tile is a `Card` with `href`: hover one, and the lift is the card itself signalling the link."
        code={recipeCode}
        language="svelte"
        headingLevel={2}
      >
        <div class="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {#each stats as stat (stat.label)}
            {@const TrendIcon = stat.trend?.direction === 'up' ? ArrowUpIcon : ArrowDownIcon}
            {@const Icon = stat.icon}
            <Card variant="elevated" tier="bridge" href={stat.href}>
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-text-tertiary text-xs font-medium">{stat.label}</p>
                  <p class="text-text-primary mt-2 text-2xl font-semibold tabular-nums">
                    {stat.value}
                  </p>
                  <div class="mt-1 flex items-center gap-2">
                    <p class="text-text-tertiary text-xs">{stat.description}</p>
                    {#if stat.trend}
                      <span
                        class={[
                          'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                          stat.trend.direction === 'up' ? 'text-success' : 'text-danger'
                        ]}
                      >
                        <TrendIcon class="h-3 w-3" />
                        {stat.trend.label}
                      </span>
                    {/if}
                  </div>
                </div>
                <span
                  class={[
                    'rounded-bridge grid h-9 w-9 shrink-0 place-items-center',
                    ICON_TILE[stat.intent]
                  ]}
                >
                  <Icon class="h-4 w-4" />
                </span>
              </div>
            </Card>
          {/each}
        </div>
      </CodeExample>

      <CodeExample
        title="The compact strip"
        description="Three bare label/value pairs on one quiet card, for a sidebar foot or header row where a grid of tiles would shout."
        code={stripCode}
        language="svelte"
        headingLevel={2}
      >
        <Card variant="quiet">
          <div class="flex flex-wrap gap-6">
            <div>
              <p class="text-text-tertiary text-xs">Tenants</p>
              <p class="text-text-primary text-lg font-semibold tabular-nums">38</p>
            </div>
            <div>
              <p class="text-text-tertiary text-xs">Apartments</p>
              <p class="text-text-primary text-lg font-semibold tabular-nums">42</p>
            </div>
            <div>
              <p class="text-text-tertiary text-xs">Occupancy</p>
              <p class="text-text-primary text-lg font-semibold tabular-nums">90.5%</p>
            </div>
          </div>
        </Card>
      </CodeExample>

      <CodeExample
        title="The highlight tile"
        description="One promoted metric: an elevated card, `padding` stepped up to `lg`, the icon square scaled to match."
        code={heroCode}
        language="svelte"
        headingLevel={2}
      >
        <Card variant="elevated" padding="lg">
          <div class="flex items-center gap-5">
            <span
              class="bg-primary-subtle text-primary rounded-bridge grid h-14 w-14 place-items-center"
            >
              <UsersIcon class="h-7 w-7" />
            </span>
            <div>
              <p class="text-text-tertiary text-sm font-medium">Active users</p>
              <p class="text-text-primary text-4xl font-semibold tabular-nums">1,284</p>
              <p class="text-success mt-1 text-sm font-medium">+86 in the last 7 days</p>
            </div>
          </div>
        </Card>
      </CodeExample>
    </div>
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="Two surfaces: lifted and quiet">
        <p>
          The grid tiles are <code class="text-text-primary">variant="elevated"</code>: each KPI
          sits on its own raised card, equal to its three neighbours, and
          <code class="text-text-primary">href</code> renders the Card as an
          <code class="text-text-primary">&lt;a&gt;</code> whose hover lift signals the link. The
          strip is <code class="text-text-primary">variant="quiet"</code>, a recessed wash for
          numbers that comment rather than compete; the highlight tile stands apart by format —
          <code class="text-text-primary">padding="lg"</code> and the largest figure — not by a
          surface of its own. The small tiles add
          <code class="text-text-primary">tier="bridge"</code> because the default contain radius
          reads as a bare corner at tile size. The full contract of cards that link (and why the
          <code class="text-text-primary">href</code> never moves to a wrapper) is
          <a class="text-primary hover:underline" href={resolve('/recipes/clickable-card')}
            >Clickable Card</a
          >.
        </p>
      </Note>
      <Note title="Up is green only while up is good">
        <p>
          Both trending tiles read the way their arrows point: revenue up is good, occupancy down is
          not, so the arrow's direction may pick the colour. For a metric whose good direction is
          down (consumption, churn, arrears) that ternary is wrong; derive the trend colour from the
          same judgement that sets the tile's
          <code class="text-text-primary">intent</code>. And a delta needs its baseline named:
          <code class="text-text-primary">+12.4%</code> against nothing says nothing, so the description
          line carries it ("vs. last month"); without one, drop the trend.
        </p>
      </Note>
    </NoteList>

    <p class="text-text-secondary mt-6 text-sm">
      The four tiles are one loop over <code class="text-text-primary">stats</code> because they
      differ only in data. The moment a second page needs one, move the tile markup into its own
      <code class="text-text-primary">StatTile.svelte</code> with
      <code class="text-text-primary">Stat</code> as its props; the grid stays in the page.
    </p>
  </Section>
</RecipeShell>
