<!-- urbicon-ignore raw-tailwind-color — the raw colours are the Customization section's
     subject. That demo exists to show what `slotClasses`/`unstyled` reach that the token
     system deliberately does not: a frosted-glass look. Tokenising it would delete the
     example. Every other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    ArchiveIcon,
    Badge,
    BellIcon,
    CreditCardIcon,
    EditIcon,
    InboxIcon,
    Kbd,
    LockIcon,
    SendIcon,
    Tab,
    TabItem,
    TabPanel,
    UserIcon
  } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let activeSettings = $state('profile');
  let activeProject = $state('inbox');
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-8 text-sm leading-relaxed">
    Tab takes two snippets: <code class="text-text-primary">tabs()</code> for the strip and
    <code class="text-text-primary">panels()</code> for the content, and a
    <code class="text-text-primary">TabItem</code> pairs with its
    <code class="text-text-primary">TabPanel</code> by a matching
    <code class="text-text-primary">value</code> string. Drive the active tab with
    <code class="text-text-primary">bind:value</code> (or set an uncontrolled
    <code class="text-text-primary">defaultValue</code>), and
    <code class="text-text-primary">onValueChange</code> fires on every switch. An inactive panel
    drops its content by default, so pass <code class="text-text-primary">keepMounted</code> to keep
    a panel's state or <code class="text-text-primary">lazy</code> to defer its first render.
  </p>
  <div class="space-y-8">
    <!-- Vertical Orientation -->
    <CodeExample
      title="Settings sidebar"
      description="Sidebar-style navigation for settings pages and multi-section forms."
      isolate
      previewClass="w-full"
    >
      <div class="border-border-subtle bg-surface-elevated overflow-hidden rounded-xl border">
        <Tab variant="pills" orientation="vertical" bind:value={activeSettings}>
          {#snippet tabs()}
            <div class="w-48 shrink-0 p-3">
              <p
                class="text-text-tertiary text-3xs mb-3 px-2 font-semibold tracking-widest uppercase"
              >
                Settings
              </p>
              <TabItem value="profile">
                {#snippet icon()}
                  <UserIcon size={16} />
                {/snippet}
                Profile
              </TabItem>
              <TabItem value="security">
                {#snippet icon()}
                  <LockIcon size={16} />
                {/snippet}
                Security
              </TabItem>
              <TabItem value="notifications">
                {#snippet icon()}
                  <BellIcon size={16} />
                {/snippet}
                Notifications
              </TabItem>
              <TabItem value="billing">
                {#snippet icon()}
                  <CreditCardIcon size={16} />
                {/snippet}
                Billing
              </TabItem>
            </div>
          {/snippet}
          {#snippet panels()}
            <div class="flex-1 p-5">
              <TabPanel value="profile">
                <h3 class="text-text-primary mb-1 text-base font-semibold">Profile</h3>
                <p class="text-text-secondary text-sm">
                  Update your display name, avatar, and bio. These details are visible to other team
                  members.
                </p>
              </TabPanel>
              <TabPanel value="security">
                <h3 class="text-text-primary mb-1 text-base font-semibold">Security</h3>
                <p class="text-text-secondary text-sm">
                  Enable two-factor authentication, manage active sessions, and review login
                  history.
                </p>
              </TabPanel>
              <TabPanel value="notifications">
                <h3 class="text-text-primary mb-1 text-base font-semibold">Notifications</h3>
                <p class="text-text-secondary text-sm">
                  Choose which events trigger email, push, or in-app notifications.
                </p>
              </TabPanel>
              <TabPanel value="billing">
                <h3 class="text-text-primary mb-1 text-base font-semibold">Billing</h3>
                <p class="text-text-secondary text-sm">
                  View your current plan, download invoices, and update payment methods.
                </p>
              </TabPanel>
            </div>
          {/snippet}
        </Tab>
      </div>
    </CodeExample>

    <!-- Icons & Badges -->
    <CodeExample
      title="Icons & Badges"
      description="Leading icons for visual scanning, trailing badges for status indicators."
      isolate
      previewClass="w-full"
    >
      <Tab bind:value={activeProject}>
        {#snippet tabs()}
          <TabItem value="inbox">
            {#snippet icon()}
              <InboxIcon size={16} />
            {/snippet}
            Inbox
            {#snippet badge()}
              <Badge intent="danger" size="xs" variant="filled">3</Badge>
            {/snippet}
          </TabItem>
          <TabItem value="drafts">
            {#snippet icon()}
              <EditIcon size={16} />
            {/snippet}
            Drafts
            {#snippet badge()}
              <Badge intent="neutral" size="xs" variant="soft">12</Badge>
            {/snippet}
          </TabItem>
          <TabItem value="sent">
            {#snippet icon()}
              <SendIcon size={16} />
            {/snippet}
            Sent
          </TabItem>
          <TabItem value="archive">
            {#snippet icon()}
              <ArchiveIcon size={16} />
            {/snippet}
            Archive
          </TabItem>
        {/snippet}
        {#snippet panels()}
          <TabPanel value="inbox">
            <div class="space-y-3 py-1">
              {#each [{ from: 'Sarah Chen', subject: 'Q4 Revenue Report', time: '2m ago' }, { from: 'DevOps Bot', subject: 'Deploy #1847 succeeded', time: '15m ago' }, { from: 'Alex Rivera', subject: 'Design review feedback', time: '1h ago' }] as msg (msg.from + msg.subject)}
                <div
                  class="border-border-subtle rounded-contain flex items-center gap-3 border p-3"
                >
                  <div
                    class="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                  >
                    {msg.from[0]}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-text-primary truncate text-sm font-medium">{msg.from}</p>
                    <p class="text-text-tertiary truncate text-xs">{msg.subject}</p>
                  </div>
                  <span class="text-text-tertiary shrink-0 text-xs">{msg.time}</span>
                </div>
              {/each}
            </div>
          </TabPanel>
          <TabPanel value="drafts">
            <p class="text-text-secondary py-2 text-sm">12 drafts waiting to be sent.</p>
          </TabPanel>
          <TabPanel value="sent">
            <p class="text-text-secondary py-2 text-sm">All sent messages appear here.</p>
          </TabPanel>
          <TabPanel value="archive">
            <p class="text-text-secondary py-2 text-sm">Archived conversations for reference.</p>
          </TabPanel>
        {/snippet}
      </Tab>
    </CodeExample>

    <!-- Full Width -->
    <CodeExample
      title="Pricing switch"
      description="Tabs stretch equally across the container, useful for mobile layouts and modal headers."
      isolate
    >
      <Tab variant="solid" fullWidth defaultValue="monthly">
        {#snippet tabs()}
          <TabItem value="monthly">Monthly</TabItem>
          <TabItem value="annual">Annual</TabItem>
        {/snippet}
        {#snippet panels()}
          <TabPanel value="monthly">
            <div class="flex items-baseline gap-1 py-3">
              <span class="text-text-primary text-3xl font-bold">$29</span>
              <span class="text-text-tertiary text-sm">/month</span>
            </div>
          </TabPanel>
          <TabPanel value="annual">
            <div class="flex items-baseline gap-1 py-3">
              <span class="text-text-primary text-3xl font-bold">$19</span>
              <span class="text-text-tertiary text-sm">/month</span>
              <Badge intent="success" size="xs" variant="soft" class="ml-2">Save 34%</Badge>
            </div>
          </TabPanel>
        {/snippet}
      </Tab>
    </CodeExample>

    <!-- Disabled -->
    <CodeExample
      title="Disabling a single tab"
      description="A disabled TabItem is skipped by roving keyboard navigation while the rest stay interactive."
      isolate
      previewClass="w-full"
    >
      <Tab variant="pills" defaultValue="a">
        {#snippet tabs()}
          <TabItem value="a">Active</TabItem>
          <TabItem value="b" disabled>Locked</TabItem>
          <TabItem value="c">Available</TabItem>
        {/snippet}
        {#snippet panels()}
          <TabPanel value="a"
            ><p class="text-text-secondary text-sm">
              This tab is active and interactive.
            </p></TabPanel
          >
          <TabPanel value="b"><p class="text-text-tertiary text-sm">—</p></TabPanel>
          <TabPanel value="c"
            ><p class="text-text-secondary text-sm">This tab is also interactive.</p></TabPanel
          >
        {/snippet}
      </Tab>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <!-- slotClasses -->
    <CodeExample
      title="slotClasses Override"
      description="Style individual slots: list background, panel padding, trigger rounding."
      isolate
      previewClass="w-full"
    >
      <Tab
        variant="pills"
        defaultValue="one"
        slotClasses={{
          list: 'bg-primary/5 rounded-xl p-1.5 gap-2',
          trigger: 'rounded-xl',
          panel: 'p-4 rounded-xl border border-border-subtle mt-3'
        }}
      >
        {#snippet tabs()}
          <TabItem value="one">Features</TabItem>
          <TabItem value="two">Pricing</TabItem>
          <TabItem value="three">FAQ</TabItem>
        {/snippet}
        {#snippet panels()}
          <TabPanel value="one">
            <p class="text-text-secondary text-sm">
              Custom rounded triggers inside a tinted pill container.
            </p>
          </TabPanel>
          <TabPanel value="two">
            <p class="text-text-secondary text-sm">
              The panel gets its own bordered card treatment.
            </p>
          </TabPanel>
          <TabPanel value="three">
            <p class="text-text-secondary text-sm">
              All without leaving the component's API surface.
            </p>
          </TabPanel>
        {/snippet}
      </Tab>
    </CodeExample>

    <!-- Glassmorphism unstyled -->
    <CodeExample
      title="Glassmorphism (unstyled)"
      description="Drop the tokens with `unstyled` and hand-build the strip and panels through `class`, here into frosted-glass tabs. The `data-[state=active]` selector drives the active styling."
      isolate
      previewClass="w-full rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8"
    >
      <Tab unstyled defaultValue="home" class="w-full">
        {#snippet tabs()}
          <div class="flex gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-md">
            <TabItem
              unstyled
              value="home"
              class="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white/60 transition data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              Home
            </TabItem>
            <TabItem
              unstyled
              value="explore"
              class="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white/60 transition data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              Explore
            </TabItem>
            <TabItem
              unstyled
              value="library"
              class="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white/60 transition data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              Library
            </TabItem>
          </div>
        {/snippet}
        {#snippet panels()}
          <TabPanel
            unstyled
            value="home"
            class="mt-4 rounded-xl bg-white/10 p-5 text-sm text-white/90 backdrop-blur-md"
          >
            Frosted glass panels over a gradient backdrop.
          </TabPanel>
          <TabPanel
            unstyled
            value="explore"
            class="mt-4 rounded-xl bg-white/10 p-5 text-sm text-white/90 backdrop-blur-md"
          >
            Zero default styles. Every style here comes from the class props.
          </TabPanel>
          <TabPanel
            unstyled
            value="library"
            class="mt-4 rounded-xl bg-white/10 p-5 text-sm text-white/90 backdrop-blur-md"
          >
            With <code class="rounded bg-white/15 px-1.5 py-0.5">unstyled</code>, the class props
            own the entire look.
          </TabPanel>
        {/snippet}
      </Tab>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A tab chrome shared across the app belongs in <code class="text-text-primary"
        >BlocksProvider</code
      >
      presets (<code class="text-text-primary">presets.Tab</code>, per-trigger styling under
      <code class="text-text-primary">presets.TabItem</code>, panel styling under
      <code class="text-text-primary">presets.TabPanel</code>), applied via
      <code class="text-text-primary">preset</code>
      instead of repeating
      <code class="text-text-primary">slotClasses</code>. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        Uses <code class="text-text-primary">role="tablist"</code> on the tab strip,
        <code class="text-text-primary">role="tab"</code> on each trigger, and
        <code class="text-text-primary">role="tabpanel"</code> on content panels.
        <code class="text-text-primary">aria-selected</code> and
        <code class="text-text-primary">aria-controls</code> /
        <code class="text-text-primary">aria-labelledby</code>
        link tabs to their panels.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="Arrow Left" />
        /
        <Kbd keys="Arrow Right" />
        cycle through horizontal tabs.
        <Kbd keys="Arrow Up" />
        /
        <Kbd keys="Arrow Down" />
        for vertical orientation.
        <Kbd keys="Home" />
        /
        <Kbd keys="End" />
        jump to first/last tab.
        <Kbd keys="Tab" />
        moves focus into and out of the tab strip.
      </p>
    </Note>
    <Note title="Focus Management">
      <p>
        Only the active tab has <code class="text-text-primary">tabindex="0"</code>. Arrow keys move
        focus <em>and</em> activate the tab (automatic activation pattern). Focus rings use
        <code class="text-text-primary">focus-visible:</code> so they never show on mouse clicks.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        The sliding indicator respects
        <code class="text-text-primary">prefers-reduced-motion</code>, shortening or removing its
        transition when the user has requested less motion.
      </p>
    </Note>
  </NoteList>
</Section>
