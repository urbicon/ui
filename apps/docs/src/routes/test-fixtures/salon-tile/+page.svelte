<script lang="ts">
  import { Scroller } from '@urbicon-ui/blocks';
  import LiveryTile from '$lib/salon/LiveryTile.svelte';

  /**
   * Preview harness for the chat/livery tile — NOT a landing page.
   *
   * It exists to answer three questions before the tile is dropped into the
   * real row, on a page that can be thrown away:
   *
   * 1. Does the livery stay INSIDE the tile? The harness is deliberately a
   *    plain light page using the library's own tokens. If a house leaks, the
   *    surrounding chrome moves and you see it immediately.
   * 2. Does it survive a `Scroller`? Sitting alone proves nothing about a row
   *    that snaps, overflows and (with `emphasis`) transforms its items.
   * 3. Does the deferred mount hold? The placeholders push the tile out of the
   *    first screen, so it has to boot on scroll.
   *
   * The neighbouring tiles are stand-ins for the other exhibits, sized to the
   * same basis — the point is the row's behaviour, not their content.
   */

  const STANDINS = [
    { id: 'board', title: 'The Board', note: 'Scope — 97 zeroes in the DEPS column' },
    { id: 'engine', title: 'Under the hood', note: 'Discipline — the gate holds every edit' },
    { id: 'table', title: 'Table', note: 'Depth — one part that really carries' },
    { id: 'icons', title: 'Icons', note: 'Hand — 315 drawn here, under contract' }
  ];
</script>

<svelte:head><title>Livery tile — preview</title></svelte:head>

<div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-10">
  <header>
    <h1 class="text-lg font-semibold text-text-primary">Livery tile — preview harness</h1>
    <p class="mt-1 max-w-2xl text-sm text-text-secondary">
      This page is plain library chrome on purpose. If the tile's house leaks past its own box,
      these words and the borders below change with it — that is the test. Scroll down to make the
      tile mount.
    </p>
  </header>

  <!-- Deliberately tall, so the row starts below the fold and the visibility
       gate has something to do. -->
  <div
    class="flex h-[70vh] items-center justify-center rounded-contain border border-dashed border-border-default text-sm text-text-tertiary"
  >
    (spacer — the row is below)
  </div>

  <section class="flex flex-col gap-3">
    <h2 class="text-sm font-medium text-text-primary">In a Scroller, beside stand-ins</h2>
    <Scroller label="Exhibits" itemBasis="26rem">
      <div class="h-[30rem]">
        <LiveryTile />
      </div>
      {#each STANDINS as tile (tile.id)}
        <div
          class="flex h-[30rem] flex-col justify-end rounded-contain border border-border-default bg-surface-subtle p-5"
        >
          <span class="text-base font-medium text-text-primary">{tile.title}</span>
          <span class="mt-1 text-xs text-text-tertiary">{tile.note}</span>
        </div>
      {/each}
    </Scroller>
  </section>

  <section class="flex flex-col gap-3">
    <h2 class="text-sm font-medium text-text-primary">Alone, at tile size</h2>
    <div class="h-[30rem] max-w-[26rem]">
      <LiveryTile initial="lacquer" eager />
    </div>
  </section>

  <p class="pb-16 text-xs text-text-tertiary">
    Chrome above and below is unstyled library default. Both tiles carry their own house.
  </p>
</div>
