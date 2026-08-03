<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import {
    Button,
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
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';

  const { components: usedComponents } = recipeMeta;

  // One controller drives every surface. dev:false keeps the docs console quiet.
  const guide = new GuideController({ dev: false });

  // A live event log so the analytics hooks are visible as the user moves through the tour.
  let seq = 0;
  let events = $state<{ id: number; text: string; tone: 'step' | 'done' | 'skip' }[]>([]);
  let hintOpen = $state(false);
  function logEvent(text: string, tone: 'step' | 'done' | 'skip') {
    events = [{ id: seq++, text, tone }, ...events].slice(0, 7);
  }

  const onboardingTour: GuideTour = {
    id: 'recipe-onboarding',
    once: false, // repeatable in the demo
    steps: [
      {
        target: 'ob-projects',
        title: 'Create your first project',
        body: 'Everything starts with a project — your space for tasks, files, and docs.'
      },
      {
        target: 'ob-team',
        title: 'Invite your team',
        body: 'Bring teammates in so they can collaborate from day one.'
      },
      {
        target: 'ob-api',
        title: 'Generate an API key',
        body: 'Automate anything once you are set up.',
        interactive: true
      }
    ],
    // The actual business value: a step-by-step funnel, completion, and drop-off signal.
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

  const recipeCode =
    `<script lang="ts">
  import {
    GuideProvider, Guide, GuideBeacon, GuidePanel, GuideArticle,
    GuideMarker, GuideMention, GuideHint, GuideController
  } from '@urbicon-ui/blocks';
  import type { GuideTour } from '@urbicon-ui/blocks';

  const guide = new GuideController();
  let hintOpen = $state(false);

  const onboardingTour: GuideTour = {
    id: 'onboarding',
    steps: [
      { target: 'projects', title: 'Create your first project', body: 'Your space for tasks and files.' },
      { target: 'team', title: 'Invite your team', body: 'Collaborate from day one.' },
      { target: 'api', title: 'Generate an API key', body: 'Automate anything.', interactive: true }
    ],
    // The business value of onboarding lives here, not in the tour mechanic.
    onStep: ({ index, total, via }) => analytics.track('onboard_step', { step: index + 1, total, via }),
    onComplete: () => { analytics.track('onboard_complete'); hintOpen = true; },
    onSkip: ({ index }) => analytics.track('onboard_skip', { droppedAt: index })
  };
</scr` +
    `ipt>

<GuideProvider controller={guide}>
  <header>
    <span>Acme Workspace</span>
    <!-- UI → guide: opens the help panel at the matching article -->
    <GuideMarker for="projects" />
    <!-- the gentle, opt-in tour entry — hides itself once the tour is seen -->
    <GuideBeacon tour={onboardingTour} />
  </header>

  <!-- data-guide marks each target once; tours, hints, markers + mentions all resolve to it -->
  <button data-guide="projects">New project</button>
  <button data-guide="team">Invite team</button>
  <button data-guide="api">API keys</button>

  <!-- non-modal help panel: stays open while a mention highlights the UI behind it -->
  <GuidePanel title="Help">
    <GuideArticle id="projects" title="Projects & workspace">
      <p>A <GuideMention for="projects">project</GuideMention> groups your work.
         Add people from <GuideMention for="team">team settings</GuideMention>.</p>
    </GuideArticle>
  </GuidePanel>

  <!-- contextual hint, revealed after the tour completes -->
  <GuideHint for="api" trigger="manual" open={hintOpen} title="New: API keys"
    onDismiss={() => (hintOpen = false)}>
    Generate scoped API keys for automation.
  </GuideHint>

  <!-- mount the tour renderer once; invisible until a tour starts -->
  <Guide />
</GuideProvider>`;
</script>

<SeoMeta title="Onboarding Flow Recipe" />

<div class="mx-auto max-w-6xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <Section id="preview" title="Live Preview">
    <p class="text-text-tertiary mb-4 text-sm">
      Click the pulsing beacon (or the ⓘ) to start. Move through the tour and watch the analytics
      hooks fire on the right — completing it reveals the "new feature" hint.
    </p>
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- The app being onboarded -->
      <div class="lg:col-span-2">
        <GuideProvider controller={guide}>
          <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
            <div class="mb-5 flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="text-text-primary font-semibold">Acme Workspace</span>
                <GuideMarker for="ob-projects" />
              </div>
              <span class="relative inline-flex items-center gap-2">
                <span class="text-text-tertiary text-xs">New here?</span>
                <GuideBeacon tour={onboardingTour} once={false} />
              </span>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                data-guide="ob-projects"
                class="border-border-subtle bg-surface-base hover:border-border-emphasis rounded-xl border px-4 py-5 text-left text-sm transition-colors"
              >
                <FolderIcon class="text-text-secondary mb-1 block h-5 w-5" />
                <span class="text-text-primary font-medium">New project</span>
              </button>
              <button
                data-guide="ob-team"
                class="border-border-subtle bg-surface-base hover:border-border-emphasis rounded-xl border px-4 py-5 text-left text-sm transition-colors"
              >
                <UsersIcon class="text-text-secondary mb-1 block h-5 w-5" />
                <span class="text-text-primary font-medium">Invite team</span>
              </button>
              <button
                data-guide="ob-api"
                class="border-border-subtle bg-surface-base hover:border-border-emphasis rounded-xl border px-4 py-5 text-left text-sm transition-colors"
              >
                <KeyIcon class="text-text-secondary mb-1 block h-5 w-5" />
                <span class="text-text-primary font-medium">API keys</span>
              </button>
            </div>

            <!-- Non-modal help panel (Direction A + B) -->
            <GuidePanel title="Workspace help">
              <GuideArticle id="ob-projects" title="Projects & workspace">
                <p>
                  A <GuideMention for="ob-projects">project</GuideMention> groups your tasks, files, and
                  docs. Start there, then add people from
                  <GuideMention for="ob-team">team settings</GuideMention>.
                </p>
                <p>
                  Prefer automation? Generate an
                  <GuideMention for="ob-api">API key</GuideMention> and drive everything from the API.
                </p>
              </GuideArticle>
            </GuidePanel>

            <!-- Contextual hint, revealed after onboarding completes -->
            <GuideHint
              for="ob-api"
              trigger="manual"
              open={hintOpen}
              once={false}
              title="New: API keys"
              onDismiss={() => (hintOpen = false)}
            >
              You can now generate scoped API keys for automation.
            </GuideHint>

            <!-- Tour renderer (spotlight + bubble) -->
            <Guide />
          </div>
        </GuideProvider>
      </div>

      <!-- Live analytics log -->
      <div class="border-border-subtle bg-surface-base flex flex-col rounded-2xl border p-5">
        <p class="text-text-primary text-sm font-semibold">Tour analytics</p>
        <p class="text-text-tertiary mt-1 text-xs leading-relaxed">
          <code>onStep</code> / <code>onComplete</code> / <code>onSkip</code> fire from the engine — the
          funnel and drop-off signal that is the real value of onboarding.
        </p>
        <div class="mt-4 flex-1">
          {#if events.length === 0}
            <p class="text-text-tertiary text-xs italic">No events yet — start the tour.</p>
          {:else}
            <ul class="space-y-1.5 font-mono text-xs">
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
      </div>
    </div>
  </Section>

  <!-- Source Code -->
  <div class="mt-12">
    <CodeExample
      title="Onboarding Flow Recipe"
      code={recipeCode}
      language="svelte"
      preview={false}
    />
  </div>
</div>
