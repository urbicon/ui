<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    InfoCard,
    Section
  } from '@urbicon-ui/docs';
  import {
    GuideArticle,
    GuideController,
    GuideMarker,
    GuideMention,
    GuidePanel,
    GuideProvider
  } from '@urbicon-ui/blocks';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  // Every Guide surface is a `@standalone` catalog component with its own generated
  // api.ts (sibling route dirs without a +page — this system page stays the single
  // docs surface; MCP/llm.txt consumers see them as eight components).
  import { componentData as providerData } from '../guide-provider/api';
  import { componentData as panelData } from '../guide-panel/api';
  import { componentData as articleData } from '../guide-article/api';
  import { componentData as markerData } from '../guide-marker/api';
  import { componentData as mentionData } from '../guide-mention/api';
  import { componentData as refData } from '../guide-ref/api';
  import { componentData as hintData } from '../guide-hint/api';
  import { componentData as beaconData } from '../guide-beacon/api';
  import { buildRelatedLinks } from '$lib/component-links';
  import { asset, resolve } from '$app/paths';

  // The generated @related list is the sibling Guide surfaces — self-referential on this
  // family page. Point "related" at the spatial, event-driven overlays Guide contrasts with
  // (§1: Guide is the sequential, system-driven overlay) instead.
  const relatedLinks = buildRelatedLinks({
    relatedComponents: ['Dialog', 'Drawer', 'Popover', 'Tooltip']
  });

  // Per-surface API tables, fed from each surface's generated api.ts (same JSDoc
  // source the MCP catalog and llm.txt are built from).
  const surfaces = [
    { data: providerData, blurb: 'Context root — wires every surface to one GuideController.' },
    { data: panelData, blurb: 'The callable, non-modal help panel (D1).' },
    { data: articleData, blurb: 'A structured help article inside the panel.' },
    {
      data: markerData,
      blurb: 'Direction A — the discreet "ⓘ" trigger that opens the panel at an article.'
    },
    {
      data: mentionData,
      blurb: 'Direction B — inline article→UI reference that highlights the element.'
    },
    {
      data: refData,
      blurb: 'Inline article→article link — navigates the panel to another article.'
    },
    { data: hintData, blurb: 'Contextual, waiting hint anchored to a data-guide element.' },
    { data: beaconData, blurb: 'Waiting, pulsing hotspot that starts an opt-in tour.' }
  ];

  // One controller drives the whole headline demo — created once, shared via context.
  // dev:false keeps the docs console quiet; the demo never persists "seen" state.
  const demoGuide = new GuideController({ dev: false });

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'setup', title: 'Setup', order: 2 },
    { id: 'panel', title: 'Help panel', order: 3 },
    { id: 'hint', title: 'Contextual hints', order: 4 },
    { id: 'tour', title: 'Guided tour', order: 5 },
    { id: 'analytics', title: 'Analytics', order: 6 },
    { id: 'namespace', title: 'data-guide namespace', order: 7 },
    { id: 'accessibility', title: 'Accessibility', order: 8 },
    { id: 'customization', title: 'Customization', order: 9 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];

  // ── Hand-authored API tables for the engine + tour-definition surface that docs-gen
  //    cannot reach (it only extracts local *Props interfaces, not imported utils types). ──

  const controllerApi = [
    {
      name: 'new GuideController(options?)',
      type: 'GuideControllerOptions',
      description:
        'Construct the engine. Options: `storage` (StorageAdapter, default localStorage), `navigate` ((route) => void | Promise — the cross-route hook, wire `goto`), `navigationSource` (current-path/navigation seam, default Navigation API + popstate), `overlayStack`, `dev`. Pass it to `<GuideProvider controller={…}>` for programmatic access.'
    },
    {
      name: 'startTour(tour)',
      type: '(tour: GuideTour) => boolean',
      description:
        'Start a tour. Returns false if it was already seen (and `once !== false`) or has no steps.'
    },
    {
      name: 'next() / prev()',
      type: '() => void',
      description: 'Advance / go back one step. `next()` on the last step completes the tour.'
    },
    {
      name: 'skip() / finish()',
      type: '() => void',
      description:
        'End the tour (both mark it seen, unless `once: false`). `skip` fires `onSkip`, `finish` fires `onComplete`.'
    },
    {
      name: 'stopTour()',
      type: '() => void',
      description:
        'Tear down a running tour WITHOUT marking it seen or firing analytics — for route changes / unmount. It can surface again later.'
    },
    {
      name: 'openPanel(article?) / closePanel()',
      type: '(article?: string) => void',
      description: 'Open or close the help panel, optionally jumping to an article id.'
    },
    {
      name: 'highlight(id, opts?) / clearHighlight()',
      type: '(id: string, opts?: { scroll?: boolean }) => void',
      description:
        'Add / remove the additive `outline` ring on a `data-guide` target. Shared by tour steps and Mention→UI.'
    },
    {
      name: 'target(id, meta?)',
      type: '(id, meta?: GuideTopicMeta) => Attachment',
      description:
        'Svelte attachment that registers the host element as a guide target with optional metadata (`label`, `article`, `direction`).'
    },
    {
      name: 'hasSeen(id) / markSeen(id) / resetSeen(id?)',
      type: '(id: string) => boolean | void',
      description: 'Query, set, or clear the persisted "seen" state for a tour or hint id.'
    }
  ];

  const tourApi = [
    {
      name: 'id',
      type: 'string',
      required: true,
      description: 'Unique id — used for "seen" persistence.'
    },
    { name: 'steps', type: 'GuideStep[]', required: true, description: 'Ordered tour steps.' },
    {
      name: 'once',
      type: 'boolean',
      defaultValue: 'true',
      description: 'Skip automatically once completed or dismissed.'
    },
    {
      name: 'onStep',
      type: '(event: GuideStepEvent) => void',
      description:
        'Fired when a step becomes active — once on start (`via: "start"`) and on each next/prev. Where the step-by-step funnel lives.'
    },
    {
      name: 'onComplete',
      type: '(event: GuideEndEvent) => void',
      description: 'Fired when the tour completes (finish, or next past the last step).'
    },
    {
      name: 'onSkip',
      type: '(event: GuideEndEvent) => void',
      description:
        'Fired when the tour is dismissed before completing. `event.index` is the step the user dropped off at.'
    }
  ];

  const stepApi = [
    {
      name: 'target',
      type: 'string',
      description: '`data-guide` id to anchor to. Omit for a centered, full-scrim step.'
    },
    {
      name: 'route',
      type: 'string',
      description:
        'Route this step lives on (declarative cross-route touring). When set and ≠ the current location, the controller navigates there via the `navigate` hook before spotlighting, then re-anchors once the target appears. A tour-internal navigation keeps the tour running; a foreign one stops it. `prev()` navigates back symmetrically. Needs a `navigate` hook (else DEV-warns and stays put).'
    },
    { name: 'title', type: 'string', description: 'Step heading.' },
    { name: 'body', type: 'string', description: 'Step body text.' },
    {
      name: 'placement',
      type: 'Placement',
      description: 'Preferred bubble placement relative to the target.'
    },
    {
      name: 'interactive',
      type: 'boolean',
      defaultValue: 'false',
      description:
        'Keep the spotlit target clickable through the scrim hole (and tabbable via the two-zone cycle).'
    },
    {
      name: 'advance',
      type: "'user' | 'action'",
      defaultValue: "'user'",
      description:
        'Learning-by-doing gate: with `"action"`, Next/ArrowRight are inert (`aria-disabled` + screen-reader hint) and only `controller.next()` advances — call it once the user performed the real action. Usually paired with `interactive: true`. Back and Skip stay available.'
    }
  ];

  const eventApi = [
    {
      name: 'tour',
      type: 'GuideTour',
      description: 'The tour the event belongs to (handy for a shared, tour-keyed handler).'
    },
    { name: 'index', type: 'number', description: 'Zero-based index of the active step.' },
    {
      name: 'step',
      type: 'GuideStep | null',
      description: 'The active step (`GuideStep` for onStep; nullable on the end events).'
    },
    { name: 'total', type: 'number', description: 'Total number of steps in the tour.' },
    {
      name: 'via',
      type: "'start' | 'next' | 'prev'",
      description: 'onStep only — how the step became active.'
    }
  ];
</script>

<SeoMeta
  title="Guide Component"
  description="A bidirectional in-app help system: a non-modal help panel, contextual hints, UI↔guide links, and an opt-in guided tour — over one headless engine."
/>

<DocsPageLayout
  title="Guide"
  description="A bidirectional in-app help system: a non-modal help panel, contextual hints, UI↔guide links, and an opt-in guided tour — all over one headless engine."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[
    { label: 'Blocks', href: resolve('/blocks') },
    { label: 'Components', href: resolve('/blocks/components') }
  ]}
  {navigation}
  stability={componentData?.stability}
  sourceHref={componentData?.sourceHref}
  related={relatedLinks}
>
  <Section id="playground" intent="primary">
    <InfoCard intent="info" title="The bidirectional link, live">
      Click the <strong>ⓘ</strong> marker to open the help panel (UI → guide), then hover or focus a
      <strong>link inside an article</strong> to highlight the matching field (guide → UI). The
      panel is
      <em>non-modal</em> — it docks to the screen edge and the app stays interactive behind it, which
      is exactly what lets a mention highlight a field while the panel is open.
    </InfoCard>

    <div class="mt-6">
      <GuideProvider controller={demoGuide}>
        <div
          class="border-border-subtle bg-surface-elevated mx-auto max-w-md rounded-2xl border p-6"
        >
          <div class="mb-4 flex items-center gap-1.5">
            <h3 class="text-text-primary text-base font-semibold">Billing</h3>
            <GuideMarker for="pg-plan" />
          </div>
          <dl class="space-y-2.5 text-sm">
            <div
              data-guide="pg-plan"
              class="border-border-subtle flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <dt class="text-text-tertiary">Plan</dt>
              <dd class="text-text-primary font-medium">Pro — $29/mo</dd>
            </div>
            <div
              data-guide="pg-seats"
              class="border-border-subtle flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <dt class="text-text-tertiary">Seats</dt>
              <dd class="text-text-primary font-medium">5 of 10 used</dd>
            </div>
          </dl>
        </div>

        <GuidePanel title="Help">
          <GuideArticle id="pg-plan" title="Billing & plans">
            <p>
              Your <GuideMention for="pg-plan">current plan</GuideMention> sets your monthly price and
              feature limits. Upgrade or downgrade at any time.
            </p>
            <p>
              Each <GuideMention for="pg-seats">seat</GuideMention> is one team member who can sign in.
              You are billed per occupied seat.
            </p>
          </GuideArticle>
        </GuidePanel>
      </GuideProvider>
    </div>
  </Section>

  <CustomDocs />

  <Section marker="09" id="api" title="API Reference" intent="secondary" meta="9 surfaces">
    <div class="space-y-10">
      <div>
        <h3 class="text-text-primary mb-1 text-lg font-semibold">Guide (tour renderer)</h3>
        <p class="text-text-secondary mb-4 text-sm">
          Mount once inside <code>GuideProvider</code>; renders nothing until a tour starts.
        </p>
        <ApiReference props={componentData?.props ?? []} />
      </div>

      <div>
        <h3 class="text-text-primary mb-1 text-lg font-semibold">GuideController</h3>
        <p class="text-text-secondary mb-4 text-sm">
          The headless engine. Create one and pass it to the provider for programmatic control.
        </p>
        <ApiReference props={controllerApi} />
      </div>

      <div>
        <h3 class="text-text-primary mb-1 text-lg font-semibold">GuideTour</h3>
        <p class="text-text-secondary mb-4 text-sm">
          The tour definition you pass to <code>startTour</code> — lives in your app, not the library.
        </p>
        <ApiReference props={tourApi} />
      </div>

      <div>
        <h3 class="text-text-primary mb-1 text-lg font-semibold">GuideStep</h3>
        <ApiReference props={stepApi} />
      </div>

      <div>
        <h3 class="text-text-primary mb-1 text-lg font-semibold">GuideStepEvent / GuideEndEvent</h3>
        <p class="text-text-secondary mb-4 text-sm">The payloads passed to the analytics hooks.</p>
        <ApiReference props={eventApi} />
      </div>

      {#each surfaces as surface (surface.data.name)}
        <div>
          <h3 class="text-text-primary mb-1 text-lg font-semibold">{surface.data.name}</h3>
          <p class="text-text-secondary mb-4 text-sm">{surface.blurb}</p>
          <ApiReference props={surface.data.props ?? []} />
        </div>
      {/each}
    </div>
  </Section>

  <Section marker="10" id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import {
  GuideProvider,
  GuidePanel,
  GuideArticle,
  GuideMarker,
  GuideMention,
  GuideRef,
  GuideHint,
  Guide,
  GuideBeacon,
  GuideController
} from '@urbicon-ui/blocks';
import type { GuideTour, GuideStep, GuideStepEvent, GuideEndEvent } from '@urbicon-ui/blocks';`}
      language="svelte"
      preview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/blocks/components/guide/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
