<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  // E2E fixture for the Guide system (Playwright). Exercises every surface in controllable
  // states with stable data-testid hooks: the bidirectional Marker↔Mention link, the panel,
  // a contextual hint, the guided tour (centered + anchored + interactive steps), the beacon,
  // and a lazily-rendered target (Phase-8 hardening). Not part of the docs nav.
  import {
    GuideProvider,
    GuidePanel,
    GuideArticle,
    GuideMarker,
    GuideMention,
    GuideHint,
    Guide,
    GuideBeacon,
    GuideController,
    Button,
    type GuideTour
  } from '@urbicon-ui/blocks';

  // In-memory storage so "seen" state never persists across page loads — each Playwright
  // test starts from a clean slate (no localStorage carry-over between specs).
  const guide = new GuideController({ dev: false, storage: { load: () => [], save: () => {} } });

  let showLazy = $state(false);
  let hintOpen = $state(false);

  const targetBtn =
    'rounded-lg border border-border-hairline bg-surface-elevated px-3 py-1.5 text-sm text-text-primary';

  // Tour: a centered intro, an anchored non-interactive step, then an interactive step.
  const tour: GuideTour = {
    id: 'fx-tour',
    once: false,
    steps: [
      { title: 'Welcome', body: 'Centered intro step over a full scrim.' },
      {
        target: 'fx-save',
        title: 'Save',
        body: 'Anchored, non-interactive (blocker over the hole).'
      },
      {
        target: 'fx-filter',
        title: 'Filter',
        body: 'Interactive — the spotlit target stays clickable.',
        interactive: true
      }
    ]
  };

  // A separate once:true tour for the beacon, so finishing it marks "seen" and hides the beacon.
  const beaconTour: GuideTour = {
    id: 'fx-beacon-tour',
    steps: [{ target: 'fx-save', title: 'Beacon step', body: 'Started from the beacon.' }]
  };

  // Learning-by-doing: step 1 is advance:'action' — Next is gated, the user must click the
  // spotlit Filter button, whose handler advances imperatively via guide.next().
  const gatedTour: GuideTour = {
    id: 'fx-gated-tour',
    once: false,
    steps: [
      {
        target: 'fx-filter',
        title: 'Do it yourself',
        body: 'Click the Filter button to continue.',
        interactive: true,
        advance: 'action'
      },
      { title: 'Done', body: 'You performed the action yourself.' }
    ]
  };

  // The "real action" of the gated step — the app decides when the gate opens.
  function onFilterClick() {
    if (guide.activeTour?.id === 'fx-gated-tour') guide.next();
  }

  // Single-step tour whose target renders lazily — drives the appear/re-anchor hardening.
  const lazyTour: GuideTour = {
    id: 'fx-lazy-tour',
    once: false,
    steps: [{ target: 'fx-lazy', title: 'Lazy target', body: 'Renders after the step begins.' }]
  };

  // Start the lazy tour with its target absent, then render it ~500ms later (simulating an
  // async-loaded element appearing mid-step). The full scrim covers the toggle button, so the
  // target cannot be revealed by a click during the tour — it must surface on its own.
  function startLazyTour() {
    showLazy = false;
    guide.startTour(lazyTour);
    setTimeout(() => (showLazy = true), 500);
  }
</script>

<SeoMeta title="Guide Test Fixtures" />

<GuideProvider controller={guide}>
  <div class="bg-surface-base min-h-screen p-8" data-testid="guide-fixtures">
    <h1 class="text-text-primary mb-6 text-xl font-bold">Guide fixtures</h1>

    <!-- ── Bidirectional link (Marker → Panel, Mention → highlight) ── -->
    <section data-testid="section-bidirectional" class="mb-10">
      <h2 class="text-text-secondary mb-3 text-sm font-semibold">Bidirectional</h2>
      <div class="flex flex-wrap items-center gap-5">
        <div class="flex items-center gap-1">
          <button type="button" data-guide="fx-save" data-testid="target-save" class={targetBtn}>
            Save
          </button>
          <GuideMarker for="fx-save" article="saving" />
        </div>
        <div class="flex items-center gap-1">
          <button
            type="button"
            data-guide="fx-filter"
            data-testid="target-filter"
            class={targetBtn}
            onclick={onFilterClick}
          >
            Filter
          </button>
        </div>
      </div>
    </section>

    <!-- ── Contextual hint (manual trigger) ── -->
    <section data-testid="section-hint" class="mb-10">
      <h2 class="text-text-secondary mb-3 text-sm font-semibold">Hint</h2>
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" data-guide="fx-export" data-testid="target-export" class={targetBtn}>
          Export
        </button>
        <Button
          variant="outlined"
          intent="neutral"
          size="sm"
          data-testid="toggle-hint"
          onclick={() => (hintOpen = !hintOpen)}
        >
          Toggle hint
        </Button>
      </div>
    </section>

    <!-- ── Guided tour + beacon ── -->
    <section data-testid="section-tour" class="mb-10">
      <h2 class="text-text-secondary mb-3 text-sm font-semibold">Tour</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button size="sm" data-testid="start-tour" onclick={() => guide.startTour(tour)}>
          Start tour
        </Button>
        <Button
          variant="outlined"
          intent="neutral"
          size="sm"
          data-testid="start-gated-tour"
          onclick={() => guide.startTour(gatedTour)}
        >
          Start gated tour
        </Button>
        <span class="relative inline-flex">
          <GuideBeacon tour={beaconTour} />
        </span>
      </div>
    </section>

    <!-- ── Lazy target ── -->
    <section data-testid="section-lazy" class="mb-10">
      <h2 class="text-text-secondary mb-3 text-sm font-semibold">Lazy target</h2>
      <div class="flex flex-wrap items-center gap-3">
        <Button size="sm" data-testid="start-lazy-tour" onclick={startLazyTour}>
          Start lazy tour
        </Button>
        <Button
          variant="outlined"
          intent="neutral"
          size="sm"
          data-testid="toggle-lazy"
          onclick={() => (showLazy = !showLazy)}
        >
          Toggle lazy target
        </Button>
        {#if showLazy}
          <button type="button" data-guide="fx-lazy" data-testid="target-lazy" class={targetBtn}>
            Lazy element
          </button>
        {/if}
      </div>
    </section>

    <!-- Hint, panel, and the tour renderer. -->
    <GuideHint
      for="fx-export"
      trigger="manual"
      open={hintOpen}
      once={false}
      title="Export hint"
      onDismiss={() => (hintOpen = false)}
    >
      You can export from here.
    </GuideHint>

    <GuidePanel title="Help">
      <GuideArticle id="saving" title="Saving your work">
        <p>
          Use the <GuideMention for="fx-save">Save button</GuideMention> to persist your changes.
        </p>
      </GuideArticle>
    </GuidePanel>

    <Guide />
  </div>
</GuideProvider>
