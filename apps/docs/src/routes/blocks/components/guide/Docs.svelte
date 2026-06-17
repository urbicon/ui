<script lang="ts">
  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import {
    Button,
    Guide,
    GuideBeacon,
    GuideController,
    GuideHint,
    GuideProvider
  } from '@urbicon-ui/blocks';
  import type { GuideTour } from '@urbicon-ui/blocks';

  // Each demo owns an isolated controller (one engine per provider). dev:false keeps the
  // docs console quiet; once:false on the demo tour/beacon makes them endlessly repeatable.
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

<!-- ─── Contextual hints ─── -->

<Section marker="02" id="hint" title="Contextual hints">
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

<Section marker="03" id="tour" title="Guided tour & beacon">
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
            <h4 class="text-text-primary text-sm font-semibold">Dashboard</h4>
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
      the new route's <code>data-guide</code> element appears. The library never navigates itself —
      the app does, in <code>onStep</code>. Keep <code>Guide</code> mounted in the layout (a
      route-local renderer unmounts on navigation and ends the tour), and prefer
      <code>stopTour()</code> only when navigation invalidates the tour (e.g. logout) — it tears down
      without marking the tour seen.
    </p>
    <CodeExample
      title="Cross-route tour (app-driven navigation)"
      code={`<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import type { GuideTour } from '@urbicon-ui/blocks';

  // App-side step → route map; the library knows nothing about your router.
  const stepRoutes: Record<number, string> = { 0: '/dashboard', 2: '/settings/billing' };

  const tour: GuideTour = {
    id: 'cross-route-onboarding',
    steps: [
      { target: 'dash-overview', title: 'Your dashboard', body: '…' },
      { target: 'dash-filter', title: 'Filter', body: '…' },
      { target: 'billing-plan', title: 'Your plan', body: '…' } // lives on /settings/billing
    ],
    onStep: ({ index }) => {
      const route = stepRoutes[index];
      if (route && route !== page.url.pathname) goto(route);
    }
  };
</scr` + `ipt>`}
      language="svelte"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Analytics ─── -->

<Section marker="04" id="analytics" title="Analytics">
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

<Section marker="05" id="namespace" title="The data-guide namespace">
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

<Section marker="06" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard parity</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Markers and mentions are real <code>&lt;button&gt;</code>s. A mention highlights its
          target on
          <strong>focus</strong> as well as hover, so the bidirectional link works without a mouse.
          The tour bubble takes focus on open;
          <kbd class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs"
            >&#8594;</kbd
          >
          /
          <kbd class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs"
            >&#8592;</kbd
          >
          step,
          <kbd class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs"
            >Esc</kbd
          >
          skips. An interactive step joins its spotlit target to the bubble in one Tab cycle.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Announcements & focus</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The tour announces each step through a polite <code>aria-live</code> region (so the
          arrow-key path is never silent), and the hint announces itself with
          <code>role="status"</code>. The tour returns focus to wherever it was when the tour ends.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Non-modal by design</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The help panel has no focus trap and no backdrop — it coexists with the app (that is what
          lets a mention highlight a field behind it). Escape only closes it while focus is inside,
          so a foreground dialog keeps priority. Motion (panel slide, beacon pulse, step fade)
          honors
          <code>prefers-reduced-motion</code>.
        </p>
      </div>
    </div>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="07" id="customization" title="Customization">
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
