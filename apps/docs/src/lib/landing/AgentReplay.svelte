<!--
  The Agents exhibit: a terminal replay of the agent building BookingCard,
  and the real thing appearing beside it — live components, not a video.

  The stage is the tile's proof, in two views. RESULT shows the working card;
  SOURCE shows the very file the agent wrote — the same
  $lib/hotel/BookingCard.svelte the validate lines were recorded against,
  imported `?raw` at build time and shown VERBATIM, so it can never drift from
  what ships. That second view is what cashes the tile's claim ("readable
  code"): thirty-odd lines, and a visitor can check. Verbatim display is also
  why BookingCard carries no demo scaffolding (no reveal props, no meta
  comment): the file has to read like something an agent would ship, because
  it is the thing on display. The build choreography lives HERE — the card
  enters once the transcript prints the file, one entrance, CSS-only.

  The two score/✓ lines are REAL recorded output and live in
  $lib/landing/agent-output (shared with the Getting-started row, which shows
  the same gate on the visitor's own build) — the honesty contract for them is
  documented there.

  The stage frame mirrors the LiveryTile's anatomy (bordered exhibit box,
  switch bar at the bottom) so tiles three and four read as one family.
-->
<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import { CodePanel } from '@urbicon-ui/docs';
  import { VALIDATE_OK, VALIDATE_SCORE } from '$lib/landing/agent-output';
  import BookingCard from '$lib/hotel/BookingCard.svelte';
  import bookingCardSource from '$lib/hotel/BookingCard.svelte?raw';

  interface Frame {
    text: string;
    kind: 'cmd' | 'add' | 'dim' | 'run' | 'ok';
    /** Build progress after this line — the stage enters at ≥ 1 (file exists). */
    step?: number;
    /** Pause before the next line (ms). */
    pause?: number;
  }

  const FRAMES: Frame[] = [
    { text: '$ claude "add a booking card to the hotel page"', kind: 'cmd', pause: 1000 },
    { text: '✚ src/lib/hotel/BookingCard.svelte', kind: 'add', step: 1, pause: 1300 },
    {
      text: 'RadioGroup · Select · Button — semantic tokens only',
      kind: 'dim',
      step: 2,
      pause: 1300
    },
    {
      text: '▸ bunx urbicon validate src/lib/hotel/BookingCard.svelte',
      kind: 'run',
      step: 3,
      pause: 1000
    },
    { text: VALIDATE_SCORE, kind: 'ok', pause: 300 },
    { text: VALIDATE_OK, kind: 'ok' }
  ];

  const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

  let printed = $state(0);
  let step = $state(0);
  let playing = $state(false);
  let done = $state(false);
  let view = $state<'result' | 'source'>('result');
  /** Invalidates an in-flight run on replay/unmount. */
  let session = 0;

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function settle() {
    printed = FRAMES.length;
    step = 3;
    playing = false;
    done = true;
  }

  async function play() {
    if (playing) return;
    const token = ++session;
    playing = true;
    printed = 0;
    step = 0;
    if (reducedMotion.current) {
      settle();
      return;
    }
    for (const frame of FRAMES) {
      if (token !== session) return;
      printed += 1;
      if (frame.step !== undefined) step = frame.step;
      if (frame.pause) await sleep(frame.pause);
    }
    if (token !== session) return;
    playing = false;
    done = true;
  }

  /**
   * Start once, when the tile is actually near the viewport — a one-way gate,
   * same pattern as LiveryTile. Off-screen tiles (and background tabs, which
   * never deliver IntersectionObserver callbacks) stay quiet instead of
   * playing to nobody.
   */
  function whenVisible(node: HTMLElement) {
    if (typeof IntersectionObserver === 'undefined') {
      settle();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void play();
        }
      },
      { rootMargin: '80px' }
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      session += 1;
    };
  }

  const VIEWS = [
    { id: 'result', label: 'Result' },
    { id: 'source', label: 'Source' }
  ] as const;
</script>

<div class="replay" {@attach whenVisible}>
  <div class="term">
    {#each FRAMES.slice(0, printed) as frame (frame.text)}
      <p class={frame.kind}>{frame.text}</p>
    {/each}
    {#if done}
      <button
        type="button"
        class="again"
        onclick={() => {
          done = false;
          void play();
        }}>↻ replay</button
      >
    {/if}
  </div>

  {#if step >= 1}
    <div
      class="stagebox rounded-contain border-border-default bg-surface-base flex min-h-0 flex-col overflow-hidden border"
    >
      <div class="stage min-h-0 flex-1 overflow-y-auto">
        {#if view === 'result'}
          <div class="p-4">
            <BookingCard />
          </div>
        {:else}
          <CodePanel
            code={bookingCardSource}
            language="svelte"
            size="sm"
            label="BookingCard.svelte"
            lineNumbers
          />
        {/if}
      </div>

      <!-- The one gesture — same bar anatomy as the LiveryTile's livery switch. -->
      <div class="border-border-subtle flex flex-wrap items-center gap-2 border-t px-4 py-3">
        <div class="flex gap-1.5" role="group" aria-label="Stage view">
          {#each VIEWS as option (option.id)}
            <button
              type="button"
              class={[
                'rounded-modify text-3xs cursor-pointer border px-2.5 py-1 tracking-[0.14em] uppercase',
                option.id === view
                  ? 'border-primary bg-primary text-text-on-primary'
                  : 'border-border-default text-text-secondary hover:text-text-primary'
              ]}
              aria-pressed={option.id === view}
              onclick={() => (view = option.id)}
            >
              {option.label}
            </button>
          {/each}
        </div>
        <span class="text-3xs text-text-tertiary ml-auto font-mono tracking-[0.08em]"
          >src/lib/hotel/BookingCard.svelte</span
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .replay {
    width: min(480px, 100%);
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  /*
   * Auf breiten Schirmen steht die Bühne NEBEN dem Transkript statt darunter:
   * das ist ohnehin die ehrlichere Anordnung — der Agent schreibt links, das
   * Ergebnis erscheint rechts. Gleiche Hälften, weil die Source-Ansicht
   * Zeilenbreite braucht. Schwelle wie auf der Landing (dort begründet).
   */
  @media (min-width: 78rem) {
    .replay {
      width: min(1040px, 100%);
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr);
      align-items: stretch;
      gap: 1.4rem;
    }
    .term {
      min-width: 0;
      max-height: 100%;
      overflow-y: auto;
    }
  }

  /* Terminal ist in beiden Modi dunkel; die Akzente kommen aus der
     Kanal-Livery der Kachel (primary = Vollton-Grün via .room-accent). */
  .term {
    flex-shrink: 0;
    background: #101010;
    color: #d8d8d2;
    border-radius: var(--radius-contain);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12.5px;
    line-height: 1.9;
    padding: 1rem 1.25rem;
    /* Reserviert die volle Transkript-Höhe, damit die Bühne daneben/darunter
       nicht mit jeder gedruckten Zeile wandert. */
    min-height: 16em;
    scrollbar-width: thin;
  }
  .dim {
    opacity: 0.55;
  }
  .run {
    opacity: 0.85;
  }
  .ok {
    color: var(--color-primary);
  }
  .again {
    margin-top: 0.4em;
    cursor: pointer;
    font: inherit;
    color: inherit;
    opacity: 0.55;
    background: none;
    border: none;
    padding: 0;
  }
  .again:hover {
    opacity: 1;
  }
  .again:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    opacity: 1;
  }

  /* Schmale Kacheln: die Bühne nimmt den Rest der Kachelhöhe und scrollt
     innen — wie die LiveryTile-Bühne. Der Eintritt ersetzt den alten
     3-Stufen-Aufbau (der ein `step`-Gerüst in der GEZEIGTEN Datei brauchte):
     eine Bewegung, rein im CSS der Demo. */
  .stagebox {
    flex: 1 1 auto;
    animation: stage-in 380ms ease;
  }
  @keyframes stage-in {
    from {
      opacity: 0;
      translate: 0 10px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .stagebox {
      animation: none;
    }
  }
  .stage {
    scrollbar-width: thin;
  }
</style>
