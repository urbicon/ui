<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Tab, TabItem, TabPanel, Badge } from '@urbicon-ui/blocks';

  let activeSettings = $state('profile');
  let activeProject = $state('inbox');

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'variant',
          'size',
          'tier',
          'orientation',
          'fullWidth',
          'disabled',
          'mint',
          'defaultValue'
        ],
        defaults: { variant: 'line', size: 'md', tier: 'modify', orientation: 'horizontal' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Tab Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <!-- Variants -->
    <CodeExample
      title="Variants"
      description="Four visual styles for different UI contexts."
      isolate
      previewClass="flex flex-col gap-10"
    >
      <div class="flex w-full flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">Line</p>
        <Tab defaultValue="overview">
          {#snippet tabs()}
            <TabItem value="overview">Overview</TabItem>
            <TabItem value="analytics">Analytics</TabItem>
            <TabItem value="reports">Reports</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="overview">
              <p class="text-text-secondary text-sm">
                Animated underline indicator tracks the active tab.
              </p>
            </TabPanel>
            <TabPanel value="analytics">
              <p class="text-text-secondary text-sm">
                Great for primary navigation within a page section.
              </p>
            </TabPanel>
            <TabPanel value="reports">
              <p class="text-text-secondary text-sm">
                Clean separation between tab strip and content area.
              </p>
            </TabPanel>
          {/snippet}
        </Tab>
      </div>

      <div class="flex w-full flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">Pills</p>
        <Tab variant="pills" defaultValue="overview">
          {#snippet tabs()}
            <TabItem value="overview">Overview</TabItem>
            <TabItem value="analytics">Analytics</TabItem>
            <TabItem value="reports">Reports</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="overview">
              <p class="text-text-secondary text-sm">
                Segmented-control feel with a subtle background.
              </p>
            </TabPanel>
            <TabPanel value="analytics">
              <p class="text-text-secondary text-sm">
                Active tab gets an elevated surface treatment.
              </p>
            </TabPanel>
            <TabPanel value="reports">
              <p class="text-text-secondary text-sm">
                Ideal for compact filter bars or toolbar toggles.
              </p>
            </TabPanel>
          {/snippet}
        </Tab>
      </div>

      <div class="flex w-full flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">Enclosed</p>
        <Tab variant="enclosed" defaultValue="overview">
          {#snippet tabs()}
            <TabItem value="overview">Overview</TabItem>
            <TabItem value="analytics">Analytics</TabItem>
            <TabItem value="reports">Reports</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="overview">
              <p class="text-text-secondary text-sm">
                Classic browser-tab pattern with bordered tabs.
              </p>
            </TabPanel>
            <TabPanel value="analytics">
              <p class="text-text-secondary text-sm">
                Active tab merges visually with the content panel.
              </p>
            </TabPanel>
            <TabPanel value="reports">
              <p class="text-text-secondary text-sm">
                Strong visual affordance of the selected state.
              </p>
            </TabPanel>
          {/snippet}
        </Tab>
      </div>

      <div class="flex w-full flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">Solid</p>
        <Tab variant="solid" defaultValue="overview">
          {#snippet tabs()}
            <TabItem value="overview">Overview</TabItem>
            <TabItem value="analytics">Analytics</TabItem>
            <TabItem value="reports">Reports</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="overview">
              <p class="text-text-secondary text-sm">Bold primary fill on the active tab.</p>
            </TabPanel>
            <TabPanel value="analytics">
              <p class="text-text-secondary text-sm">
                High contrast — perfect for prominent action areas.
              </p>
            </TabPanel>
            <TabPanel value="reports">
              <p class="text-text-secondary text-sm">
                Segmented control with strong visual hierarchy.
              </p>
            </TabPanel>
          {/snippet}
        </Tab>
      </div>
    </CodeExample>

    <!-- Sizes -->
    <CodeExample title="Sizes" isolate previewClass="flex flex-col gap-10">
      <div class="flex w-full flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">Small</p>
        <Tab variant="pills" size="sm" defaultValue="a">
          {#snippet tabs()}
            <TabItem value="a">Day</TabItem>
            <TabItem value="b">Week</TabItem>
            <TabItem value="c">Month</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="a"
              ><p class="text-text-secondary text-sm">
                Compact for toolbars and dense UIs.
              </p></TabPanel
            >
            <TabPanel value="b"><p class="text-text-secondary text-sm">—</p></TabPanel>
            <TabPanel value="c"><p class="text-text-secondary text-sm">—</p></TabPanel>
          {/snippet}
        </Tab>
      </div>
      <div class="flex w-full flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">Medium</p>
        <Tab variant="pills" size="md" defaultValue="a">
          {#snippet tabs()}
            <TabItem value="a">Day</TabItem>
            <TabItem value="b">Week</TabItem>
            <TabItem value="c">Month</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="a"
              ><p class="text-text-secondary">Default size for most use cases.</p></TabPanel
            >
            <TabPanel value="b"><p class="text-text-secondary">—</p></TabPanel>
            <TabPanel value="c"><p class="text-text-secondary">—</p></TabPanel>
          {/snippet}
        </Tab>
      </div>
      <div class="flex w-full flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">Large</p>
        <Tab variant="pills" size="lg" defaultValue="a">
          {#snippet tabs()}
            <TabItem value="a">Day</TabItem>
            <TabItem value="b">Week</TabItem>
            <TabItem value="c">Month</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="a"
              ><p class="text-text-secondary text-lg">
                For hero sections and spacious layouts.
              </p></TabPanel
            >
            <TabPanel value="b"><p class="text-text-secondary text-lg">—</p></TabPanel>
            <TabPanel value="c"><p class="text-text-secondary text-lg">—</p></TabPanel>
          {/snippet}
        </Tab>
      </div>
    </CodeExample>

    <!-- Vertical Orientation -->
    <CodeExample
      title="Vertical Orientation"
      description="Sidebar-style navigation for settings pages and multi-section forms."
      isolate
      previewClass="w-full"
    >
      <div class="border-border-subtle bg-surface-elevated overflow-hidden rounded-xl border">
        <Tab variant="pills" orientation="vertical" bind:value={activeSettings}>
          {#snippet tabs()}
            <div class="w-48 shrink-0 p-3">
              <p
                class="text-text-tertiary mb-3 px-2 text-[10px] font-semibold tracking-widest uppercase"
              >
                Settings
              </p>
              <TabItem value="profile">
                {#snippet icon()}
                  <svg
                    class="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                {/snippet}
                Profile
              </TabItem>
              <TabItem value="security">
                {#snippet icon()}
                  <svg
                    class="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                {/snippet}
                Security
              </TabItem>
              <TabItem value="notifications">
                {#snippet icon()}
                  <svg
                    class="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                {/snippet}
                Notifications
              </TabItem>
              <TabItem value="billing">
                {#snippet icon()}
                  <svg
                    class="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
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
      <Tab defaultValue="inbox" bind:value={activeProject}>
        {#snippet tabs()}
          <TabItem value="inbox">
            {#snippet icon()}
              <svg
                class="size-[1em]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            {/snippet}
            Inbox
            {#snippet badge()}
              <Badge intent="danger" size="xs" variant="filled">3</Badge>
            {/snippet}
          </TabItem>
          <TabItem value="drafts">
            {#snippet icon()}
              <svg
                class="size-[1em]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            {/snippet}
            Drafts
            {#snippet badge()}
              <Badge intent="neutral" size="xs" variant="soft">12</Badge>
            {/snippet}
          </TabItem>
          <TabItem value="sent">
            {#snippet icon()}
              <svg
                class="size-[1em]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            {/snippet}
            Sent
          </TabItem>
          <TabItem value="archive">
            {#snippet icon()}
              <svg
                class="size-[1em]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
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
      title="Full Width"
      description="Tabs stretch equally across the container — useful for mobile layouts and modal headers."
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
      title="Disabled Tabs"
      description="Globally disabled via the Tab prop, or per-tab on individual TabItems."
      isolate
      previewClass="flex flex-col gap-8 w-full"
    >
      <div class="flex flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">All disabled</p>
        <Tab disabled defaultValue="a">
          {#snippet tabs()}
            <TabItem value="a">Account</TabItem>
            <TabItem value="b">Billing</TabItem>
            <TabItem value="c">Team</TabItem>
          {/snippet}
          {#snippet panels()}
            <TabPanel value="a"
              ><p class="text-text-tertiary text-sm">All interaction is disabled.</p></TabPanel
            >
            <TabPanel value="b"><p class="text-text-tertiary text-sm">—</p></TabPanel>
            <TabPanel value="c"><p class="text-text-tertiary text-sm">—</p></TabPanel>
          {/snippet}
        </Tab>
      </div>
      <div class="flex flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Single tab disabled
        </p>
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
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Micro-Interactions ─── -->

<Section marker="02" id="mint" title="Micro-Interactions">
  <div class="space-y-8">
    <CodeExample title="Scale" description="Subtle scale on hover for playful UI." isolate>
      <Tab variant="pills" mint="scale" defaultValue="a">
        {#snippet tabs()}
          <TabItem value="a">Design</TabItem>
          <TabItem value="b">Develop</TabItem>
          <TabItem value="c">Deploy</TabItem>
        {/snippet}
        {#snippet panels()}
          <TabPanel value="a"
            ><p class="text-text-secondary text-sm">
              Hover over the tabs to see the scale effect.
            </p></TabPanel
          >
          <TabPanel value="b"><p class="text-text-secondary text-sm">—</p></TabPanel>
          <TabPanel value="c"><p class="text-text-secondary text-sm">—</p></TabPanel>
        {/snippet}
      </Tab>
    </CodeExample>

    <CodeExample title="Glow" description="Soft glow aura around the tab container." isolate>
      <Tab variant="solid" mint="glow" defaultValue="a">
        {#snippet tabs()}
          <TabItem value="a">Live</TabItem>
          <TabItem value="b">Preview</TabItem>
          <TabItem value="c">Code</TabItem>
        {/snippet}
        {#snippet panels()}
          <TabPanel value="a"
            ><p class="text-text-secondary text-sm">
              The container gets a soft glow on interaction.
            </p></TabPanel
          >
          <TabPanel value="b"><p class="text-text-secondary text-sm">—</p></TabPanel>
          <TabPanel value="c"><p class="text-text-secondary text-sm">—</p></TabPanel>
        {/snippet}
      </Tab>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <!-- slotClasses -->
    <CodeExample
      title="slotClasses Override"
      description="Style individual slots — list background, panel padding, trigger rounding."
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
      description="Fully custom glass-effect tabs using unstyled mode."
      isolate
      previewClass="w-full rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8"
    >
      <Tab unstyled defaultValue="home" class="w-full">
        {#snippet tabs()}
          <div class="flex gap-1 rounded-xl bg-white/10 p-1 backdrop-blur-md">
            <TabItem
              unstyled
              value="home"
              class="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              Home
            </TabItem>
            <TabItem
              unstyled
              value="explore"
              class="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
            >
              Explore
            </TabItem>
            <TabItem
              unstyled
              value="library"
              class="flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white/60 transition-all data-[state=active]:bg-white/20 data-[state=active]:text-white data-[state=active]:shadow-lg"
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
            Frosted glass panels with gradient backdrop. The <code
              class="rounded bg-white/15 px-1.5 py-0.5">data-[state=active]</code
            > selector drives the active styling.
          </TabPanel>
          <TabPanel
            unstyled
            value="explore"
            class="mt-4 rounded-xl bg-white/10 p-5 text-sm text-white/90 backdrop-blur-md"
          >
            Zero default styles — everything is hand-crafted via class props.
          </TabPanel>
          <TabPanel
            unstyled
            value="library"
            class="mt-4 rounded-xl bg-white/10 p-5 text-sm text-white/90 backdrop-blur-md"
          >
            Proof that <code class="rounded bg-white/15 px-1.5 py-0.5">unstyled</code> gives full creative
            freedom.
          </TabPanel>
        {/snippet}
      </Tab>
    </CodeExample>

    <!-- Terminal style unstyled -->
    <CodeExample
      title="Terminal (unstyled)"
      description="Monospace hacker aesthetic built entirely with class overrides."
      isolate
      previewClass="w-full rounded-2xl bg-neutral-950 p-6"
    >
      <Tab unstyled defaultValue="stdout" class="w-full font-mono">
        {#snippet tabs()}
          <div class="flex gap-px border-b border-emerald-500/20">
            <TabItem
              unstyled
              value="stdout"
              class="border-b-2 border-transparent px-4 py-2 text-xs text-emerald-300 transition-colors data-[state=active]:border-emerald-400 data-[state=active]:text-emerald-400"
            >
              stdout
            </TabItem>
            <TabItem
              unstyled
              value="stderr"
              class="border-b-2 border-transparent px-4 py-2 text-xs text-emerald-300 transition-colors data-[state=active]:border-emerald-400 data-[state=active]:text-emerald-400"
            >
              stderr
            </TabItem>
            <TabItem
              unstyled
              value="logs"
              class="border-b-2 border-transparent px-4 py-2 text-xs text-emerald-300 transition-colors data-[state=active]:border-emerald-400 data-[state=active]:text-emerald-400"
            >
              logs
            </TabItem>
          </div>
        {/snippet}
        {#snippet panels()}
          <TabPanel unstyled value="stdout" class="py-4 text-xs leading-relaxed text-emerald-200">
            <p>$ bun run build</p>
            <p class="text-emerald-400">✓ 247 modules transformed.</p>
            <p class="text-emerald-400">✓ built in 1.23s</p>
            <p class="mt-2 text-emerald-300">Process exited with code 0</p>
          </TabPanel>
          <TabPanel unstyled value="stderr" class="py-4 text-xs leading-relaxed text-red-400/80">
            <p>No errors.</p>
          </TabPanel>
          <TabPanel unstyled value="logs" class="py-4 text-xs leading-relaxed text-emerald-200">
            <p class="text-emerald-400">[12:34:01] Starting compilation...</p>
            <p class="text-emerald-400">[12:34:02] Bundling assets...</p>
            <p class="text-emerald-300">[12:34:03] Done.</p>
          </TabPanel>
        {/snippet}
      </Tab>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Uses <code class="text-text-primary">role="tablist"</code> on the tab strip,
          <code class="text-text-primary">role="tab"</code> on each trigger, and
          <code class="text-text-primary">role="tabpanel"</code> on content panels.
          <code class="text-text-primary">aria-selected</code> and
          <code class="text-text-primary">aria-controls</code> /
          <code class="text-text-primary">aria-labelledby</code>
          link tabs to their panels.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard Navigation</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Arrow Left</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Arrow Right</kbd
          >
          cycle through horizontal tabs.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Arrow Up</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Arrow Down</kbd
          >
          for vertical orientation.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Home</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >End</kbd
          >
          jump to first/last tab.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          moves focus into and out of the tab strip.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Focus Management</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Only the active tab has <code class="text-text-primary">tabindex="0"</code>. Arrow keys
          move focus <em>and</em> activate the tab (automatic activation pattern). Focus rings use
          <code class="text-text-primary">focus-visible:</code> so they never show on mouse clicks.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The sliding indicator and Mint effects respect
          <code class="text-text-primary">prefers-reduced-motion</code>. Transitions are shortened
          or removed when the user has requested less motion.
        </p>
      </div>
    </div>
  </div>
</Section>
