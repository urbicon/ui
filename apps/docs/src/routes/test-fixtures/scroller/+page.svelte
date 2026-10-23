<script lang="ts">
  // E2E fixture for e2e/scroller-centre.spec.ts: centred rows whose every item must reach the
  // middle. One has a length basis, padded in CSS alone; the others hold content-sized items,
  // spaced from the measured first and last item. Those two items differ in width on purpose, so no
  // single shared half-item could centre both ends.
  //
  // - `centre-var` / `centre-var-length`: the basis is a `var()`, resolving to `auto` and to a
  //   length. The parser accepts any `var()`, only the computed value says which it is.
  // - `centre-responsive`: a `var()` basis that is a length from 700px up and `auto` below, so a
  //   resize alone changes which edge spacing the row needs.
  // - `centre-images` / `centre-percent`: items whose width resolves against the row — an image
  //   capped by `max-width: 100%`, a `%` width. Spacing that narrows the row's content box squeezes
  //   them.
  // - `consumer-mount` / `consumer-append`: a consumer moving the row itself, once in `onMount` and
  //   once with a smooth scroll followed by a trailing chip in the same task. The row must keep
  //   the position it was given. `consumer-mount`'s items have fixed widths: a webfont arriving
  //   after that scroll would move content-sized items under it, and no edge spacing can undo
  //   that.
  import { Badge, Scroller } from '@urbicon-ui/blocks';
  import { onMount } from 'svelte';

  const cards = ['Sync', 'Audit', 'Reports', 'Access', 'API'];
  const chips = [
    'All',
    'Recently changed',
    'Draft',
    'Shared with me',
    'Needs review',
    'Waiting on a client reply'
  ];
  const panels = ['North', 'East', 'South', 'West', 'Centre'];
  const modules = ['Sync', 'Audit', 'Reports', 'Access', 'API', 'Billing', 'Teams', 'Logs'];
  // Chip-sized, in px: nothing in them depends on a font. First and last differ, as above.
  const boxWidths = [72, 160, 96, 128, 112, 200];

  // Natural widths at the 128px height the row renders them at, so `h-32 w-auto` keeps each one at
  // exactly this width as long as nothing caps it. The widest stays under 576px / 2.2, the DEV
  // guard's threshold for a centred row.
  const photoWidths = [120, 250, 160, 230, 140, 200];
  const photo = (width: number) =>
    `data:image/svg+xml,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="128"><rect width="100%" height="100%" fill="#7a9aa8"/></svg>`
    )}`;

  const fourthItem = '[data-align] > div > :nth-child(4)';

  let mountRow = $state<HTMLElement>();
  onMount(() => {
    mountRow?.querySelector(fourthItem)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  });

  let appendRow = $state<HTMLElement>();
  const appendChips = $state([...chips]);
  function selectFourthAndAppend() {
    appendRow
      ?.querySelector(fourthItem)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    appendChips.push('Clear filters');
  }
</script>

<svelte:head>
  <title>Scroller Test Fixtures</title>
</svelte:head>

<div data-testid="scroller-fixtures" class="bg-surface-base flex flex-col gap-10 p-10">
  <div data-testid="centre-basis" class="max-w-xl min-w-0">
    <Scroller label="Cards" itemBasis="15rem" align="center" indicator="dots">
      {#each cards as card (card)}
        <article class="border-border-subtle bg-surface-elevated rounded-contain border p-6">
          {card}
        </article>
      {/each}
    </Scroller>
  </div>

  <div data-testid="centre-auto" class="max-w-xl min-w-0">
    <Scroller label="Filters" itemBasis="auto" align="center" gap="sm" indicator="dots">
      {#each chips as chip (chip)}
        <Badge variant="outlined">{chip}</Badge>
      {/each}
    </Scroller>
  </div>

  <div data-testid="centre-var" class="max-w-xl min-w-0" style="--fixture-chip-basis: auto">
    <Scroller
      label="Filters by variable"
      itemBasis="var(--fixture-chip-basis)"
      align="center"
      gap="sm"
      indicator="dots"
    >
      {#each chips as chip (chip)}
        <Badge variant="outlined">{chip}</Badge>
      {/each}
    </Scroller>
  </div>

  <div data-testid="centre-var-length" class="max-w-xl min-w-0" style="--fixture-card-basis: 15rem">
    <Scroller
      label="Cards by variable"
      itemBasis="var(--fixture-card-basis)"
      align="center"
      indicator="dots"
    >
      {#each cards as card (card)}
        <article class="border-border-subtle bg-surface-elevated rounded-contain border p-6">
          {card}
        </article>
      {/each}
    </Scroller>
  </div>

  <div
    data-testid="centre-responsive"
    class="max-w-xl min-w-0 [--fixture-module-basis:auto] min-[700px]:[--fixture-module-basis:8rem]"
  >
    <Scroller
      label="Modules"
      itemBasis="var(--fixture-module-basis)"
      align="center"
      gap="sm"
      indicator="dots"
    >
      {#each modules as module (module)}
        <article class="border-border-subtle bg-surface-elevated rounded-contain border p-6">
          {module}
        </article>
      {/each}
    </Scroller>
  </div>

  <div data-testid="centre-images" class="max-w-xl min-w-0">
    <Scroller label="Photos" itemBasis="auto" align="center" gap="sm" indicator="dots">
      {#each photoWidths as width, index (width)}
        <img src={photo(width)} alt="Sample {index + 1}" class="h-32 w-auto" />
      {/each}
    </Scroller>
  </div>

  <div data-testid="centre-percent" class="max-w-xl min-w-0">
    <Scroller label="Panels" itemBasis="auto" align="center" indicator="dots">
      {#each panels as panel (panel)}
        <div class="border-border-subtle bg-surface-elevated rounded-contain w-[40%] border p-4">
          {panel}
        </div>
      {/each}
    </Scroller>
  </div>

  <div data-testid="consumer-mount" class="max-w-xl min-w-0" bind:this={mountRow}>
    <Scroller
      label="Filters set on mount"
      itemBasis="auto"
      align="center"
      gap="sm"
      indicator="dots"
    >
      {#each boxWidths as width (width)}
        <span
          class="border-border-default bg-surface-elevated h-7 rounded-full border"
          style:width="{width}px"
        ></span>
      {/each}
    </Scroller>
  </div>

  <div data-testid="consumer-append" class="max-w-xl min-w-0" bind:this={appendRow}>
    <Scroller label="Filters that grow" itemBasis="auto" align="center" gap="sm" indicator="dots">
      {#each appendChips as chip (chip)}
        <Badge variant="outlined">{chip}</Badge>
      {/each}
    </Scroller>
    <button type="button" onclick={selectFourthAndAppend}>Select the fourth, add one</button>
  </div>
</div>
