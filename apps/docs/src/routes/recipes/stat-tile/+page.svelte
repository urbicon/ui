<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import {
    Card,
    Badge,
    ArrowUpIcon,
    ArrowDownIcon,
    WalletIcon,
    GaugeIcon,
    ReceiptIcon,
    BuildingIcon,
    UsersIcon
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  type Intent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

  interface Stat {
    label: string;
    value: string;
    description?: string;
    trend?: { direction: 'up' | 'down'; label: string };
    icon?: typeof WalletIcon;
    intent?: Intent;
    href?: string;
  }

  const stats: Stat[] = [
    {
      label: 'Revenue (month)',
      value: '€42,150',
      description: 'incl. service charges',
      trend: { direction: 'up', label: '+12.4%' },
      icon: WalletIcon,
      intent: 'primary',
      href: '#revenue'
    },
    {
      label: 'Consumption',
      value: '8,420 kWh',
      description: 'heating + hot water',
      trend: { direction: 'down', label: '−3.1%' },
      icon: GaugeIcon,
      intent: 'success',
      href: '#consumption'
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
</script>

<SeoMeta
  title="Stat Tile Recipe"
  description="KPI tile pattern for dashboards with Card, icon tile, and trend indicator."
/>

<div class="mx-auto max-w-5xl px-6 py-12">
  <header class="mb-10">
    <a
      href={resolve('/recipes')}
      class="text-text-tertiary hover:text-text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
    >
      ← Back to Recipes
    </a>
    <h1 class="text-text-primary mb-3 text-4xl font-bold">{recipeMeta.title}</h1>
    <p class="text-text-secondary text-lg">{recipeMeta.description}</p>
  </header>

  <div class="mb-8 flex flex-wrap gap-2">
    {#each usedComponents as comp (comp)}
      <Badge variant="soft" intent="primary">{comp}</Badge>
    {/each}
  </div>

  <Section id="preview" title="Live Preview">
    <div class="space-y-8">
      <div>
        <h3 class="text-text-primary mb-3 text-sm font-semibold">4-up grid (dashboard standard)</h3>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {#each stats as stat (stat.label)}
            {@const TrendIcon = stat.trend?.direction === 'up' ? ArrowUpIcon : ArrowDownIcon}
            {@const Icon = stat.icon}
            <Card variant="outlined" padding="md" href={stat.href}>
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-text-tertiary text-xs font-medium">{stat.label}</p>
                  <p class="text-text-primary mt-2 text-2xl font-semibold tabular-nums">
                    {stat.value}
                  </p>
                  <div class="mt-1 flex items-center gap-2">
                    {#if stat.description}
                      <p class="text-text-tertiary text-xs">{stat.description}</p>
                    {/if}
                    {#if stat.trend}
                      <span
                        class={[
                          'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                          stat.trend.direction === 'up' ? 'text-success' : 'text-danger'
                        ].join(' ')}
                      >
                        <TrendIcon class="h-3 w-3" />
                        {stat.trend.label}
                      </span>
                    {/if}
                  </div>
                </div>
                {#if Icon && stat.intent}
                  <span
                    class={[
                      'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                      stat.intent === 'primary' && 'bg-primary-subtle text-primary',
                      stat.intent === 'success' && 'bg-success-subtle text-success',
                      stat.intent === 'warning' && 'bg-warning-subtle text-warning-emphasis',
                      stat.intent === 'danger' && 'bg-danger-subtle text-danger',
                      stat.intent === 'neutral' && 'bg-surface-subtle text-text-secondary'
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <Icon class="h-4 w-4" />
                  </span>
                {/if}
              </div>
            </Card>
          {/each}
        </div>
      </div>

      <div>
        <h3 class="text-text-primary mb-3 text-sm font-semibold">
          Compact (for sidebars / footers)
        </h3>
        <div class="border-border-subtle flex flex-wrap gap-6 rounded-lg border p-4">
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
      </div>

      <div>
        <h3 class="text-text-primary mb-3 text-sm font-semibold">Highlight tile (hero KPI)</h3>
        <Card variant="elevated" padding="lg">
          <div class="flex items-center gap-5">
            <span
              class="bg-primary-subtle text-primary grid h-14 w-14 place-items-center rounded-xl"
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
      </div>
    </div>
  </Section>

  <Section id="features" title="Features">
    <Card variant="outlined">
      <ul class="divide-border-subtle divide-y">
        {#each features as feature (feature)}
          <li class="text-text-secondary px-4 py-3 text-sm">{feature}</li>
        {/each}
      </ul>
    </Card>
  </Section>

  <Section id="code" title="Code">
    <CodeExample
      title="StatTile.svelte"
      preview={false}
      language="svelte"
      code={`<script lang="ts">
  import { Card } from '@urbicon-ui/blocks';
  import type { Component, Snippet } from 'svelte';

  type Intent = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

  interface Props {
    label: string;
    value: string | number;
    description?: string;
    trend?: { direction: 'up' | 'down'; label: string };
    icon?: Component;
    intent?: Intent;
    href?: string;
    onclick?: () => void;
  }

  const { label, value, description, trend, icon: Icon, intent = 'neutral', href, onclick }: Props = $props();

  const tileBg: Record<Intent, string> = {
    primary: 'bg-primary-subtle text-primary',
    success: 'bg-success-subtle text-success',
    warning: 'bg-warning-subtle text-warning-emphasis',
    danger:  'bg-danger-subtle text-danger',
    neutral: 'bg-surface-subtle text-text-secondary'
  };
</scr` +
        `ipt>

<Card variant="outlined" padding="md" {href} {onclick}>
  <div class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <p class="text-text-tertiary text-xs font-medium">{label}</p>
      <p class="text-text-primary mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {#if description || trend}
        <div class="mt-1 flex items-center gap-2">
          {#if description}
            <p class="text-text-tertiary text-xs">{description}</p>
          {/if}
          {#if trend}
            <span class={\`text-xs font-medium tabular-nums \${trend.direction === 'up' ? 'text-success' : 'text-danger'}\`}>
              {trend.label}
            </span>
          {/if}
        </div>
      {/if}
    </div>
    {#if Icon}
      <span class={\`grid h-9 w-9 shrink-0 place-items-center rounded-lg \${tileBg[intent]}\`}>
        <Icon class="h-4 w-4" />
      </span>
    {/if}
  </div>
</Card>`}
    />
  </Section>

  <Section id="best-practices" title="Best Practices">
    <Card variant="outlined">
      <div class="divide-border-subtle divide-y">
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">tabular-nums for number alignment</h4>
          <p class="text-text-secondary mt-1 text-sm">
            <code class="text-text-primary">tabular-nums</code> renders digits at equal width — important
            when tiles sit in a grid and values should align visually.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">Icon tile as a secondary element</h4>
          <p class="text-text-secondary mt-1 text-sm">
            The icon is visual labeling, not content. Hence placed on the right, smaller than the
            value. The intent's subtle background sets it apart visually without dominating the
            value.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">
            Trend always with a comparison period
          </h4>
          <p class="text-text-secondary mt-1 text-sm">
            "+12.4%" without context says nothing. The description line should make clear what is
            being compared ("vs. last month", "vs. last year") — otherwise leave it out.
          </p>
        </div>
        <div class="px-4 py-3">
          <h4 class="text-text-primary text-sm font-semibold">href for drill-down</h4>
          <p class="text-text-secondary mt-1 text-sm">
            Stat tiles are a classic entry point into detail views. Set
            <code class="text-text-primary">href</code> so Card renders as an <code>&lt;a&gt;</code>
            — hover/focus styles apply automatically, Cmd-click opens a new tab.
          </p>
        </div>
      </div>
    </Card>
  </Section>
</div>
