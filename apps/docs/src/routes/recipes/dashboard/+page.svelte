<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import {
    Avatar,
    Badge,
    BarChart,
    BarChartIcon,
    Button,
    Card,
    HomeIcon,
    MenuIcon,
    Progress,
    SettingsIcon,
    SidebarLayout,
    Tooltip,
    UsersIcon
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { componentLinks } from '$lib/component-links';
  import { recipeMeta } from './meta';

  const { components: usedComponents } = recipeMeta;

  let sidebarOpen = $state(false);
  let activeRoute = $state('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
    { id: 'analytics', label: 'Analytics', icon: BarChartIcon },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  const stats = [
    {
      label: 'Total Users',
      value: '12,847',
      change: '+12.5%',
      intent: 'success' as const,
      progress: 78,
      tooltip: 'Target: 16,500 users by Q2'
    },
    {
      label: 'Revenue',
      value: '$48,392',
      change: '+8.2%',
      intent: 'success' as const,
      progress: 64,
      tooltip: 'Target: $75,000 monthly'
    },
    {
      label: 'Active Sessions',
      value: '1,429',
      change: '-3.1%',
      intent: 'danger' as const,
      progress: 45,
      tooltip: 'Down from 1,475 last week'
    },
    {
      label: 'Conversion',
      value: '3.24%',
      change: '+0.8%',
      intent: 'success' as const,
      progress: 81,
      tooltip: 'Target: 4.0% conversion rate'
    }
  ];

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];
  const chartData = [40, 65, 45, 80, 55, 70, 85, 60, 90, 75, 95, 88];
  const revenue = months.map((label, i) => ({ label, values: [chartData[i]] }));

  const recentActivity = [
    { user: 'Sarah Chen', action: 'Purchased Pro plan', time: '2 min ago' },
    { user: 'Marcus Rivera', action: 'Submitted support ticket', time: '15 min ago' },
    { user: 'Aisha Patel', action: 'Updated profile settings', time: '1 hour ago' },
    { user: 'Tom Weber', action: 'Exported analytics report', time: '2 hours ago' },
    { user: 'Lisa Kim', action: 'Added team member', time: '3 hours ago' }
  ];

  const recipeCode =
    `<script lang="ts">
  import {
    Avatar, Badge, BarChart, Button, Card, Progress, Tooltip,
    SidebarLayout, MenuIcon, HomeIcon, BarChartIcon, UsersIcon, SettingsIcon
  } from '@urbicon-ui/blocks';

  let sidebarOpen = $state(false);
  let activeRoute = $state('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
    { id: 'analytics', label: 'Analytics', icon: BarChartIcon },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  const stats = [
    { label: 'Total Users', value: '12,847', change: '+12.5%', intent: 'success' as const, progress: 78, tooltip: 'Target: 16,500 users by Q2' },
    { label: 'Revenue', value: '$48,392', change: '+8.2%', intent: 'success' as const, progress: 64, tooltip: 'Target: $75,000 monthly' },
    { label: 'Active Sessions', value: '1,429', change: '-3.1%', intent: 'danger' as const, progress: 45, tooltip: 'Down from 1,475 last week' },
    { label: 'Conversion', value: '3.24%', change: '+0.8%', intent: 'success' as const, progress: 81, tooltip: 'Target: 4.0% conversion rate' }
  ];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chartData = [40, 65, 45, 80, 55, 70, 85, 60, 90, 75, 95, 88];
  const revenue = months.map((label, i) => ({ label, values: [chartData[i]] }));

  const recentActivity = [
    { user: 'Sarah Chen', action: 'Purchased Pro plan', time: '2 min ago' },
    { user: 'Marcus Rivera', action: 'Submitted support ticket', time: '15 min ago' },
    { user: 'Aisha Patel', action: 'Updated profile settings', time: '1 hour ago' },
    { user: 'Tom Weber', action: 'Exported analytics report', time: '2 hours ago' },
    { user: 'Lisa Kim', action: 'Added team member', time: '3 hours ago' }
  ];
</scr` +
    `ipt>

<SidebarLayout bind:open={sidebarOpen} sidebarWidth="14rem" data-design-pattern="dashboard">
  {#snippet sidebarHeader()}
    <a href="/" class="flex h-14 items-center px-4 font-bold text-primary">Acme Inc</a>
  {/snippet}

  {#snippet sidebar()}
    <nav class="flex flex-col gap-1 p-3">
      {#each navItems as item (item.id)}
        {@const Icon = item.icon}
        <button
          type="button"
          onclick={() => (activeRoute = item.id)}
          class={activeRoute === item.id
            ? 'flex items-center gap-2.5 rounded-lg bg-primary-subtle px-3 py-2 text-sm font-medium text-primary'
            : 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-text-primary'}
        >
          <Icon class="h-4 w-4 shrink-0" />
          <span>{item.label}</span>
        </button>
      {/each}
    </nav>
  {/snippet}

  {#snippet sidebarFooter()}
    <div class="flex items-center gap-3 p-3">
      <Avatar name="Mara Cohen" size="sm" />
      <div class="min-w-0">
        <div class="truncate text-xs font-medium text-text-primary">Mara C</div>
        <div class="truncate text-3xs text-text-tertiary">Admin</div>
      </div>
    </div>
  {/snippet}

  {#snippet mobileHeader({ openSidebar })}
    <Button variant="ghost" size="sm" onclick={openSidebar} aria-label="Open menu">
      <MenuIcon class="h-5 w-5" />
    </Button>
    <span class="font-semibold">Acme Inc</span>
  {/snippet}

  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p class="text-sm text-text-tertiary">Welcome back, Mara</p>
      </div>
      <Button size="sm" intent="primary">Export Report</Button>
    </div>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {#each stats as stat (stat.label)}
        <Card class="h-full" variant="elevated">
          <Tooltip label={stat.tooltip} placement="top">
            <div class="flex flex-col gap-2">
              <p class="min-h-8 text-xs font-medium text-text-tertiary">{stat.label}</p>
              <div class="flex items-baseline gap-2">
                <span class="text-2xl font-bold tabular-nums text-text-primary">{stat.value}</span>
                <Badge variant="soft" intent={stat.intent} size="sm">{stat.change}</Badge>
              </div>
              <Progress
                value={stat.progress}
                size="xs"
                intent={stat.intent === 'danger' ? 'danger' : 'primary'}
              />
            </div>
          </Tooltip>
        </Card>
      {/each}
    </div>

    <Card>
      <div class="space-y-4">
        <h2 class="text-sm font-semibold text-text-primary">Revenue Overview</h2>
        <BarChart
          data={revenue}
          series={[{ label: 'Revenue' }]}
          height={192}
          showLegend={false}
          ariaLabel="Monthly revenue"
        />
      </div>
    </Card>

    <Card>
      <div class="space-y-4">
        <h2 class="text-sm font-semibold text-text-primary">Recent Activity</h2>
        <div class="space-y-3">
          {#each recentActivity as activity (activity.user)}
            <div class="flex items-start gap-3">
              <Avatar name={activity.user} size="sm" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-text-primary">{activity.user}</p>
                <p class="text-xs text-text-tertiary">{activity.action} · {activity.time}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </Card>
  </div>
</SidebarLayout>`;
</script>

<SeoMeta title="Dashboard Layout Recipe" />

<div class="mx-auto max-w-6xl px-6 py-12">
  <!-- Header -->
  <div class="mb-10">
    <a
      href={resolve('/recipes')}
      class="text-text-tertiary hover:text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Recipes
    </a>
    <h1 class="text-text-primary mb-2 text-3xl font-bold">Dashboard Layout</h1>
    <p class="text-text-secondary mb-4 text-lg">
      App shell with persistent sidebar (responsive overlay on mobile), stat cards, chart, and
      activity feed — built on the <code class="bg-surface-subtle rounded px-1.5 py-0.5 text-sm"
        >SidebarLayout</code
      > primitive.
    </p>
    <div class="flex flex-wrap gap-1.5">
      {#each usedComponents as comp (comp)}
        <a href={r(componentLinks[comp] ?? '#')}>
          <Badge
            variant="outlined"
            intent="primary"
            size="sm"
            class="hover:bg-primary-subtle transition-colors">{comp}</Badge
          >
        </a>
      {/each}
    </div>
  </div>

  <!-- Live Preview — full width -->
  <Section id="preview" title="Live Preview">
    <div
      class="border-border-default relative mt-4 h-[640px] overflow-hidden rounded-xl border shadow-[var(--blocks-shadow-md)]"
    >
      <SidebarLayout
        bind:open={sidebarOpen}
        sidebarWidth="14rem"
        contentMaxWidth="none"
        slotClasses={{
          root: 'min-h-0 h-full relative',
          main: 'min-h-0 h-full overflow-auto',
          inner: 'p-6',
          sidebar: 'absolute',
          sidebarBackdrop: 'absolute'
        }}
      >
        {#snippet sidebarHeader()}
          <a
            href={resolve('/recipes/dashboard')}
            class="text-primary flex h-14 items-center px-4 font-bold"
            onclick={(e) => e.preventDefault()}>Acme Inc</a
          >
        {/snippet}

        {#snippet sidebar()}
          <nav class="flex flex-col gap-1 p-3">
            {#each navItems as item (item.id)}
              {@const Icon = item.icon}
              <button
                type="button"
                onclick={() => (activeRoute = item.id)}
                class={activeRoute === item.id
                  ? 'bg-primary-subtle text-primary flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm'}
              >
                <Icon class="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            {/each}
          </nav>
        {/snippet}

        {#snippet sidebarFooter()}
          <div class="flex items-center gap-3 p-3">
            <Avatar name="Mara Cohen" size="sm" />
            <div class="min-w-0">
              <div class="text-text-primary truncate text-xs font-medium">Mara C</div>
              <div class="text-text-tertiary truncate text-3xs">Admin</div>
            </div>
          </div>
        {/snippet}

        {#snippet mobileHeader({ openSidebar })}
          <Button variant="ghost" size="sm" onclick={openSidebar} aria-label="Open menu">
            <MenuIcon class="h-5 w-5" />
          </Button>
          <span class="font-semibold">Acme Inc</span>
        {/snippet}

        <div class="space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-text-primary text-2xl font-bold">Dashboard</h2>
              <p class="text-text-tertiary text-sm">Welcome back, Mara</p>
            </div>
            <Button size="sm" intent="primary">Export Report</Button>
          </div>

          <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {#each stats as stat (stat.label)}
              <Card class="h-full" variant="elevated">
                <Tooltip label={stat.tooltip} placement="top">
                  <div class="flex flex-col gap-2">
                    <p class="text-text-tertiary min-h-8 text-xs font-medium">{stat.label}</p>
                    <div class="flex items-baseline gap-2">
                      <span class="text-text-primary text-2xl font-bold tabular-nums"
                        >{stat.value}</span
                      >
                      <Badge variant="soft" intent={stat.intent} size="sm">{stat.change}</Badge>
                    </div>
                    <Progress
                      value={stat.progress}
                      size="xs"
                      intent={stat.intent === 'danger' ? 'danger' : 'primary'}
                    />
                  </div>
                </Tooltip>
              </Card>
            {/each}
          </div>

          <Card>
            <div class="space-y-4">
              <h3 class="text-text-primary text-sm font-semibold">Revenue Overview</h3>
              <BarChart
                data={revenue}
                series={[{ label: 'Revenue' }]}
                height={192}
                showLegend={false}
                ariaLabel="Monthly revenue"
              />
            </div>
          </Card>

          <Card>
            <div class="space-y-4">
              <h3 class="text-text-primary text-sm font-semibold">Recent Activity</h3>
              <div class="space-y-3">
                {#each recentActivity as activity (activity.user)}
                  <div class="flex items-start gap-3">
                    <Avatar name={activity.user} size="sm" />
                    <div class="min-w-0 flex-1">
                      <p class="text-text-primary truncate text-sm font-medium">{activity.user}</p>
                      <p class="text-text-tertiary text-xs">{activity.action} · {activity.time}</p>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </Card>
        </div>
      </SidebarLayout>
    </div>
  </Section>

  <!-- Source Code -->
  <div class="mt-12">
    <CodeExample
      title="Dashboard Layout Recipe"
      code={recipeCode}
      language="svelte"
      preview={false}
    />
  </div>
</div>
