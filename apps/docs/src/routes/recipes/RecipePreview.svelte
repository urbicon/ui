<script lang="ts">
  import {
    Avatar,
    Badge,
    Progress,
    Separator,
    AlertCircleIcon,
    ArrowRightIcon,
    BellIcon,
    CheckIcon,
    CircleHelpIcon,
    CoffeeIcon,
    FingerprintIcon,
    GaugeIcon,
    GitBranchIcon,
    ListFilterIcon,
    LockIcon,
    MailIcon,
    PlusIcon,
    ReceiptIcon,
    SparklesIcon,
    TrendingDownIcon,
    TrendingUpIcon,
    UsersIcon,
    WalletIcon,
    WarningTriangleIcon
  } from '@urbicon-ui/blocks';

  let { href }: { href: string } = $props();
</script>

<!-- urbicon-ignore magic-dimension — the 19 arbitrary px are a miniature: this
     component draws a 3-px-tall mock toolbar and 18-px cards so the cookbook
     card can show the shape of a recipe. Snapping them to the spacing scale
     would round a 3-px bar to 4 and lose the proportion the drawing depends on. -->

<!--
  Recipe card mini-preview.

  Contract (all 20 previews follow it):
  - Fills the 144px-tall frame at NATIVE size — no `transform: scale()`. The
    previous scale(0.65) shrank the *clipping box* itself (so it floated in a
    third of the frame), clipped 7 of the previews, and reduced the text-[7px]
    labels to ~4.5px of grey mush — which is what read as "empty card".
  - `inert` + `aria-hidden`: the frame sits inside a <Card href> (an <a>), so
    any focusable control here would be a keyboard trap AND interactive content
    nested in a link (invalid HTML). `pointer-events-none` alone does not stop
    focus — it did not before. Only non-focusable components are used
    (Badge/Avatar/Progress/Separator/icons); inputs and buttons are drawn as
    static boxes via the `field`/`cta` snippets.
  - Character over fidelity: in ~144px a preview must say "this is a login" vs
    "this is a dashboard" at a glance, not reproduce the page.
-->

{#snippet line(cls: string)}
  <div class="bg-surface-subtle rounded-full {cls}"></div>
{/snippet}

{#snippet field(label: string)}
  <div
    class="border-border-default bg-surface-base text-text-quaternary flex h-[18px] items-center rounded border px-1.5 text-[8px]"
  >
    {label}
  </div>
{/snippet}

{#snippet cta(label: string)}
  <div
    class="bg-primary text-text-on-primary flex h-[18px] items-center justify-center rounded text-[8px] font-semibold"
  >
    {label}
  </div>
{/snippet}

<div
  class="border-border-subtle bg-surface-base relative h-36 overflow-hidden rounded-lg border"
  aria-hidden="true"
  inert
>
  {#if href === '/recipes/login'}
    <!-- Auth screen: a centred sign-in card on a tinted page -->
    <div class="bg-surface-subtle grid h-full place-items-center">
      <div
        class="border-border-subtle bg-surface-base w-[148px] space-y-1.5 rounded-md border p-2.5 shadow-[var(--blocks-shadow-sm)]"
      >
        <div class="bg-primary mx-auto flex h-5 w-5 items-center justify-center rounded-md">
          <LockIcon class="text-text-on-primary h-3 w-3" />
        </div>
        <div class="text-text-primary text-3xs text-center font-semibold">Sign in</div>
        {@render field('you@example.com')}
        {@render field('••••••••')}
        {@render cta('Log in')}
      </div>
    </div>
  {:else if href === '/recipes/auth-passkey-login'}
    <!-- Passwordless first: passkey CTA above the password fallback -->
    <div class="bg-surface-subtle grid h-full place-items-center">
      <div
        class="border-border-subtle bg-surface-base w-[152px] space-y-1.5 rounded-md border p-2.5 shadow-[var(--blocks-shadow-sm)]"
      >
        <div
          class="border-primary bg-primary-subtle flex h-[22px] items-center justify-center gap-1 rounded border border-dashed"
        >
          <FingerprintIcon class="text-primary h-3.5 w-3.5" />
          <span class="text-primary text-[8px] font-semibold">Use a passkey</span>
        </div>
        <div class="flex items-center gap-1.5">
          <div class="bg-border-subtle h-px flex-1"></div>
          <span class="text-text-quaternary text-[7px]">or</span>
          <div class="bg-border-subtle h-px flex-1"></div>
        </div>
        {@render field('you@example.com')}
        {@render field('••••••••')}
      </div>
    </div>
  {:else if href === '/recipes/auth-invitation-register'}
    <!-- Invite-gated: the invitation token is what unlocks the form -->
    <div class="bg-surface-subtle grid h-full place-items-center">
      <div
        class="border-border-subtle bg-surface-base w-[156px] space-y-1.5 rounded-md border p-2.5 shadow-[var(--blocks-shadow-sm)]"
      >
        <div class="bg-success-subtle flex items-center gap-1 rounded px-1.5 py-1">
          <MailIcon class="text-success h-3 w-3 shrink-0" />
          <span class="text-success text-[7px] font-semibold">You've been invited</span>
        </div>
        <div
          class="border-success bg-surface-base text-success flex h-[18px] items-center justify-center rounded border border-dashed font-mono text-[8px] tracking-widest"
        >
          INV-7K2Q
        </div>
        {@render field('Full name')}
        {@render cta('Create account')}
      </div>
    </div>
  {:else if href === '/recipes/auth-password-reset'}
    <!-- Two-page flow: request → set new password -->
    <div class="bg-surface-subtle flex h-full items-center justify-center gap-1.5 px-3">
      <div class="border-border-subtle bg-surface-base flex-1 space-y-1.5 rounded-md border p-2">
        <div class="text-text-primary text-[8px] font-semibold">Forgot?</div>
        {@render field('Email')}
        {@render cta('Send link')}
      </div>
      <ArrowRightIcon class="text-text-quaternary h-3 w-3 shrink-0" />
      <div class="border-primary bg-surface-base flex-1 space-y-1.5 rounded-md border p-2">
        <div class="text-text-primary text-[8px] font-semibold">New password</div>
        {@render field('••••••••')}
        {@render cta('Reset')}
      </div>
    </div>
  {:else if href === '/recipes/dashboard'}
    <!-- App shell: rail + KPI row + chart -->
    <div class="flex h-full">
      <div class="border-border-subtle bg-surface-elevated w-9 shrink-0 space-y-1.5 border-r p-1.5">
        <div class="bg-primary h-1.5 w-full rounded-full"></div>
        {@render line('h-1.5 w-full')}
        {@render line('h-1.5 w-2/3')}
        {@render line('h-1.5 w-full')}
      </div>
      <div class="flex flex-1 flex-col gap-1.5 p-2">
        <div class="grid grid-cols-4 gap-1">
          {#each [['Users', '12.8k'], ['MRR', '$48k'], ['Trials', '1.4k'], ['Churn', '3.2%']] as [k, v] (k)}
            <div class="border-border-subtle rounded border px-1 py-0.5">
              <div class="text-text-quaternary text-[6px]">{k}</div>
              <div class="text-text-primary text-[8px] font-bold">{v}</div>
            </div>
          {/each}
        </div>
        <div class="flex flex-1 items-end gap-0.5">
          {#each [40, 62, 45, 78, 55, 70, 88, 60, 74] as h, i (i)}
            <div class="bg-primary-subtle flex-1 rounded-t-sm" style="height: {h}%"></div>
          {/each}
        </div>
        <Progress value={64} size="xs" intent="primary" />
      </div>
    </div>
  {:else if href === '/recipes/filter-sidebar'}
    <!-- Filter rail against a live result grid -->
    <div class="flex h-full">
      <div
        class="border-border-subtle bg-surface-elevated w-[74px] shrink-0 space-y-1.5 border-r p-2"
      >
        <div class="text-text-secondary flex items-center gap-1 text-[7px] font-semibold">
          <ListFilterIcon class="h-2.5 w-2.5" />
          Filters
        </div>
        {#each [true, true, false, false] as on, i (i)}
          <div class="flex items-center gap-1">
            <div
              class="flex h-2 w-2 shrink-0 items-center justify-center rounded-[2px] border {on
                ? 'border-primary bg-primary'
                : 'border-border-default'}"
            >
              {#if on}<CheckIcon class="text-text-on-primary h-1.5 w-1.5" />{/if}
            </div>
            {@render line('h-1 flex-1')}
          </div>
        {/each}
        <div class="bg-surface-subtle h-1 w-full rounded-full">
          <div class="bg-primary h-1 w-2/3 rounded-full"></div>
        </div>
      </div>
      <div class="grid flex-1 grid-cols-2 content-start gap-1.5 p-2">
        {#each [0, 1, 2, 3] as i (i)}
          <div class="border-border-subtle space-y-1 rounded border p-1">
            {@render line('h-1.5 w-full')}
            {@render line('h-1 w-2/3')}
          </div>
        {/each}
      </div>
    </div>
  {:else if href === '/recipes/table-detail'}
    <!-- Order rows beside the panel that reads the marked one. No shadow and no
         backdrop: the panel is a column of the page, which is the recipe's
         whole point, and an overlay drawing would say the opposite. -->
    <div class="flex h-full gap-2 p-2">
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="text-text-secondary mb-1.5 flex items-center gap-1 text-[7px] font-semibold">
          <ReceiptIcon class="h-2.5 w-2.5" />
          Orders
        </div>
        <div class="divide-border-subtle divide-y">
          {#each [{ id: 'ORD-2418', open: false }, { id: 'ORD-2419', open: true }, { id: 'ORD-2420', open: false }, { id: 'ORD-2421', open: false }] as row (row.id)}
            <div
              class="flex items-center gap-1.5 py-1 pr-1 {row.open
                ? 'bg-surface-hover pl-1 shadow-[inset_2px_0_0_0_var(--color-border-strong)]'
                : 'pl-1'}"
            >
              <span class="text-text-secondary text-[6px] font-medium">{row.id}</span>
              {@render line('h-1 flex-1')}
            </div>
          {/each}
        </div>
      </div>
      <div class="border-border-subtle flex w-[58px] shrink-0 flex-col gap-1.5 border-l pl-2">
        <div class="text-text-primary text-[7px] font-semibold">ORD-2419</div>
        <div class="bg-success-subtle text-success w-fit rounded px-1 py-px text-[6px]">Paid</div>
        {@render line('h-1 w-full')}
        {@render line('h-1 w-2/3')}
        <div class="border-border-subtle mt-auto flex items-baseline justify-between border-t pt-1">
          <span class="text-text-quaternary text-[6px]">Total</span>
          <span class="text-text-primary text-[6px] font-semibold">€79.00</span>
        </div>
      </div>
    </div>
  {:else if href === '/recipes/settings'}
    <!-- Tabbed settings: identity above, switches below -->
    <div class="flex h-full flex-col p-2.5">
      <div class="border-border-subtle flex gap-2.5 border-b pb-1">
        {#each ['Profile', 'Notifications', 'Security'] as tab, i (tab)}
          <span
            class="pb-1 text-[8px] {i === 0
              ? 'text-primary border-primary -mb-[5px] border-b font-semibold'
              : 'text-text-tertiary'}">{tab}</span
          >
        {/each}
      </div>
      <div class="mt-2 flex items-center gap-1.5">
        <Avatar name="Alex Kim" size="xs" />
        <div>
          <div class="text-text-primary text-[9px] font-medium">Alex Kim</div>
          <div class="text-text-quaternary text-[7px]">alex@example.com</div>
        </div>
      </div>
      <div class="my-1.5"><Separator /></div>
      {#each [['Email notifications', true], ['Weekly digest', false]] as [label, on] (label)}
        <div class="flex items-center justify-between py-0.5">
          <span class="text-text-secondary text-[8px]">{label}</span>
          <div
            class="flex h-2.5 w-4 items-center rounded-full px-[1px] {on
              ? 'bg-primary justify-end'
              : 'bg-surface-subtle justify-start'}"
          >
            <div
              class="bg-surface-base h-2 w-2 rounded-full shadow-[var(--blocks-shadow-sm)]"
            ></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if href === '/recipes/wizard'}
    <!-- Linear stepper with an active step -->
    <div class="flex h-full flex-col gap-2 p-2.5">
      <div class="flex items-center gap-1">
        {#each ['Account', 'Plan', 'Review'] as step, i (step)}
          <div class="flex items-center gap-1">
            <div
              class="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold {i ===
              0
                ? 'bg-primary text-text-on-primary'
                : 'border-border-default text-text-quaternary border'}"
            >
              {i + 1}
            </div>
            <span
              class="text-[7px] {i === 0 ? 'text-primary font-semibold' : 'text-text-quaternary'}"
              >{step}</span
            >
          </div>
          {#if i < 2}<div class="bg-border-subtle h-px flex-1"></div>{/if}
        {/each}
      </div>
      <Progress value={33} size="xs" intent="primary" />
      <div class="border-border-subtle flex-1 space-y-1.5 rounded-md border p-2">
        {@render field('Full name')}
        {@render field('Email')}
      </div>
    </div>
  {:else if href === '/recipes/notification-center'}
    <!-- Slide-in panel: unread rows carry a tint -->
    <div class="flex h-full">
      <div class="bg-surface-subtle flex-1"></div>
      <div
        class="border-border-subtle bg-surface-base w-[168px] border-l shadow-[var(--blocks-shadow-lg)]"
      >
        <div class="border-border-subtle flex items-center justify-between border-b px-2 py-1.5">
          <div class="text-text-primary flex items-center gap-1 text-[8px] font-semibold">
            <BellIcon class="h-2.5 w-2.5" />
            Notifications
          </div>
          <Badge variant="soft" intent="danger" size="sm">3</Badge>
        </div>
        {#each [{ n: 'Sarah C.', t: 'Commented on your design', u: true }, { n: 'Build Bot', t: 'Build #1234 passed', u: true }, { n: 'Tom W.', t: 'Invited you to a project', u: false }] as x (x.n)}
          <div class="flex items-start gap-1.5 px-2 py-1.5 {x.u ? 'bg-primary-subtle/40' : ''}">
            <Avatar name={x.n} size="xs" />
            <div class="min-w-0">
              <div class="text-text-primary text-[8px] font-medium">{x.n}</div>
              <div class="text-text-tertiary truncate text-[7px]">{x.t}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if href === '/recipes/pricing'}
    <!-- Three tiers, middle one featured -->
    <div class="flex h-full flex-col items-center justify-center gap-2 px-3">
      <div class="border-border-subtle bg-surface-subtle flex gap-px rounded-full border p-px">
        <span class="text-text-tertiary rounded-full px-1.5 py-0.5 text-[7px]">Monthly</span>
        <span
          class="bg-surface-base text-text-primary rounded-full px-1.5 py-0.5 text-[7px] font-semibold shadow-[var(--blocks-shadow-sm)]"
          >Annual</span
        >
      </div>
      <div class="flex w-full items-end gap-1.5">
        {#each [['Starter', '$7'], ['Pro', '$24'], ['Team', '$66']] as [plan, price], i (plan)}
          <div
            class="flex-1 rounded-md border p-1.5 text-center {i === 1
              ? 'border-primary bg-primary-subtle/30 py-2.5'
              : 'border-border-subtle'}"
          >
            {#if i === 1}
              <div class="text-primary text-[6px] font-bold tracking-wide uppercase">Popular</div>
            {/if}
            <div class="text-text-tertiary text-[7px]">{plan}</div>
            <div class="text-text-primary text-[13px] leading-tight font-bold">{price}</div>
            <div class="text-text-quaternary text-[6px]">/mo</div>
          </div>
        {/each}
      </div>
    </div>
  {:else if href === '/recipes/trace-drawer'}
    <!-- "How was this calculated?" — indented contributions summing to a total -->
    <div class="flex h-full">
      <div class="bg-surface-subtle flex-1"></div>
      <div
        class="border-border-subtle bg-surface-base w-[176px] space-y-1 border-l p-2 shadow-[var(--blocks-shadow-lg)]"
      >
        <div class="text-text-primary text-[8px] font-semibold">Total rent</div>
        {#each [{ l: 'Base rent', v: '€780', d: 0 }, { l: 'Heating', v: '€96', d: 1 }, { l: '· kWh × rate', v: '€72', d: 2 }, { l: '· Base fee', v: '€24', d: 2 }] as row (row.l)}
          <div
            class="flex items-center justify-between text-[7px]"
            style="padding-left: {row.d * 8}px"
          >
            <span class={row.d === 2 ? 'text-text-quaternary' : 'text-text-secondary'}>{row.l}</span
            >
            <span class={row.d === 2 ? 'text-text-quaternary' : 'text-text-primary font-medium'}
              >{row.v}</span
            >
          </div>
        {/each}
        <div class="border-border-default mt-1 border-t pt-1">
          <div class="flex items-center justify-between">
            <span class="text-text-primary text-[8px] font-semibold">Sum</span>
            <span class="text-primary text-3xs font-bold">€876</span>
          </div>
        </div>
      </div>
    </div>
  {:else if href === '/recipes/decision-tree-wizard'}
    <!-- Answers steer the branch; the recommendation is derived -->
    <div class="flex h-full flex-col gap-1.5 p-2.5">
      <div class="text-text-secondary flex items-center gap-1 text-[7px] font-semibold">
        <GitBranchIcon class="h-2.5 w-2.5" />
        Which fits best?
      </div>
      {#each [['Rent it out', true], ['Sell it', false]] as [label, on] (label)}
        <div
          class="flex items-center gap-1.5 rounded border px-1.5 py-1 {on
            ? 'border-primary bg-primary-subtle/30'
            : 'border-border-subtle'}"
        >
          <div
            class="flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border {on
              ? 'border-primary'
              : 'border-border-default'}"
          >
            {#if on}<div class="bg-primary h-1.5 w-1.5 rounded-full"></div>{/if}
          </div>
          <span class="text-[8px] {on ? 'text-text-primary font-medium' : 'text-text-tertiary'}"
            >{label}</span
          >
        </div>
      {/each}
      <div class="bg-success-subtle mt-auto flex items-center gap-1 rounded px-1.5 py-1">
        <SparklesIcon class="text-success h-2.5 w-2.5 shrink-0" />
        <span class="text-success text-[7px] font-medium">Recommended: Long-term lease</span>
      </div>
    </div>
  {:else if href === '/recipes/range-hint-input'}
    <!-- Helper text turns colour as the value leaves the plausible band -->
    <div class="grid h-full place-items-center px-4">
      <div class="w-full space-y-1.5">
        <div class="text-text-secondary text-[8px] font-medium">Annual consumption</div>
        <div
          class="border-warning bg-surface-base flex h-[22px] items-center justify-between rounded border px-1.5"
        >
          <span class="text-text-primary text-[9px] font-semibold">18,400</span>
          <span class="text-text-quaternary text-[7px]">kWh</span>
        </div>
        <!-- The track is the wrapper's own background, so the plausible band and the
             marker stack by DOM order — no z-index needed (and none is invented). -->
        <div class="bg-surface-subtle relative h-1 w-full rounded-full">
          <div
            class="bg-success-subtle absolute inset-y-0 right-[35%] left-[15%] rounded-full"
          ></div>
          <div
            class="bg-warning absolute top-1/2 left-[78%] h-2 w-2 -translate-y-1/2 rounded-full"
          ></div>
        </div>
        <div class="text-warning flex items-center gap-1 text-[7px]">
          <WarningTriangleIcon class="h-2.5 w-2.5 shrink-0" />
          Above the usual 4,000–12,000 kWh
        </div>
      </div>
    </div>
  {:else if href === '/recipes/clickable-card'}
    <!-- The whole card is one target — one ring, one arrow, no nested link -->
    <div class="bg-surface-subtle grid h-full place-items-center">
      <div
        class="border-primary bg-surface-base ring-primary/20 w-[168px] rounded-md border p-2.5 shadow-[var(--blocks-shadow-md)] ring-2"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1 space-y-1">
            <div class="text-text-primary text-[9px] font-semibold">Apartment 3B</div>
            {@render line('h-1 w-full')}
            {@render line('h-1 w-3/5')}
          </div>
          <div
            class="bg-primary-subtle flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
          >
            <ArrowRightIcon class="text-primary h-2.5 w-2.5" />
          </div>
        </div>
      </div>
    </div>
  {:else if href === '/recipes/stat-tile'}
    <!-- KPI tiles: label, value, trend, icon -->
    <div class="grid h-full grid-cols-2 gap-1.5 p-2.5">
      {#each [{ l: 'Revenue', v: '€42.1k', i: WalletIcon, up: true, t: '+12%' }, { l: 'Consumption', v: '8,420', i: GaugeIcon, up: false, t: '−3%' }, { l: 'Invoices', v: '5', i: ReceiptIcon, up: true, t: '+2' }, { l: 'Tenants', v: '38', i: UsersIcon, up: true, t: '+4' }] as s (s.l)}
        <div class="border-border-subtle flex items-center gap-1.5 rounded-md border p-1.5">
          <div class="bg-primary-subtle flex h-5 w-5 shrink-0 items-center justify-center rounded">
            <s.i class="text-primary h-3 w-3" />
          </div>
          <div class="min-w-0">
            <div class="text-text-quaternary truncate text-[6px]">{s.l}</div>
            <div class="text-text-primary text-3xs leading-tight font-bold">{s.v}</div>
            <div
              class="flex items-center gap-0.5 text-[6px] {s.up ? 'text-success' : 'text-danger'}"
            >
              {#if s.up}
                <TrendingUpIcon class="h-2 w-2" />
              {:else}
                <TrendingDownIcon class="h-2 w-2" />
              {/if}
              {s.t}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if href === '/recipes/page-header'}
    <!-- Eyebrow, title, actions, tab row — the top of a detail page -->
    <div class="flex h-full flex-col gap-1.5 p-2.5">
      <div class="text-text-quaternary flex items-center gap-1 text-[6px]">
        <span>Properties</span>
        <span>/</span>
        <span class="text-text-tertiary">Apartment 3B</span>
      </div>
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-primary text-[6px] font-bold tracking-wide uppercase">Lease</div>
          <div class="text-text-primary truncate text-[12px] leading-tight font-bold">
            Apartment 3B
          </div>
          <div class="text-text-tertiary truncate text-[7px]">Bergstraße 14 · Munich</div>
        </div>
        <div class="flex shrink-0 gap-1">
          <div
            class="border-border-default text-text-secondary flex h-[16px] items-center rounded border px-1.5 text-[7px]"
          >
            Edit
          </div>
          <div
            class="bg-primary text-text-on-primary flex h-[16px] items-center rounded px-1.5 text-[7px] font-semibold"
          >
            Publish
          </div>
        </div>
      </div>
      <div class="border-border-subtle mt-auto flex gap-2.5 border-b">
        {#each ['Overview', 'Documents', 'History'] as tab, i (tab)}
          <span
            class="pb-1 text-[7px] {i === 0
              ? 'text-primary border-primary -mb-px border-b font-semibold'
              : 'text-text-tertiary'}">{tab}</span
          >
        {/each}
      </div>
    </div>
  {:else if href === '/recipes/help-tooltip'}
    <!-- A domain term explaining itself in place -->
    <div class="grid h-full place-items-center px-4">
      <div class="w-full space-y-1">
        <div class="flex items-center gap-1">
          <span class="text-text-secondary text-[8px] font-medium">Allocation key</span>
          <CircleHelpIcon class="text-text-quaternary h-2.5 w-2.5" />
        </div>
        <div
          class="bg-surface-inverted relative w-[152px] rounded px-1.5 py-1 shadow-[var(--blocks-shadow-md)]"
        >
          <div class="bg-surface-inverted absolute -top-[3px] left-3 h-1.5 w-1.5 rotate-45"></div>
          <div class="text-text-inverted text-[7px] leading-snug">
            How shared costs are split across units — by area, headcount, or consumption.
          </div>
        </div>
        {@render field('Living area (m²)')}
      </div>
    </div>
  {:else if href === '/recipes/onboarding-flow'}
    <!-- Spotlight tour: beacon pulses, hint explains, panel stays open -->
    <div class="relative h-full">
      <div class="flex h-full flex-col gap-1.5 p-2.5">
        {@render line('h-1.5 w-2/3')}
        <div class="border-border-subtle flex-1 rounded border"></div>
        {@render line('h-1.5 w-1/2')}
      </div>
      <!-- Scrim reads as "the tour dims the app", but stays light enough that the
           card still sits in the grid's rhythm rather than as a dark block. -->
      <div class="bg-surface-inverted/25 absolute inset-0"></div>
      <div
        class="border-primary bg-surface-base absolute top-1/2 left-1/2 w-[150px] -translate-x-1/2 -translate-y-1/2 space-y-1 rounded-md border p-2 shadow-[var(--blocks-shadow-lg)]"
      >
        <div class="text-primary flex items-center gap-1 text-[7px] font-bold">
          <SparklesIcon class="h-2.5 w-2.5" />
          Step 2 of 4
        </div>
        <div class="text-text-primary text-[8px] font-semibold">Add your first property</div>
        <div class="text-text-tertiary text-[7px] leading-snug">
          Everything else hangs off this record.
        </div>
        <div class="flex justify-end gap-1 pt-0.5">
          <span class="text-text-quaternary text-[7px]">Skip</span>
          <span
            class="bg-primary text-text-on-primary rounded px-1.5 py-px text-[7px] font-semibold"
            >Next</span
          >
        </div>
      </div>
      <div class="absolute top-3 right-3 flex h-3 w-3 items-center justify-center">
        <div class="bg-primary/40 absolute h-3 w-3 rounded-full"></div>
        <div class="bg-primary h-1.5 w-1.5 rounded-full"></div>
      </div>
    </div>
  {:else if href === '/recipes/unsaved-changes-guard'}
    <!-- Modal intercepting a navigation away from a dirty form -->
    <div class="relative h-full">
      <div class="flex h-full flex-col gap-1.5 p-2.5">
        {@render line('h-1.5 w-1/2')}
        {@render field('Name')}
        {@render field('Email')}
      </div>
      <div class="bg-surface-inverted/25 absolute inset-0"></div>
      <div
        class="border-border-subtle bg-surface-overlay absolute top-1/2 left-1/2 w-[164px] -translate-x-1/2 -translate-y-1/2 space-y-1.5 rounded-md border p-2.5 shadow-[var(--blocks-shadow-lg)]"
      >
        <div class="flex items-start gap-1.5">
          <div
            class="bg-warning-subtle flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
          >
            <AlertCircleIcon class="text-warning h-2.5 w-2.5" />
          </div>
          <div>
            <div class="text-text-primary text-[8px] font-semibold">Discard changes?</div>
            <div class="text-text-tertiary text-[7px] leading-snug">You have unsaved edits.</div>
          </div>
        </div>
        <div class="flex justify-end gap-1">
          <span
            class="border-border-default text-text-secondary rounded border px-1.5 py-px text-[7px]"
            >Stay</span
          >
          <span class="bg-danger text-text-on-fill rounded px-1.5 py-px text-[7px] font-semibold"
            >Discard</span
          >
        </div>
      </div>
    </div>
  {:else if href === '/recipes/meal-planner'}
    <!-- Week grid: meals bucketed per day, every day gets an Add affordance -->
    <div class="flex h-full flex-col p-2">
      <div class="text-text-secondary mb-1 flex items-center gap-1 text-[7px] font-semibold">
        <CoffeeIcon class="h-2.5 w-2.5" />
        This week
      </div>
      <div class="grid flex-1 grid-cols-5 gap-1">
        {#each [{ d: 'Mon', m: ['Pasta'] }, { d: 'Tue', m: ['Curry', 'Soup'] }, { d: 'Wed', m: [] }, { d: 'Thu', m: ['Tacos'] }, { d: 'Fri', m: [] }] as day (day.d)}
          <div class="border-border-subtle flex flex-col gap-0.5 rounded border p-1">
            <div class="text-text-quaternary text-[6px] font-semibold">{day.d}</div>
            {#each day.m as meal (meal)}
              <div class="bg-primary-subtle text-primary truncate rounded px-0.5 py-px text-[6px]">
                {meal}
              </div>
            {/each}
            <div
              class="border-border-subtle text-text-quaternary mt-auto flex items-center justify-center rounded border border-dashed py-px"
            >
              <PlusIcon class="h-2 w-2" />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <!-- No preview should reach this branch; every recipe above has one. -->
    <div class="bg-surface-subtle grid h-full place-items-center">
      {@render line('h-1.5 w-16')}
    </div>
  {/if}
</div>
