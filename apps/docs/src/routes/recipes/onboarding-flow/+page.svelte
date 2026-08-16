<script lang="ts">
  import {
    Button,
    Card,
    FolderIcon,
    Guide,
    GuideArticle,
    GuideBeacon,
    GuideController,
    GuideHint,
    GuideMarker,
    GuideMention,
    GuidePanel,
    GuideProvider,
    KeyIcon,
    UsersIcon
  } from '@urbicon-ui/blocks';
  import type { GuideTour } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  // Demo = code, with the seam drawn here: the Guide parts — the tour object,
  // beacon, marker, panel + article, hint and <Guide /> — are identical in the
  // demo below and in recipeCode. The scenery around them is not: the demo
  // dresses its workspace mock richer (elevated Card, icon tiles, the live
  // analytics log) than the skeletal header + buttons the code sketches, and
  // the demo's controller passes dev: false so the docs page's HMR
  // re-registrations don't warn in the console; recipeCode shows a bare
  // controller instead.
  const guide = new GuideController({ dev: false });

  // The analytics hooks made visible: the demo renders each callback into this
  // log instead of sending it to a tracker.
  let seq = 0;
  let events = $state<{ id: number; text: string; tone: 'step' | 'done' | 'skip' }[]>([]);
  let hintOpen = $state(false);
  function logEvent(text: string, tone: 'step' | 'done' | 'skip') {
    events = [{ id: seq++, text, tone }, ...events].slice(0, 7);
  }

  const onboardingTour: GuideTour = {
    id: 'onboarding',
    once: false, // repeatable in the demo — see the comment in recipeCode
    steps: [
      {
        target: 'projects',
        title: 'Create your first project',
        body: 'Everything starts with a project: your space for tasks, files, and docs.'
      },
      {
        target: 'team',
        title: 'Invite your team',
        body: 'Bring teammates in so they can collaborate from day one.'
      },
      {
        target: 'api',
        title: 'Generate an API key',
        body: 'Automate anything once you are set up.',
        interactive: true
      }
    ],
    onStep: (e) => logEvent(`onStep → ${e.index + 1}/${e.total} (${e.via})`, 'step'),
    onComplete: () => {
      logEvent('onComplete → funnel finished', 'done');
      hintOpen = true; // reveal the "new feature" hint once onboarding is done
    },
    onSkip: (e) => logEvent(`onSkip → dropped at step ${e.index + 1}`, 'skip')
  };

  const toneClass = {
    step: 'text-text-secondary',
    done: 'text-success',
    skip: 'text-warning'
  };

  const recipeCode = `<\script lang="ts">
  import {
    Guide,
    GuideArticle,
    GuideBeacon,
    GuideController,
    GuideHint,
    GuideMarker,
    GuideMention,
    GuidePanel,
    GuideProvider
  } from '@urbicon-ui/blocks';
  import type { GuideTour } from '@urbicon-ui/blocks';

  const guide = new GuideController();
  let hintOpen = $state(false);

  const onboardingTour: GuideTour = {
    id: 'onboarding',
    // once: false — here, on the beacon and on the hint — keeps the docs demo
    // repeatable. Drop all three in your app: the default (true) shows each
    // once per user, remembered through the controller's storage adapter.
    once: false,
    steps: [
      {
        target: 'projects',
        title: 'Create your first project',
        body: 'Everything starts with a project: your space for tasks, files, and docs.'
      },
      {
        target: 'team',
        title: 'Invite your team',
        body: 'Bring teammates in so they can collaborate from day one.'
      },
      {
        // interactive keeps the spotlit tile clickable during this step
        target: 'api',
        title: 'Generate an API key',
        body: 'Automate anything once you are set up.',
        interactive: true
      }
    ],
    // Stand-ins for your analytics calls — the demo pipes the same events into
    // the log beside the workspace.
    onStep: (e) =>
      analytics.track('onboard_step', { step: e.index + 1, total: e.total, via: e.via }),
    onComplete: () => {
      analytics.track('onboard_complete');
      hintOpen = true; // reveal the "new feature" hint once onboarding is done
    },
    onSkip: (e) => analytics.track('onboard_skip', { droppedAt: e.index + 1 })
  };
<\/script>

<GuideProvider controller={guide}>
  <!-- Your app shell — the provider wraps it once, near the root. -->
  <header>
    <span>Acme Workspace</span>
    <!-- the ⓘ: opens the help panel at the matching article -->
    <GuideMarker for="projects" />
    <!-- the opt-in tour entry; hides itself once the tour is seen -->
    <GuideBeacon tour={onboardingTour} once={false} />
  </header>

  <!-- data-guide marks each target once; tour steps, the marker, the mentions
       and the hint all resolve to it -->
  <button data-guide="projects">New project</button>
  <button data-guide="team">Invite team</button>
  <button data-guide="api">API keys</button>

  <!-- non-modal help: the workspace stays usable behind the open panel -->
  <GuidePanel title="Workspace help">
    <GuideArticle id="projects" title="Projects & workspace">
      <p>
        A <GuideMention for="projects">project</GuideMention> groups your tasks, files, and
        docs. Start there, then add people from
        <GuideMention for="team">team settings</GuideMention>.
      </p>
      <p>
        Prefer automation? Generate an
        <GuideMention for="api">API key</GuideMention> and drive everything from the API.
      </p>
    </GuideArticle>
  </GuidePanel>

  <!-- waits for onComplete to raise hintOpen -->
  <GuideHint
    for="api"
    trigger="manual"
    open={hintOpen}
    once={false}
    title="New: API keys"
    onDismiss={() => (hintOpen = false)}
  >
    You can now generate scoped API keys for automation.
  </GuideHint>

  <!-- the tour renderer: mount once; renders nothing until a tour starts -->
  <Guide />
</GuideProvider>`;
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="WorkspacePage.svelte"
      description="Click the pulsing beacon to take the three-step tour; the log beside the workspace follows with `onStep` / `onComplete` / `onSkip`, and finishing reveals the `New: API keys` hint. The ⓘ opens the help panel."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="grid w-full grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- The workspace being onboarded -->
        <div class="lg:col-span-2">
          <GuideProvider controller={guide}>
            <Card variant="elevated">
              <div class="mb-5 flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="text-text-primary font-semibold">Acme Workspace</span>
                  <GuideMarker for="projects" />
                </div>
                <span class="inline-flex items-center gap-2">
                  <span class="text-text-tertiary text-xs">New here?</span>
                  <GuideBeacon tour={onboardingTour} once={false} />
                </span>
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Card tier="bridge" padding="sm" clickable data-guide="projects" class="text-left">
                  <FolderIcon size={20} class="text-text-secondary mb-1 block" />
                  <span class="text-text-primary block text-sm font-medium">New project</span>
                </Card>
                <Card tier="bridge" padding="sm" clickable data-guide="team" class="text-left">
                  <UsersIcon size={20} class="text-text-secondary mb-1 block" />
                  <span class="text-text-primary block text-sm font-medium">Invite team</span>
                </Card>
                <Card tier="bridge" padding="sm" clickable data-guide="api" class="text-left">
                  <KeyIcon size={20} class="text-text-secondary mb-1 block" />
                  <span class="text-text-primary block text-sm font-medium">API keys</span>
                </Card>
              </div>

              <GuidePanel title="Workspace help">
                <GuideArticle id="projects" title="Projects & workspace">
                  <p>
                    A <GuideMention for="projects">project</GuideMention> groups your tasks, files, and
                    docs. Start there, then add people from
                    <GuideMention for="team">team settings</GuideMention>.
                  </p>
                  <p>
                    Prefer automation? Generate an
                    <GuideMention for="api">API key</GuideMention> and drive everything from the API.
                  </p>
                </GuideArticle>
              </GuidePanel>

              <GuideHint
                for="api"
                trigger="manual"
                open={hintOpen}
                once={false}
                title="New: API keys"
                onDismiss={() => (hintOpen = false)}
              >
                You can now generate scoped API keys for automation.
              </GuideHint>

              <Guide />
            </Card>
          </GuideProvider>
        </div>

        <!-- The live analytics log (docs scenery: renders what the hooks fire) -->
        <Card variant="quiet" class="flex flex-col">
          <p class="text-text-primary text-sm font-semibold">Tour analytics</p>
          <p class="text-text-tertiary mt-1 text-xs leading-relaxed">
            <code>onStep</code> / <code>onComplete</code> / <code>onSkip</code> fire from the tour itself:
            the funnel and drop-off signal onboarding is run for.
          </p>
          <div class="mt-4 flex-1">
            {#if events.length === 0}
              <p class="font-meta italic">No events yet. Start the tour.</p>
            {:else}
              <ul class="font-meta space-y-1.5">
                {#each events as ev (ev.id)}
                  <li class={toneClass[ev.tone]}>{ev.text}</li>
                {/each}
              </ul>
            {/if}
          </div>
          {#if events.length > 0}
            <Button
              variant="ghost"
              intent="neutral"
              size="sm"
              class="mt-3 self-start"
              onclick={() => (events = [])}
            >
              Clear log
            </Button>
          {/if}
        </Card>
      </div>
    </CodeExample>
  </Section>

  <Section id="decisions" title="Opt-in, drop-off, top layer">
    <NoteList>
      <Note title="The tour is offered, not imposed">
        <p>
          An auto-starting tour interrupts everyone to help a few.
          <code class="text-text-primary">GuideBeacon</code> waits instead: it pulses beside the
          header until clicked, and with <code class="text-text-primary">once</code> (the default)
          the controller remembers a finished or skipped tour by its
          <code class="text-text-primary">id</code>, so nobody is toured twice. That memory lives in
          a storage adapter: localStorage out of the box, swappable through the controller's
          <code class="text-text-primary">storage</code> option when seen-state should follow the account
          instead of the browser.
        </p>
      </Note>
      <Note title="Skip is a signal">
        <p>
          <code class="text-text-primary">onSkip</code> reports the step index where the user
          dropped off, and it fires however the tour ends early: the Skip button, Escape, or a
          foreign modal taking over. Programmatic teardown via
          <code class="text-text-primary">stopTour()</code> stays silent on purpose, so a route change
          does not count as a lost user.
        </p>
      </Note>
      <Note title="The overlays out-stack the app">
        <p>
          The tour's spotlight and the hint render in the native popover top layer: they clear
          whatever stacking contexts your app builds, which is also why they may reach over this
          docs page. A foreign modal above them pauses the tour and hides the hint rather than
          fighting for <code class="text-text-primary">z-index</code>.
        </p>
      </Note>
    </NoteList>

    <p class="text-text-secondary mt-6 text-sm">
      The tour above is the smallest one. Steps can also gate on the user's real action (<code
        class="text-text-primary">advance: 'action'</code
      >) or live on another route (<code class="text-text-primary">route</code>, with a
      <code class="text-text-primary">navigate</code> hook wired to
      <code class="text-text-primary">goto</code>); the
      <a class="text-primary hover:underline" href={resolve('/blocks/components/guide')}>Guide</a>
      page documents both, together with the panel's search and article groups.
    </p>
  </Section>
</RecipeShell>
