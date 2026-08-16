<script lang="ts">
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
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

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

  // The demo runs an app shell inside a docs page, so it needs a viewport:
  // SidebarLayout sizes itself min-h-screen, and its mobile sidebar and
  // backdrop position fixed, which would overlay the docs page. The elevated
  // Card around the demo is that viewport (padding="none", fixed height,
  // overflow clipped), and the demo-only SidebarLayout props re-anchor the
  // layout into it: root/main swap min-h-screen for h-full with the box's own
  // scrollbar, sidebar and backdrop turn absolute against the now-relative
  // root, and contentMaxWidth="none" + inner p-6 fit the column. recipeCode
  // shows none of this — a pasted copy owns the real viewport with the
  // layout's defaults. Two more demo liberties: the logo link is defused, and
  // the page's h1/h2 render as h2/h3 under the docs page's own outline.
  const recipeCode = `<\script lang="ts">
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

  let sidebarOpen = $state(false);
  // Stand-in for the router: in an app the rail items are <a>s and the
  // current one is derived from the route, not clicked into local state.
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
<\/script>

<!-- The shell is the app frame: mount it once in your layout file and render
     each route as its children. This page is one of them. -->
<SidebarLayout bind:open={sidebarOpen} sidebarWidth="14rem">
  {#snippet sidebarHeader()}
    <a href="/" class="text-primary flex h-14 items-center px-4 font-bold">Acme Inc</a>
  {/snippet}

  {#snippet sidebar()}
    <nav aria-label="Dashboard sidebar" class="flex flex-col gap-1 p-3">
      {#each navItems as item (item.id)}
        {@const Icon = item.icon}
        <button
          type="button"
          onclick={() => (activeRoute = item.id)}
          aria-current={activeRoute === item.id ? 'page' : undefined}
          class={[
            'flex items-center gap-2.5 rounded-modify px-3 py-2 text-sm',
            activeRoute === item.id
              ? 'bg-primary-subtle text-primary font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          ]}
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
        <div class="text-text-tertiary text-3xs truncate">Admin</div>
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
        <h1 class="text-text-primary text-2xl font-bold">Dashboard</h1>
        <p class="text-text-tertiary text-sm">Welcome back, Mara</p>
      </div>
      <Button size="sm" intent="primary">Export Report</Button>
    </div>

    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {#each stats as stat (stat.label)}
        <Card variant="elevated">
          <Tooltip label={stat.tooltip}>
            <div class="flex flex-col gap-2">
              <!-- min-h-8 holds two label lines, so the value row keeps one
                   baseline across the grid when a label wraps. -->
              <p class="text-text-tertiary min-h-8 text-xs font-medium">{stat.label}</p>
              <div class="flex items-baseline gap-2">
                <span class="text-text-primary text-2xl font-bold tabular-nums">{stat.value}</span>
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

    <Card variant="elevated">
      <div class="space-y-4">
        <h2 class="text-text-primary text-sm font-semibold">Revenue Overview</h2>
        <BarChart
          data={revenue}
          series={[{ label: 'Revenue' }]}
          height={192}
          showLegend={false}
          ariaLabel="Monthly revenue"
        />
      </div>
    </Card>

    <Card variant="elevated">
      <div class="space-y-4">
        <h2 class="text-text-primary text-sm font-semibold">Recent Activity</h2>
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
</SidebarLayout>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="DashboardPage.svelte"
      description="Hover a stat tile for its target; narrow the window below 1024px and the rail moves behind the menu button."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <Card
        variant="elevated"
        padding="none"
        class="h-160 overflow-hidden"
        slotClasses={{ content: 'h-full' }}
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
            <nav aria-label="Dashboard sidebar" class="flex flex-col gap-1 p-3">
              {#each navItems as item (item.id)}
                {@const Icon = item.icon}
                <button
                  type="button"
                  onclick={() => (activeRoute = item.id)}
                  aria-current={activeRoute === item.id ? 'page' : undefined}
                  class={[
                    'rounded-modify flex items-center gap-2.5 px-3 py-2 text-sm',
                    activeRoute === item.id
                      ? 'bg-primary-subtle text-primary font-medium'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  ]}
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
                <div class="text-text-tertiary text-3xs truncate">Admin</div>
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
                <Card variant="elevated">
                  <Tooltip label={stat.tooltip}>
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

            <Card variant="elevated">
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

            <Card variant="elevated">
              <div class="space-y-4">
                <h3 class="text-text-primary text-sm font-semibold">Recent Activity</h3>
                <div class="space-y-3">
                  {#each recentActivity as activity (activity.user)}
                    <div class="flex items-start gap-3">
                      <Avatar name={activity.user} size="sm" />
                      <div class="min-w-0 flex-1">
                        <p class="text-text-primary truncate text-sm font-medium">
                          {activity.user}
                        </p>
                        <p class="text-text-tertiary text-xs">
                          {activity.action} · {activity.time}
                        </p>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </Card>
          </div>
        </SidebarLayout>
      </Card>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Mounting the shell">
    <NoteList>
      <Note title="One shell, all routes">
        <p>
          <code class="text-text-primary">SidebarLayout</code> is the app frame, so it belongs in
          the layout file rather than on a page: mount it once (<code class="text-text-primary"
            >+layout.svelte</code
          >
          in SvelteKit) and render each route as its children, and the rail survives navigation. The header
          row, stat grid and panels here are one such route. The nav buttons then become
          <code class="text-text-primary">&lt;a&gt;</code>s, with
          <code class="text-text-primary">aria-current</code> derived from the current route instead
          of <code class="text-text-primary">activeRoute</code> state.
        </p>
      </Note>
      <Note title="Your copy owns the viewport">
        <p>
          The preview locks the shell into a fixed-height card so the mobile overlay stays inside
          the demo; the code carries none of that. Pasted into an app, the shell spans the viewport
          and centres its content column at
          <code class="text-text-primary">contentMaxWidth="xl"</code> with responsive padding. Pass
          <code class="text-text-primary">"none"</code> when a dashboard should run edge to edge, the
          way the demo does inside its box.
        </p>
      </Note>
    </NoteList>

    <p class="text-text-secondary mt-6 text-sm">
      The stat tiles are the short form of a pattern with a page of its own:
      <a class="text-primary hover:underline" href={resolve('/recipes/stat-tile')}>Stat Tile</a>
      isolates the KPI card, with an icon tile and trend indicator.
    </p>
  </Section>
</RecipeShell>
