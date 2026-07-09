<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import {
    Accordion,
    AccordionItem,
    Alert,
    Avatar,
    Badge,
    Breadcrumb,
    Button,
    Card,
    Checkbox,
    Input,
    Select,
    Pagination,
    Separator,
    Skeleton,
    Tab,
    TabItem,
    Toggle,
    Tooltip
  } from '@urbicon-ui/blocks';
  import { Section } from '@urbicon-ui/docs';
  import { componentLinks } from '$lib/component-links';

  let activeTab = $state('overview');
  let searchQuery = $state('');
  let darkMode = $state(false);
  let notifications = $state(true);
  let currentPage = $state(1);
  let selectedPriority = $state('all');
  let showAlert = $state(true);

  const priorityOptions = [
    { value: 'all', label: 'All Priorities' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  const tasks = [
    {
      id: 1,
      title: 'Design token migration',
      assignee: 'Sarah C',
      priority: 'high',
      status: 'done'
    },
    {
      id: 2,
      title: 'Implement Combobox component',
      assignee: 'Marcus R',
      priority: 'high',
      status: 'done'
    },
    {
      id: 3,
      title: 'Write variant tests',
      assignee: 'Aisha P',
      priority: 'medium',
      status: 'in-progress'
    },
    {
      id: 4,
      title: 'Update documentation',
      assignee: 'Tom W',
      priority: 'medium',
      status: 'in-progress'
    },
    { id: 5, title: 'Figma token export', assignee: 'Lisa K', priority: 'low', status: 'todo' },
    { id: 6, title: 'Performance audit', assignee: 'James B', priority: 'low', status: 'todo' }
  ];

  const breadcrumbItems = [
    { label: 'Workspace', href: '#' },
    { label: 'Project Alpha', href: '#' },
    { label: 'Sprint 12' }
  ];

  const priorityIntent = {
    high: 'danger' as const,
    medium: 'warning' as const,
    low: 'neutral' as const
  };

  const statusIntent = {
    done: 'success' as const,
    'in-progress': 'primary' as const,
    todo: 'neutral' as const
  };

  let filteredTasks = $derived.by(() => {
    let result = tasks;
    if (selectedPriority !== 'all') {
      result = result.filter((t) => t.priority === selectedPriority);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q));
    }
    return result;
  });

  const sections = [
    {
      name: 'App Shell',
      description: 'Header with branding, navigation, and user area',
      components: ['Avatar', 'Breadcrumb', 'Separator', 'Tooltip', 'Alert']
    },
    {
      name: 'Overview Tab',
      description: 'Stats grid, progress bar, and team members',
      components: ['Card', 'Badge', 'Avatar', 'Tooltip']
    },
    {
      name: 'Tasks Tab',
      description: 'Filterable task list with search and priority',
      components: [
        'Input',
        'Menu',
        'Button',
        'Card',
        'Checkbox',
        'Badge',
        'Avatar',
        'Tooltip',
        'Pagination'
      ]
    },
    {
      name: 'Settings Tab',
      description: 'Accordion-based preferences with toggles and inputs',
      components: ['Accordion', 'AccordionItem', 'Toggle', 'Input', 'Button', 'Card', 'Skeleton']
    }
  ];

  const allComponents = [...new Set(sections.flatMap((s) => s.components))];
</script>

<SeoMeta
  title="Showcase"
  description="Interactive showcase demonstrating Urbicon UI components working together in a realistic project management application."
/>

<!-- Color Rooms hero field (default blocks room) — full-width band flush to the
     app sidebar; stats stay on paper below, inner wrapper aligns with the body. -->
<div data-room-hero>
  <div class="mx-auto max-w-6xl px-6">
    <h1 class="text-text-primary text-4xl font-bold">Component Showcase</h1>
    <p class="text-text-secondary mt-3 max-w-3xl text-lg">
      A realistic project management interface built entirely with Urbicon UI. Every element uses
      design tokens, semantic colors, and the component API. Explore each section to see how
      components compose together.
    </p>
  </div>
</div>

<div class="mx-auto max-w-6xl px-6 pb-12 pt-10">
  <!-- Hero stats -->
  <div class="mb-10">
    <!-- Stats -->
    <div class="mt-6 flex flex-wrap gap-6">
      <div
        class="border-border-subtle bg-surface-elevated rounded-contain flex items-center gap-2 border px-4 py-2"
      >
        <Badge variant="filled" intent="primary" size="sm">{allComponents.length}</Badge>
        <span class="text-text-secondary text-sm">Components Used</span>
      </div>
      <div
        class="border-border-subtle bg-surface-elevated rounded-contain flex items-center gap-2 border px-4 py-2"
      >
        <Badge variant="filled" intent="success" size="sm">{sections.length}</Badge>
        <span class="text-text-secondary text-sm">Interactive Sections</span>
      </div>
      <div
        class="border-border-subtle bg-surface-elevated rounded-contain flex items-center gap-2 border px-4 py-2"
      >
        <Badge variant="filled" intent="warning" size="sm">3</Badge>
        <span class="text-text-secondary text-sm">Tab Views</span>
      </div>
    </div>
  </div>

  <!-- Component Map -->
  <Section
    id="component-map"
    title="Component Map"
    subtitle="Which components are used in each section of the demo app."
  >
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each sections as section (section.name)}
        <Card class="border-border-subtle">
          <div class="p-4">
            <h4 class="text-text-primary mb-1 text-sm font-semibold">{section.name}</h4>
            <p class="text-text-tertiary mb-3 text-xs">{section.description}</p>
            <div class="flex flex-wrap gap-1">
              {#each section.components as comp (comp)}
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
        </Card>
      {/each}
    </div>
  </Section>

  <!-- Demo App -->
  <div class="mt-10">
    <Section
      id="demo"
      title="Live Demo"
      subtitle="Fully interactive -- try the tabs, search, filters, and toggles."
    >
      <div
        class="border-border-subtle overflow-hidden rounded-xl border shadow-[var(--blocks-shadow-lg)]"
      >
        <!-- App Header -->
        <div
          class="border-border-subtle bg-surface-elevated flex items-center justify-between border-b px-6 py-3"
        >
          <div class="flex items-center gap-4">
            <div
              class="bg-primary text-text-on-primary rounded-modify flex h-8 w-8 items-center justify-center text-xs font-bold"
            >
              UI
            </div>
            <span class="text-text-primary text-sm font-semibold">Urbicon Project Hub</span>
            <Separator orientation="vertical" class="h-5" />
            <Breadcrumb items={breadcrumbItems} size="sm" />
          </div>
          <div class="flex items-center gap-3">
            <Tooltip label="Toggle notifications" placement="bottom">
              <button
                class="text-text-tertiary hover:bg-surface-hover hover:text-text-primary rounded-modify relative p-2 transition-colors"
                onclick={() => (notifications = !notifications)}
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  ><path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  /></svg
                >
                {#if notifications}<span
                    class="bg-danger absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                  ></span>{/if}
              </button>
            </Tooltip>
            <Avatar name="Sam Rivera" size="sm" />
          </div>
        </div>

        <!-- Alert Banner -->
        {#if showAlert}
          <div class="border-border-subtle border-b">
            <Alert
              intent="primary"
              variant="soft"
              size="sm"
              dismissible
              onDismiss={() => (showAlert = false)}
            >
              Sprint 12 ends in 3 days. 2 tasks remaining.
            </Alert>
          </div>
        {/if}

        <!-- Content Area -->
        <div class="bg-surface-base">
          <div class="border-border-subtle border-b px-6">
            <Tab value={activeTab} onValueChange={(v) => (activeTab = v)}>
              {#snippet tabs()}
                <TabItem value="overview">Overview</TabItem>
                <TabItem value="tasks">Tasks</TabItem>
                <TabItem value="settings">Settings</TabItem>
              {/snippet}
            </Tab>
          </div>

          <div class="p-6">
            <!-- Overview Tab -->
            {#if activeTab === 'overview'}
              <div class="space-y-6">
                <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {#each [{ label: 'Total Tasks', value: '24', badge: 'Sprint 12' }, { label: 'Completed', value: '18', badge: '75%' }, { label: 'In Progress', value: '4', badge: 'On track' }, { label: 'Team Members', value: '6', badge: 'Active' }] as stat (stat.label)}
                    <Card class="border-border-subtle">
                      <div class="p-4">
                        <div class="flex items-center justify-between">
                          <p class="text-text-tertiary text-xs">{stat.label}</p>
                          <Badge variant="soft" intent="neutral" size="sm">{stat.badge}</Badge>
                        </div>
                        <p class="text-text-primary mt-1 text-2xl font-bold">{stat.value}</p>
                      </div>
                    </Card>
                  {/each}
                </div>

                <Card class="border-border-subtle">
                  <div class="p-4">
                    <div class="mb-3 flex items-center justify-between">
                      <h3 class="text-text-primary text-sm font-semibold">Sprint Progress</h3>
                      <span class="text-primary text-sm font-medium">75%</span>
                    </div>
                    <div class="bg-surface-subtle h-2 overflow-hidden rounded-full">
                      <div
                        class="bg-primary h-full rounded-full transition-all duration-[var(--blocks-duration-slow)]"
                        style="width: 75%"
                      ></div>
                    </div>
                  </div>
                </Card>

                <Card class="border-border-subtle">
                  <div class="p-4">
                    <h3 class="text-text-primary mb-4 text-sm font-semibold">Team</h3>
                    <div class="flex flex-wrap gap-3">
                      {#each ['Sarah Chen', 'Marcus Rivera', 'Aisha Patel', 'Tom Weber', 'Lisa Kim', 'James Brown'] as name (name)}
                        <Tooltip label={name} placement="top">
                          <Avatar {name} size="md" />
                        </Tooltip>
                      {/each}
                    </div>
                  </div>
                </Card>
              </div>

              <!-- Tasks Tab -->
            {:else if activeTab === 'tasks'}
              <div class="space-y-4">
                <div class="flex flex-wrap items-center gap-3">
                  <Input
                    placeholder="Search tasks..."
                    size="sm"
                    bind:value={searchQuery}
                    class="max-w-xs"
                  />
                  <Select
                    options={priorityOptions}
                    value={selectedPriority}
                    onValueChange={(v: string | null) => {
                      if (v) selectedPriority = v;
                    }}
                    size="sm"
                    placeholder="Priority"
                  />
                  <div class="ml-auto">
                    <Button size="sm" intent="primary">Add Task</Button>
                  </div>
                </div>

                <Card class="border-border-subtle overflow-hidden">
                  <div class="divide-border-subtle divide-y">
                    {#each filteredTasks as task (task.id)}
                      <div
                        class="hover:bg-surface-hover flex items-center gap-4 px-4 py-3 transition-colors"
                      >
                        <Checkbox size="sm" checked={task.status === 'done'} />
                        <span
                          class="flex-1 text-sm {task.status === 'done'
                            ? 'text-text-disabled line-through'
                            : 'text-text-primary'}">{task.title}</span
                        >
                        <Badge
                          variant="soft"
                          intent={priorityIntent[task.priority as keyof typeof priorityIntent]}
                          size="sm"
                          class="capitalize">{task.priority}</Badge
                        >
                        <Badge
                          variant="outlined"
                          intent={statusIntent[task.status as keyof typeof statusIntent]}
                          size="sm"
                          class="capitalize"
                          >{task.status === 'in-progress' ? 'In Progress' : task.status}</Badge
                        >
                        <Tooltip label={task.assignee} placement="left">
                          <Avatar name={task.assignee} size="xs" />
                        </Tooltip>
                      </div>
                    {/each}
                    {#if filteredTasks.length === 0}
                      <div class="text-text-tertiary py-8 text-center text-sm">
                        No tasks match your filters.
                      </div>
                    {/if}
                  </div>
                </Card>

                <div class="flex justify-center">
                  <Pagination
                    totalPages={3}
                    {currentPage}
                    onPageChange={(p) => (currentPage = p)}
                    size="sm"
                  />
                </div>
              </div>

              <!-- Settings Tab -->
            {:else if activeTab === 'settings'}
              <div class="max-w-lg space-y-6">
                <Accordion variant="separated">
                  <AccordionItem value="notifications" title="Notification Preferences">
                    <div class="space-y-4">
                      <div class="flex items-center justify-between">
                        <span class="text-text-secondary text-sm">Email notifications</span>
                        <Toggle
                          checked={notifications}
                          onCheckedChange={(v: boolean) => (notifications = v)}
                          size="sm"
                        />
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="text-text-secondary text-sm">Dark mode</span>
                        <Toggle
                          checked={darkMode}
                          onCheckedChange={(v: boolean) => (darkMode = v)}
                          size="sm"
                        />
                      </div>
                    </div>
                  </AccordionItem>
                  <AccordionItem value="project" title="Project Settings">
                    <div class="space-y-4">
                      <Input label="Project Name" value="Project Alpha" size="sm" />
                      <Input label="Description" value="Main product development" size="sm" />
                    </div>
                  </AccordionItem>
                  <AccordionItem value="danger" title="Danger Zone">
                    <div class="space-y-3">
                      <p class="text-text-secondary text-sm">These actions are irreversible.</p>
                      <Button size="sm" variant="outlined" intent="danger">Archive Project</Button>
                    </div>
                  </AccordionItem>
                </Accordion>

                <div class="flex justify-end gap-3">
                  <Button variant="ghost" intent="neutral" size="sm">Cancel</Button>
                  <Button intent="primary" size="sm">Save Changes</Button>
                </div>

                <Card class="border-border-subtle">
                  <div class="p-4">
                    <h3 class="text-text-primary mb-3 text-sm font-semibold">
                      Loading State Preview
                    </h3>
                    <div class="space-y-3">
                      <Skeleton variant="text" class="w-3/4" />
                      <Skeleton variant="text" class="w-1/2" />
                      <div class="flex gap-3">
                        <Skeleton variant="circular" class="h-10 w-10" />
                        <div class="flex-1 space-y-2">
                          <Skeleton variant="text" class="w-1/3" />
                          <Skeleton variant="text" class="w-2/3" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            {/if}
          </div>
        </div>
      </div>
    </Section>
  </div>

  <!-- All Components Used -->
  <div class="mt-10">
    <Section
      id="all-components"
      title="All Components"
      subtitle="Every component used in this showcase, linked to its documentation."
    >
      <div class="flex flex-wrap gap-2">
        {#each allComponents.sort() as comp (comp)}
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
    </Section>
  </div>

  <!-- Footer CTAs -->
  <div class="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
    <Card
      href={resolve('/recipes')}
      class="group border-border-subtle hover:border-primary h-full transition-all hover:shadow-[var(--blocks-shadow-md)]"
    >
      <div class="p-6 text-center">
        <div
          class="bg-primary-subtle rounded-modify mx-auto mb-3 flex h-10 w-10 items-center justify-center"
        >
          <svg class="text-primary h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            /></svg
          >
        </div>
        <h3 class="text-text-primary group-hover:text-primary mb-1 font-semibold">UI Recipes</h3>
        <p class="text-text-tertiary text-sm">Copy-paste ready patterns</p>
      </div>
    </Card>
    <Card
      href={resolve('/blocks')}
      class="group border-border-subtle hover:border-primary h-full transition-all hover:shadow-[var(--blocks-shadow-md)]"
    >
      <div class="p-6 text-center">
        <div
          class="bg-success-subtle rounded-modify mx-auto mb-3 flex h-10 w-10 items-center justify-center"
        >
          <svg class="text-success h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
            /></svg
          >
        </div>
        <h3 class="text-text-primary group-hover:text-primary mb-1 font-semibold">
          All Components
        </h3>
        <p class="text-text-tertiary text-sm">Browse the full library</p>
      </div>
    </Card>
    <Card
      href={resolve('/getting-started')}
      class="group border-border-subtle hover:border-primary h-full transition-all hover:shadow-[var(--blocks-shadow-md)]"
    >
      <div class="p-6 text-center">
        <div
          class="bg-warning-subtle rounded-modify mx-auto mb-3 flex h-10 w-10 items-center justify-center"
        >
          <svg class="text-warning h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            ><path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            /></svg
          >
        </div>
        <h3 class="text-text-primary group-hover:text-primary mb-1 font-semibold">
          Getting Started
        </h3>
        <p class="text-text-tertiary text-sm">Set up in 5 minutes</p>
      </div>
    </Card>
  </div>
</div>
