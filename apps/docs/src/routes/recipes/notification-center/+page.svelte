<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '$lib/route';
  import {
    Drawer,
    Tab,
    TabItem,
    TabPanel,
    Badge,
    Avatar,
    Button,
    Tooltip
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { componentLinks } from '$lib/component-links';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  interface Notification {
    id: string;
    title: string;
    description: string;
    sender: string;
    time: string;
    read: boolean;
    type: 'info' | 'success' | 'warning';
  }

  let drawerOpen = $state(false);
  let activeTab = $state('all');

  let notifications = $state<Notification[]>([
    {
      id: '1',
      title: 'Commented on your design',
      description: 'Left feedback on the Dashboard redesign file in Figma.',
      sender: 'Sarah Chen',
      time: '2 min ago',
      read: false,
      type: 'info'
    },
    {
      id: '2',
      title: 'Build #1234 succeeded',
      description: 'The production deployment pipeline completed successfully.',
      sender: 'CI Bot',
      time: '15 min ago',
      read: false,
      type: 'success'
    },
    {
      id: '3',
      title: 'New team member invited',
      description: 'Marcus Rivera has been invited to the Engineering workspace.',
      sender: 'Aisha Patel',
      time: '1 hour ago',
      read: false,
      type: 'info'
    },
    {
      id: '4',
      title: 'Storage quota warning',
      description: 'Your workspace has used 85% of its allocated storage.',
      sender: 'System',
      time: '2 hours ago',
      read: true,
      type: 'warning'
    },
    {
      id: '5',
      title: 'Merged pull request #89',
      description: 'Feature branch "add-drawer-component" was merged into main.',
      sender: 'Tom Weber',
      time: '3 hours ago',
      read: true,
      type: 'success'
    },
    {
      id: '6',
      title: 'Mentioned you in a comment',
      description: 'Tagged you in the API versioning discussion thread.',
      sender: 'Lisa Kim',
      time: '5 hours ago',
      read: false,
      type: 'info'
    },
    {
      id: '7',
      title: 'Billing invoice ready',
      description: 'Your March invoice for $249.00 is available for download.',
      sender: 'Billing',
      time: 'Yesterday',
      read: true,
      type: 'info'
    }
  ]);

  let unreadCount = $derived(notifications.filter((n) => !n.read).length);
  let unreadNotifications = $derived(notifications.filter((n) => !n.read));

  function markAsRead(id: string) {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  }

  function archiveNotification(id: string) {
    notifications = notifications.filter((n) => n.id !== id);
  }

  function markAllAsRead() {
    notifications = notifications.map((n) => ({ ...n, read: true }));
  }

  const typeColors: Record<Notification['type'], string> = {
    info: 'bg-primary-subtle',
    success: 'bg-success-subtle',
    warning: 'bg-warning-subtle'
  };

  const recipeCode =
    `<script lang="ts">
  import {
    Drawer, Tab, TabItem, TabPanel,
    Badge, Avatar, Button, Separator, Tooltip
  } from '@urbicon-ui/blocks';

  interface Notification {
    id: string;
    title: string;
    description: string;
    sender: string;
    time: string;
    read: boolean;
    type: 'info' | 'success' | 'warning';
  }

  let drawerOpen = $state(false);
  let activeTab = $state('all');

  let notifications = $state<Notification[]>([
    {
      id: '1',
      title: 'Commented on your design',
      description: 'Left feedback on the Dashboard redesign file.',
      sender: 'Sarah Chen',
      time: '2 min ago',
      read: false,
      type: 'info'
    },
    {
      id: '2',
      title: 'Build #1234 succeeded',
      description: 'Production deployment completed successfully.',
      sender: 'CI Bot',
      time: '15 min ago',
      read: false,
      type: 'success'
    },
    {
      id: '3',
      title: 'New team member invited',
      description: 'Marcus Rivera invited to Engineering workspace.',
      sender: 'Aisha Patel',
      time: '1 hour ago',
      read: false,
      type: 'info'
    },
    {
      id: '4',
      title: 'Storage quota warning',
      description: 'Workspace has used 85% of allocated storage.',
      sender: 'System',
      time: '2 hours ago',
      read: true,
      type: 'warning'
    }
  ]);

  let unreadCount = $derived(notifications.filter((n) => !n.read).length);
  let unreadNotifications = $derived(notifications.filter((n) => !n.read));

  function markAsRead(id: string) {
    notifications = notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
  }

  function archiveNotification(id: string) {
    notifications = notifications.filter((n) => n.id !== id);
  }

  function markAllAsRead() {
    notifications = notifications.map((n) => ({ ...n, read: true }));
  }
</scr` +
    `ipt>

<!-- Trigger Button -->
<Button variant="outlined" intent="neutral" onclick={() => (drawerOpen = true)}>
  <span class="relative inline-flex items-center gap-2">
    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
    Notifications
    {#if unreadCount > 0}
      <Badge variant="soft" intent="danger" size="sm">{unreadCount}</Badge>
    {/if}
  </span>
</Button>

<!-- Notification Drawer -->
<Drawer bind:open={drawerOpen} title="Notifications" placement="right" size="md" onClose={() => (drawerOpen = false)}>
  <Tab bind:value={activeTab} variant="line" size="sm">
    {#snippet tabs()}
      <TabItem value="all">All</TabItem>
      <TabItem value="unread">
        Unread
        {#if unreadCount > 0}
          <Badge variant="soft" intent="danger" size="sm" class="ml-1.5">{unreadCount}</Badge>
        {/if}
      </TabItem>
    {/snippet}
    {#snippet panels()}
      <TabPanel value="all">
        <div class="divide-y divide-border-subtle">
          {#each notifications as notification (notification.id)}
              <!-- Notification item -->
              <div class={['flex gap-3 px-1 py-3', notification.read && 'opacity-60']}>
                <Avatar name={notification.sender} size="sm" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-text-primary">{notification.title}</p>
                  <p class="mt-0.5 text-xs text-text-secondary">{notification.description}</p>
                  <p class="mt-1 text-xs text-text-quaternary">{notification.sender} &middot; {notification.time}</p>
                </div>
                <div class="flex shrink-0 items-start gap-1">
                  {#if !notification.read}
                    <Tooltip label="Mark as read">
                      <button class="rounded p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Mark as read" onclick={() => markAsRead(notification.id)}>
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </button>
                    </Tooltip>
                  {/if}
                  <Tooltip label="Archive">
                    <button class="rounded p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50" aria-label="Archive" onclick={() => archiveNotification(notification.id)}>
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><line x1="10" y1="13" x2="14" y2="13" /></svg>
                    </button>
                  </Tooltip>
                </div>
              </div>
            {/each}
          </div>
        </TabPanel>
        <TabPanel value="unread">
          <!-- Same structure, filtered to unread only -->
        </TabPanel>
      {/snippet}
    </Tab>
  {#snippet footer()}
    <Button size="sm" variant="ghost" intent="neutral" onclick={markAllAsRead} disabled={unreadCount === 0}>
      Mark all as read
    </Button>
  {/snippet}
</Drawer>`;
</script>

<SeoMeta title="Notification Center Recipe" />

<div class="mx-auto max-w-6xl px-6 py-12">
  <!-- Header -->
  <div class="mb-10">
    <a
      href={resolve('/recipes')}
      class="text-text-tertiary hover:text-primary mb-4 inline-flex items-center gap-1 text-sm transition-colors"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        ><path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        /></svg
      >
      Back to Recipes
    </a>
    <h1 class="text-text-primary mb-2 text-3xl font-bold">Notification Center</h1>
    <p class="text-text-secondary mb-4 text-lg">
      Slide-in notification panel with tabs, filtering, and action buttons.
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

  <div class="grid grid-cols-1 gap-10 xl:grid-cols-3">
    <!-- Live Preview (2 cols) -->
    <div class="xl:col-span-2">
      <Section id="preview" title="Live Preview">
        <div
          class="border-border-subtle bg-surface-subtle mt-4 flex min-h-[480px] items-center justify-center rounded-xl border p-8"
        >
          <Button variant="outlined" intent="neutral" onclick={() => (drawerOpen = true)}>
            <span class="relative inline-flex items-center gap-2">
              <svg
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              Notifications
              {#if unreadCount > 0}
                <Badge variant="soft" intent="danger" size="sm">{unreadCount}</Badge>
              {/if}
            </span>
          </Button>
        </div>
      </Section>
    </div>

    <!-- Sidebar -->
    <div class="space-y-8">
      <Section id="features" title="Key Features" headingLevel={3}>
        <ul class="space-y-2">
          {#each features as feature (feature)}
            <li class="text-text-secondary flex items-start gap-2 text-sm">
              <svg
                class="text-success mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                /></svg
              >
              {feature}
            </li>
          {/each}
        </ul>
      </Section>

      <Section id="components" title="Components Used" headingLevel={3}>
        <div class="space-y-2">
          {#each usedComponents as comp (comp)}
            <a
              href={r(componentLinks[comp] ?? '#')}
              class="text-text-secondary hover:bg-surface-hover hover:text-primary flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <svg
                class="text-primary h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                ><path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 7l5 5-5 5M6 12h12"
                /></svg
              >
              {comp}
            </a>
          {/each}
        </div>
      </Section>
    </div>
  </div>

  <!-- Source Code -->
  <div class="mt-12">
    <CodeExample
      title="Notification Center Recipe"
      code={recipeCode}
      language="svelte"
      preview={false}
    />
  </div>
</div>

<!-- Drawer renders at page level, outside the preview box -->
<Drawer
  bind:open={drawerOpen}
  title="Notifications"
  placement="right"
  size="md"
  onClose={() => (drawerOpen = false)}
>
  <Tab bind:value={activeTab} variant="line" size="sm">
    {#snippet tabs()}
      <TabItem value="all">All</TabItem>
      <TabItem value="unread">
        <span class="inline-flex items-center gap-1.5">
          Unread
          {#if unreadCount > 0}
            <Badge variant="soft" intent="danger" size="sm">{unreadCount}</Badge>
          {/if}
        </span>
      </TabItem>
    {/snippet}

    {#snippet panels()}
      <TabPanel value="all">
        <div class="divide-border-subtle divide-y">
          {#each notifications as notification (notification.id)}
            <div
              class={[
                'flex gap-3 px-1 py-3 transition-opacity duration-[var(--blocks-duration-normal)]',
                notification.read && 'opacity-60'
              ]}
            >
              <Avatar name={notification.sender} size="sm" />
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <p class="text-text-primary text-sm font-medium">{notification.title}</p>
                  {#if !notification.read}
                    <span
                      class={[
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        typeColors[notification.type]
                      ].join(' ')}
                    ></span>
                  {/if}
                </div>
                <p class="text-text-secondary mt-0.5 text-xs">{notification.description}</p>
                <p class="text-text-quaternary mt-1 text-xs">
                  {notification.sender} &middot; {notification.time}
                </p>
              </div>
              <div class="flex shrink-0 items-start gap-1">
                {#if !notification.read}
                  <Tooltip label="Mark as read">
                    <button
                      class="text-text-tertiary hover:bg-surface-hover hover:text-primary focus-visible:ring-primary/50 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      onclick={() => markAsRead(notification.id)}
                      aria-label="Mark as read"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg
                      >
                    </button>
                  </Tooltip>
                {/if}
                <Tooltip label="Archive">
                  <button
                    class="text-text-tertiary hover:bg-surface-hover hover:text-primary focus-visible:ring-primary/50 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    onclick={() => archiveNotification(notification.id)}
                    aria-label="Archive"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><rect x="2" y="4" width="20" height="5" rx="1" /><path
                        d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"
                      /><line x1="10" y1="13" x2="14" y2="13" /></svg
                    >
                  </button>
                </Tooltip>
              </div>
            </div>
          {/each}
        </div>
      </TabPanel>

      <TabPanel value="unread">
        {#if unreadNotifications.length === 0}
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <svg
              class="text-text-quaternary mb-3 h-10 w-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            <p class="text-text-secondary text-sm font-medium">All caught up</p>
            <p class="text-text-quaternary mt-1 text-xs">No unread notifications.</p>
          </div>
        {:else}
          <div class="divide-border-subtle divide-y">
            {#each unreadNotifications as notification (notification.id)}
              <div class="flex gap-3 px-1 py-3">
                <Avatar name={notification.sender} size="sm" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-text-primary text-sm font-medium">{notification.title}</p>
                    <span
                      class={[
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        typeColors[notification.type]
                      ].join(' ')}
                    ></span>
                  </div>
                  <p class="text-text-secondary mt-0.5 text-xs">{notification.description}</p>
                  <p class="text-text-quaternary mt-1 text-xs">
                    {notification.sender} &middot; {notification.time}
                  </p>
                </div>
                <div class="flex shrink-0 items-start gap-1">
                  <Tooltip label="Mark as read">
                    <button
                      class="text-text-tertiary hover:bg-surface-hover hover:text-primary focus-visible:ring-primary/50 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      onclick={() => markAsRead(notification.id)}
                      aria-label="Mark as read"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg
                      >
                    </button>
                  </Tooltip>
                  <Tooltip label="Archive">
                    <button
                      class="text-text-tertiary hover:bg-surface-hover hover:text-primary focus-visible:ring-primary/50 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      onclick={() => archiveNotification(notification.id)}
                      aria-label="Archive"
                    >
                      <svg
                        class="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        ><rect x="2" y="4" width="20" height="5" rx="1" /><path
                          d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"
                        /><line x1="10" y1="13" x2="14" y2="13" /></svg
                      >
                    </button>
                  </Tooltip>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </TabPanel>
    {/snippet}
  </Tab>

  {#snippet footer()}
    <div class="flex items-center justify-between">
      <Button
        size="sm"
        variant="ghost"
        intent="neutral"
        onclick={markAllAsRead}
        disabled={unreadCount === 0}
      >
        Mark all as read
      </Button>
      <p class="text-text-quaternary text-xs">{notifications.length} notifications</p>
    </div>
  {/snippet}
</Drawer>
