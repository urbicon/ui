<script lang="ts">
  import {
    ArchiveIcon,
    Avatar,
    Badge,
    BellIcon,
    Button,
    CheckIcon,
    Drawer,
    Tab,
    TabItem,
    TabPanel,
    Tooltip
  } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

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

  // Both badges, the Unread panel and the footer's disabled state derive from
  // the one notifications array; nothing keeps a second list.
  let unreadCount = $derived(notifications.filter((n) => !n.read).length);
  let unreadNotifications = $derived(notifications.filter((n) => !n.read));

  // Your API calls slot in here; the drawer re-renders from the array alone.
  function markAsRead(id: string) {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  }

  function archiveNotification(id: string) {
    notifications = notifications.filter((n) => n.id !== id);
  }

  function markAllAsRead() {
    notifications = notifications.map((n) => ({ ...n, read: true }));
  }

  // The unread dot's colour, by notification type.
  const typeColors: Record<Notification['type'], string> = {
    info: 'bg-primary-subtle',
    success: 'bg-success-subtle',
    warning: 'bg-warning-subtle'
  };

  const recipeCode = `<\script lang="ts">
  import {
    ArchiveIcon,
    Avatar,
    Badge,
    BellIcon,
    Button,
    CheckIcon,
    Drawer,
    Tab,
    TabItem,
    TabPanel,
    Tooltip
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

  let notifications = $state<Notification[]>([/* … your feed … */]);

  // Both badges, the Unread panel and the footer's disabled state derive from
  // the one notifications array; nothing keeps a second list.
  let unreadCount = $derived(notifications.filter((n) => !n.read).length);
  let unreadNotifications = $derived(notifications.filter((n) => !n.read));

  // Your API calls slot in here; the drawer re-renders from the array alone.
  function markAsRead(id: string) {
    notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
  }

  function archiveNotification(id: string) {
    notifications = notifications.filter((n) => n.id !== id);
  }

  function markAllAsRead() {
    notifications = notifications.map((n) => ({ ...n, read: true }));
  }

  // The unread dot's colour, by notification type.
  const typeColors: Record<Notification['type'], string> = {
    info: 'bg-primary-subtle',
    success: 'bg-success-subtle',
    warning: 'bg-warning-subtle'
  };
<\/script>

<!-- One item template, two filters: both tab panels render this. -->
{#snippet list(items: Notification[])}
  {#if items.length === 0}
    <div class="flex flex-col items-center py-12">
      <BellIcon size={40} class="text-text-quaternary mb-3" />
      <p class="text-text-secondary text-sm font-medium">All caught up</p>
    </div>
  {:else}
    <ul class="divide-border-hairline divide-y">
      {#each items as notification (notification.id)}
        <li
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
                  class={['mt-1.5 h-2 w-2 shrink-0 rounded-full', typeColors[notification.type]]}
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
                  <CheckIcon size={16} />
                </button>
              </Tooltip>
            {/if}
            <Tooltip label="Archive">
              <button
                class="text-text-tertiary hover:bg-surface-hover hover:text-primary focus-visible:ring-primary/50 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                onclick={() => archiveNotification(notification.id)}
                aria-label="Archive"
              >
                <ArchiveIcon size={16} />
              </button>
            </Tooltip>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<!-- The bell sits wherever your header puts it; the drawer mounts in the top
     layer, so nothing around the trigger has to make room. -->
<Button variant="outlined" intent="neutral" onclick={() => (drawerOpen = true)}>
  <BellIcon size={20} />
  Notifications
  {#if unreadCount > 0}
    <Badge variant="soft" intent="danger" size="sm">{unreadCount}</Badge>
  {/if}
</Button>

<Drawer bind:open={drawerOpen} title="Notifications" placement="right" size="md">
  <Tab bind:value={activeTab} variant="line" size="sm">
    {#snippet tabs()}
      <TabItem value="all">All</TabItem>
      <TabItem value="unread">
        Unread
        {#if unreadCount > 0}
          <Badge variant="soft" intent="danger" size="sm">{unreadCount}</Badge>
        {/if}
      </TabItem>
    {/snippet}

    {#snippet panels()}
      <TabPanel value="all">{@render list(notifications)}</TabPanel>
      <TabPanel value="unread">{@render list(unreadNotifications)}</TabPanel>
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
      <p class="text-text-quaternary text-xs">{notifications.length} total</p>
    </div>
  {/snippet}
</Drawer>`;
</script>

{#snippet list(items: Notification[])}
  {#if items.length === 0}
    <div class="flex flex-col items-center py-12">
      <BellIcon size={40} class="text-text-quaternary mb-3" />
      <p class="text-text-secondary text-sm font-medium">All caught up</p>
    </div>
  {:else}
    <ul class="divide-border-hairline divide-y">
      {#each items as notification (notification.id)}
        <li
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
                  class={['mt-1.5 h-2 w-2 shrink-0 rounded-full', typeColors[notification.type]]}
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
                  <CheckIcon size={16} />
                </button>
              </Tooltip>
            {/if}
            <Tooltip label="Archive">
              <button
                class="text-text-tertiary hover:bg-surface-hover hover:text-primary focus-visible:ring-primary/50 rounded p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                onclick={() => archiveNotification(notification.id)}
                aria-label="Archive"
              >
                <ArchiveIcon size={16} />
              </button>
            </Tooltip>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="NotificationBell.svelte"
      description="Open the drawer from the bell. Marking items read counts both badges down and empties the Unread tab; archiving removes an item for good."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <Button variant="outlined" intent="neutral" onclick={() => (drawerOpen = true)}>
        <BellIcon size={20} />
        Notifications
        {#if unreadCount > 0}
          <Badge variant="soft" intent="danger" size="sm">{unreadCount}</Badge>
        {/if}
      </Button>

      <Drawer bind:open={drawerOpen} title="Notifications" placement="right" size="md">
        <Tab bind:value={activeTab} variant="line" size="sm">
          {#snippet tabs()}
            <TabItem value="all">All</TabItem>
            <TabItem value="unread">
              Unread
              {#if unreadCount > 0}
                <Badge variant="soft" intent="danger" size="sm">{unreadCount}</Badge>
              {/if}
            </TabItem>
          {/snippet}

          {#snippet panels()}
            <TabPanel value="all">{@render list(notifications)}</TabPanel>
            <TabPanel value="unread">{@render list(unreadNotifications)}</TabPanel>
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
            <p class="text-text-quaternary text-xs">{notifications.length} total</p>
          </div>
        {/snippet}
      </Drawer>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Three decisions">
    <NoteList>
      <Note title="A drawer, not a popover under the bell">
        <p>
          A
          <a class="text-primary hover:underline" href={resolve('/blocks/primitives/popover')}
            >Popover</a
          >
          anchored to the bell suits a short preview. This panel carries tabs, per-item actions and a
          footer, so it takes a full-height column instead:
          <code class="text-text-primary">Drawer</code> mounts in the top layer, traps focus and
          locks page scroll, and Escape, backdrop click and the close button all dismiss it.
          <code class="text-text-primary">bind:open</code> is the whole wiring; the drawer sets it
          back to <code class="text-text-primary">false</code> on each of those paths, which is why
          the recipe passes no <code class="text-text-primary">onClose</code>.
        </p>
      </Note>
      <Note title="The tabs are filters, not lists">
        <p>
          <code class="text-text-primary">notifications</code> is the only state.
          <code class="text-text-primary">unreadCount</code> and
          <code class="text-text-primary">unreadNotifications</code> are
          <code class="text-text-primary">$derived</code> from it, so the badge on the bell, the
          badge on the tab and the footer's disabled state cannot disagree, and marking an item read
          drops it out of the Unread panel with no list bookkeeping. Both panels render the same
          <code class="text-text-primary">list</code> snippet, and the empty state lives inside it: an
          emptied filter shows "All caught up" in either tab.
        </p>
      </Note>
      <Note title="Read dims, archive removes">
        <p>
          The two row actions differ in lifetime. Mark as read flips a flag: the item stays in the
          All tab, dimmed, as the history. Archive drops it from the array, and that is the recipe's
          whole deletion story: no undo, no archive folder. When your product needs archived items
          back, have <code class="text-text-primary">archiveNotification</code> move them to a second
          list instead of filtering them out.
        </p>
      </Note>
    </NoteList>

    <p class="text-text-secondary mt-6 text-sm">
      Everything here lives in one <code class="text-text-primary">$state</code> array and resets on
      reload. When notifications come from a server,
      <code class="text-text-primary">@urbicon-ui/auth</code> ships the wired version:
      <a class="text-primary hover:underline" href={resolve('/auth/components/notification-center')}
        >NotificationCenter</a
      >
      is this list with mark-as-read and delete against your endpoints,
      <a class="text-primary hover:underline" href={resolve('/auth/components/notification-badge')}
        >NotificationBadge</a
      >
      the bell count that renders nothing at zero, and
      <a
        class="text-primary hover:underline"
        href={resolve('/auth/components/notification-listener')}>NotificationListener</a
      >
      the live stream behind both.
    </p>
  </Section>
</RecipeShell>
