<!--
  The Agents exhibit: a terminal replay of the agent building BookingCard,
  while the real card materialises beneath it — live components, not a video.

  Honesty contract: the two ✓/score lines are REAL output, recorded 2026-07-30
  against the exact file this tile renders —
  `bunx urbicon validate src/lib/salon/BookingCard.svelte` (urbicon 6.44.0) —
  quoted verbatim, minus the repeated file path. When BookingCard changes,
  re-run the command and update the two lines.
-->
<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import BookingCard from '$lib/salon/BookingCard.svelte';

  interface Frame {
    text: string;
    kind: 'cmd' | 'add' | 'dim' | 'run' | 'ok';
    /** Card reveal level after this line. */
    step?: number;
    /** Pause before the next line (ms). */
    pause?: number;
  }

  const FRAMES: Frame[] = [
    { text: '$ claude "add a booking card to the salon page"', kind: 'cmd', pause: 1000 },
    { text: '✚ src/lib/salon/BookingCard.svelte', kind: 'add', step: 1, pause: 1300 },
    {
      text: 'RadioGroup · Select · Button — semantic tokens only',
      kind: 'dim',
      step: 2,
      pause: 1300
    },
    {
      text: '▸ bunx urbicon validate src/lib/salon/BookingCard.svelte',
      kind: 'run',
      step: 3,
      pause: 1000
    },
    {
      text: 'correctness 100/100 · slop 100/100 · 0 error(s), 0 warning(s), 0 slop note(s)',
      kind: 'ok',
      pause: 300
    },
    { text: '✓ no issues', kind: 'ok' }
  ];

  const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

  let printed = $state(0);
  let step = $state(0);
  let playing = $state(false);
  let done = $state(false);
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
    <div class="stage">
      <BookingCard {step} />
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
   * Auf breiten Schirmen steht die Karte NEBEN dem Transkript statt darunter:
   * das ist ohnehin die ehrlichere Anordnung — der Agent schreibt links, das
   * Ergebnis erscheint rechts. Schwelle wie auf der Landing (dort begründet).
   */
  @media (min-width: 78rem) {
    .replay {
      width: min(920px, 100%);
      flex-direction: row;
      align-items: start;
      gap: 1.4rem;
    }
    .term {
      flex: 1 1 0;
      min-width: 0;
    }
    .stage {
      flex: 0 1 320px;
      max-height: 100%;
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
    /* Reserviert die volle Transkript-Höhe, damit die Karte darunter nicht
       mit jeder gedruckten Zeile nach unten wandert. */
    min-height: 16em;
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

  .stage {
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
  }
</style>
