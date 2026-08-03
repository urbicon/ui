<script lang="ts">
  import { CodeExample, InfoCard, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Button,
    Guide,
    GuideArticle,
    GuideBeacon,
    GuideController,
    GuideHint,
    GuidePanel,
    GuideProvider,
    GuideRef,
    Kbd
  } from '@urbicon-ui/blocks';
  import type { GuideTour } from '@urbicon-ui/blocks';

  // Each demo owns an isolated controller (one engine per provider). dev:false keeps the
  // docs console quiet; once:false on the demo tour/beacon makes them endlessly repeatable.
  // The panel demos are isolated too: panelOpen/activeArticle are controller-level state,
  // so panels sharing one provider would open in lockstep and fight over the active article.
  const groupsGuide = new GuideController({ dev: false });
  const searchGuide = new GuideController({ dev: false });
  const refGuide = new GuideController({ dev: false });

  const hintGuide = new GuideController({ dev: false });
  let hintOpen = $state(false);

  const tourGuide = new GuideController({ dev: false });
  const demoTour: GuideTour = {
    id: 'docs-demo-tour',
    once: false,
    steps: [
      {
        target: 'tour-filters',
        title: 'Filter the list',
        body: 'Narrow what you see by status, owner, or date.'
      },
      {
        target: 'tour-export',
        title: 'Export anytime',
        body: 'Download the current view as CSV or schedule a recurring export.',
        interactive: true
      }
    ]
  };
</script>

<!-- ─── Setup ─── -->

<Section marker="01" id="setup" title="Setup">
  <p class="text-text-secondary mb-4 max-w-2xl text-sm leading-relaxed">
    Mount one <code>GuideProvider</code> near your app root. It instantiates a
    <code>GuideController</code> and shares it with every Guide surface via context. Mark any UI
    element a topic with <code>data-guide="&lt;id&gt;"</code>; tours, hints, markers, and mentions
    all resolve through that one namespace.
  </p>
  <CodeExample
    title="Provider + controller + a topic"
    code={`<script lang="ts">
  import { GuideProvider, Guide, GuideController } from '@urbicon-ui/blocks';

  // Create the controller yourself for programmatic access (start tours, open the panel).
  const guide = new GuideController();
</scr` +
      `ipt>

<GuideProvider controller={guide}>
  <!-- Any element becomes a guide target with a data-guide id -->
  <button data-guide="save-button">Save</button>

  <!-- Mount the tour renderer once; it stays invisible until a tour starts -->
  <Guide />
</GuideProvider>

<button onclick={() => guide.startTour(welcomeTour)}>Take the tour</button>`}
    language="svelte"
    preview={false}
  />
</Section>

<!-- ─── The help panel ─── -->

<Section marker="02" id="panel" title="The help panel">
  <p class="text-text-secondary mb-4 max-w-2xl text-sm leading-relaxed">
    The <code>GuidePanel</code> is a small help center living inside your product. Its index is
    nothing more than the <code>GuideArticle</code>s you mount — and it scales with them: bucket
    articles into sections with <code>group</code>, switch on <code>searchable</code> when the
    catalog grows, and cross-link related articles with <code>GuideRef</code>. All three demos below
    open a real panel; close it with its <strong>×</strong> button or Escape.
  </p>

  <CodeExample
    title="Grouped sections"
    description="Open the help panel — articles that share a group render under one section header."
    isolate
  >
    <GuideProvider controller={groupsGuide}>
      <div
        class="border-border-subtle bg-surface-elevated flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border px-4 py-3"
      >
        <span class="text-text-primary text-sm font-semibold">Atlas — Projects</span>
        <Button
          variant="outlined"
          intent="neutral"
          size="sm"
          onclick={() => groupsGuide.openPanel()}
        >
          Open help
        </Button>
      </div>
      <GuidePanel title="Help">
        <GuideArticle id="grp-first-project" title="Create a project" group="Getting started">
          <p>A project collects everything one team ships: tasks, docs, and milestones.</p>
        </GuideArticle>
        <GuideArticle id="grp-invite" title="Invite your team" group="Getting started">
          <p>Invite teammates by email — they join with access to every shared project.</p>
        </GuideArticle>
        <GuideArticle id="grp-plans" title="Plans & pricing" group="Billing">
          <p>The Free plan covers three projects. Pro removes the limit.</p>
        </GuideArticle>
        <GuideArticle id="grp-seats" title="Seats" group="Billing">
          <p>You are billed per occupied seat, prorated monthly.</p>
        </GuideArticle>
        <GuideArticle id="grp-shortcuts" title="Keyboard shortcuts">
          <p>Press <strong>?</strong> anywhere to see the full shortcut map.</p>
        </GuideArticle>
      </GuidePanel>
    </GuideProvider>
  </CodeExample>

  <p class="text-text-secondary my-4 max-w-2xl text-sm leading-relaxed">
    Sections appear in the order their first article is defined; articles without a
    <code>group</code> (here: "Keyboard shortcuts") collect into one headerless block. When no article
    sets a group at all, the index stays a flat list — grouping is purely opt-in.
  </p>

  <CodeExample
    title="Searchable index"
    description="Open the panel and type “export” — the filter narrows the index while non-empty sections keep their headers."
    isolate
  >
    <GuideProvider controller={searchGuide}>
      <div
        class="border-border-subtle bg-surface-elevated flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border px-4 py-3"
      >
        <span class="text-text-primary text-sm font-semibold">Atlas — Settings</span>
        <Button
          variant="outlined"
          intent="neutral"
          size="sm"
          onclick={() => searchGuide.openPanel()}
        >
          Open help
        </Button>
      </div>
      <GuidePanel title="Help" searchable>
        <GuideArticle id="srch-profile" title="Profile & avatar" group="Account">
          <p>Your name and avatar appear on comments and shared views.</p>
        </GuideArticle>
        <GuideArticle id="srch-security" title="Password & security" group="Account">
          <p>Change your password or add a passkey for phishing-resistant sign-in.</p>
        </GuideArticle>
        <GuideArticle id="srch-notifications" title="Notification preferences" group="Account">
          <p>Choose which events reach you by email, push, or in-app.</p>
        </GuideArticle>
        <GuideArticle id="srch-import" title="Import from CSV" group="Data">
          <p>Upload a CSV and map its columns to project fields.</p>
        </GuideArticle>
        <GuideArticle id="srch-export" title="Export your data" group="Data">
          <p>Download the current view as CSV or JSON at any time.</p>
        </GuideArticle>
        <GuideArticle id="srch-scheduled" title="Scheduled exports" group="Data">
          <p>Deliver a recurring export to email or webhook on a schedule.</p>
        </GuideArticle>
      </GuidePanel>
    </GuideProvider>
  </CodeExample>

  <p class="text-text-secondary my-4 max-w-2xl text-sm leading-relaxed">
    The filter matches article titles case-insensitively and runs <em>before</em> grouping, so empty sections
    disappear and an empty result announces itself politely. Closing the panel resets the query — a reopen
    starts from the complete index. Search pairs naturally with grouping, but works on a flat list just
    as well.
  </p>

  <CodeExample
    title="Cross-linked articles"
    description="Open the pot article, then follow the inline references to jump between related articles."
    isolate
  >
    <GuideProvider controller={refGuide}>
      <div
        class="border-border-subtle bg-surface-elevated flex w-full max-w-md items-center justify-between gap-3 rounded-2xl border px-4 py-3"
      >
        <span class="text-text-primary text-sm font-semibold">Trip to Lisbon — €412.80</span>
        <Button
          variant="outlined"
          intent="neutral"
          size="sm"
          onclick={() => refGuide.openPanel('ref-pot')}
        >
          How is this split?
        </Button>
      </div>
      <GuidePanel title="Help">
        <GuideArticle id="ref-pot" title="The cost pot">
          <p>
            Every expense lands in the trip's shared pot. At the end, the pot is settled with as few
            transfers as possible, based on each expense's
            <GuideRef article="ref-splitting">splitting method</GuideRef>.
          </p>
        </GuideArticle>
        <GuideArticle id="ref-splitting" title="Splitting methods">
          <p>
            Split equally, by shares, or by exact amounts. The method applies per expense and feeds
            the <GuideRef article="ref-pot">cost pot</GuideRef>'s final balance.
          </p>
        </GuideArticle>
      </GuidePanel>
    </GuideProvider>
  </CodeExample>

  <p class="text-text-secondary mt-4 max-w-2xl text-sm leading-relaxed">
    A <code>GuideRef</code> navigates the open panel to another article — the help-internal analogue
    of <code>GuideMention</code>, which links out to a UI element instead. It resolves against the
    panel's article registry, so a ref pointing at an unknown id (or rendered outside a panel)
    degrades to plain text instead of a dead link. The panel's back button returns to the index from
    any article.
  </p>
</Section>

<!-- ─── Contextual hints ─── -->

<Section marker="03" id="hint" title="Contextual hints">
  <p class="text-text-secondary mb-4 max-w-2xl text-sm leading-relaxed">
    A <code>GuideHint</code> waits at the right element instead of interrupting. Show it on mount,
    or drive it from your own route/condition with <code>trigger="manual"</code> and
    <code>open</code>. It persists "seen" so it appears once, and steps aside while a modal or tour
    is open.
  </p>
  <CodeExample
    title="A waiting hint"
    description="Toggle the hint anchored to the Export button."
    isolate
  >
    <GuideProvider controller={hintGuide}>
      <div class="flex flex-wrap items-center gap-3">
        <button
          data-guide="ex-export"
          class="border-border-default text-text-secondary rounded-lg border px-3 py-2 text-sm"
        >
          Export
        </button>
        <Button
          variant="outlined"
          intent="neutral"
          size="sm"
          onclick={() => (hintOpen = !hintOpen)}
        >
          {hintOpen ? 'Hide' : 'Show'} hint
        </Button>
      </div>
      <GuideHint
        for="ex-export"
        trigger="manual"
        open={hintOpen}
        once={false}
        title="New: scheduled exports"
        onDismiss={() => (hintOpen = false)}
      >
        You can now export on a recurring schedule from here.
      </GuideHint>
    </GuideProvider>
  </CodeExample>
</Section>

<!-- ─── Guided tour + beacon ─── -->

<Section marker="04" id="tour" title="Guided tour & beacon">
  <p class="text-text-secondary mb-4 max-w-2xl text-sm leading-relaxed">
    The guided tour is the deliberately opt-in, intrusive surface: a spotlight that dims everything
    but the current step's target, plus an anchored bubble. A <code>GuideBeacon</code> is the gentle entry
    point — a waiting hotspot that starts the tour on click, the opposite of an auto-start.
  </p>
  <InfoCard intent="warning" title="Heads up">
    Starting the tour dims the whole page — that is the spotlight scrim doing its job. Use the dots,
    <strong>Back</strong> / <strong>Next</strong>, <strong>Skip</strong>, the arrow keys, or
    <strong>Escape</strong> to move through or leave it.
  </InfoCard>
  <div class="mt-4">
    <CodeExample
      title="Beacon-launched tour"
      description="Click the pulsing beacon, or the button, to start a two-step tour."
      isolate
    >
      <GuideProvider controller={tourGuide}>
        <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
          <div class="mb-4 flex items-center justify-between">
            <p class="text-text-primary text-sm font-semibold">Dashboard</p>
            <span class="relative inline-flex">
              <GuideBeacon tour={demoTour} once={false} />
            </span>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              data-guide="tour-filters"
              class="border-border-default text-text-secondary rounded-lg border px-3 py-2 text-sm"
            >
              Filters
            </button>
            <button
              data-guide="tour-export"
              class="border-border-default text-text-secondary rounded-lg border px-3 py-2 text-sm"
            >
              Export
            </button>
          </div>
          <div class="mt-4">
            <Button
              variant="outlined"
              intent="neutral"
              size="sm"
              onclick={() => tourGuide.startTour(demoTour)}
            >
              Start tour
            </Button>
          </div>
        </div>
        <Guide />
      </GuideProvider>
    </CodeExample>
  </div>

  <div class="mt-6">
    <p class="text-text-secondary mb-4 max-w-2xl text-sm leading-relaxed">
      Tours survive client-side navigation: the controller lives in the layout's provider, an
      unresolved target renders centered over the full scrim, and the bubble re-anchors as soon as
      the new route's <code>data-guide</code> element appears. Give a step a <code>route</code> and
      wire a <code>navigate</code> hook, and the library drives the navigation declaratively — going
      to the step's route <em>before</em> the spotlight. A tour-internal navigation keeps the tour
      running; a <em>foreign</em> one (the user leaving) stops it (analytics-silent).
      <code>prev()</code> navigates back symmetrically. Keep <code>Guide</code> mounted in the
      layout (a route-local renderer unmounts on navigation and ends the tour). For routing chosen
      at runtime, navigate imperatively in <code>onStep</code> instead (a tour with no
      <code>route</code> is never second-guessed).
    </p>
    <CodeExample
      title="Cross-route tour (declarative step.route + navigate hook)"
      code={`<script lang="ts">
  import { goto } from '$app/navigation';
  import { GuideController, type GuideTour } from '@urbicon-ui/blocks';

  // Wire the router once; the library stays framework-agnostic.
  // (Equivalently: <GuideProvider navigate={(route) => goto(route)}>.)
  const guide = new GuideController({ navigate: (route) => goto(route) });

  const tour: GuideTour = {
    id: 'cross-route-onboarding',
    steps: [
      { target: 'dash-overview', route: '/dashboard', title: 'Your dashboard', body: '…' },
      { target: 'dash-filter', route: '/dashboard', title: 'Filter', body: '…' },
      { target: 'billing-plan', route: '/settings/billing', title: 'Your plan', body: '…' }
    ]
  };
</scr` + `ipt>`}
      language="svelte"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Analytics ─── -->

<Section marker="05" id="analytics" title="Analytics">
  <p class="text-text-secondary mb-4 max-w-2xl text-sm leading-relaxed">
    The real value of a tour is its funnel and drop-off signal. A <code>GuideTour</code> carries
    three optional hooks fired from the engine, so they trigger no matter which surface drives the
    tour. They are invoked defensively — a throwing handler never corrupts tour state. See
    <code>GuideStepEvent</code> / <code>GuideEndEvent</code> in the API reference for the payloads.
  </p>
  <CodeExample
    title="Wiring tour analytics"
    code={`const welcomeTour: GuideTour = {
  id: 'welcome',
  steps: [
    { target: 'save-button', title: 'Save', body: 'Persist your changes here.' },
    { target: 'filter-control', title: 'Filter', body: 'Narrow the list.', interactive: true }
  ],
  // Fired on start (via: 'start') and every next/prev — the step-by-step funnel.
  onStep: ({ index, total, via }) =>
    analytics.track('tour_step', { tour: 'welcome', step: index + 1, total, via }),
  // Fired when the user finishes the whole tour.
  onComplete: () => analytics.track('tour_complete', { tour: 'welcome' }),
  // Fired when the user bails — event.index is where they dropped off.
  onSkip: ({ index }) => analytics.track('tour_skip', { tour: 'welcome', droppedAt: index })
};`}
    language="typescript"
    preview={false}
  />
</Section>

<!-- ─── data-guide namespace ─── -->

<Section marker="06" id="namespace" title="The data-guide namespace">
  <p class="text-text-secondary mb-4 max-w-2xl text-sm leading-relaxed">
    Every guide target is identified by a string id. There are two ways to register one — both feed
    the same registry, so a tour step, a hint, a marker, and a mention can all point at the same id.
  </p>
  <CodeExample
    title="Two ways to mark a target"
    code={`<!-- 1. Declarative attribute — framework-agnostic, works on elements you don't render -->
<button data-guide="save-button">Save</button>

<!-- 2. Programmatic attachment — carries metadata (label, article, direction) -->
<button {@attach guide.target('save-button', {
  label: 'Save button',
  article: 'saving',          // which panel article the marker opens
  direction: 'both'           // 'to-guide' | 'to-ui' | 'both' — gates Marker vs Mention
})}>Save</button>`}
    language="svelte"
    preview={false}
  />
  <p class="text-text-secondary mt-4 max-w-2xl text-sm leading-relaxed">
    <code>direction</code> makes the bidirectional link a deliberate choice: <code>'to-ui'</code>
    makes a <code>GuideMarker</code> inert (UI → guide off), <code>'to-guide'</code> degrades a
    <code>GuideMention</code> to plain text (guide → UI off), and <code>'both'</code> (the default) enables
    both. In DEV, a target id referenced but not found in the DOM logs a warning instead of failing silently.
  </p>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="07" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Keyboard parity">
      <p>
        Markers and mentions are real <code>&lt;button&gt;</code>s. A mention highlights its target
        on
        <strong>focus</strong> as well as hover, so the bidirectional link works without a mouse.
        The tour bubble takes focus on open;
        <Kbd keys="→" /> / <Kbd keys="←" /> step, <Kbd keys="Esc" /> skips. An interactive step joins
        its spotlit target to the bubble in one Tab cycle.
      </p>
    </Note>
    <Note title="Announcements & focus">
      <p>
        The tour announces each step through a polite <code>aria-live</code> region (so the
        arrow-key path is never silent), and the hint announces itself with
        <code>role="status"</code>. The tour returns focus to wherever it was when the tour ends.
      </p>
    </Note>
    <Note title="Non-modal by design">
      <p>
        The help panel has no focus trap and no backdrop — it coexists with the app (that is what
        lets a mention highlight a field behind it). Escape only closes it while focus is inside, so
        a foreground dialog keeps priority. Motion (panel slide, beacon pulse, step fade) honors
        <code>prefers-reduced-motion</code>.
      </p>
    </Note>
  </NoteList>
</Section>

<!-- ─── Customization ─── -->

<Section marker="08" id="customization" title="Customization">
  <p class="text-text-secondary mb-4 max-w-2xl text-sm leading-relaxed">
    Every surface supports <code>unstyled</code>, per-slot <code>slotClasses</code>, and named
    <code>preset</code>s. Two tokens tune the tour's spotlight scrim and the additive highlight
    ring.
  </p>
  <CodeExample
    title="Tokens & slot overrides"
    code={`/* Tune globally via the design tokens (defaults shown — override to taste) */
:root {
  --blocks-guide-scrim: oklch(0 0 0 / 0.5);            /* the tour's dimming backdrop */
  --blocks-guide-highlight-ring: var(--color-primary); /* the additive Mention→UI ring */
}

/* Or override per instance */
<GuidePanel slotClasses={{ panel: 'w-[28rem]', header: 'bg-surface-subtle' }} />
<GuideHint slotClasses={{ hint: 'max-w-sm' }} />`}
    language="svelte"
    preview={false}
  />
</Section>
