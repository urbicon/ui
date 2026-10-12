<script lang="ts">
  // E2E fixture for e2e/scroller-centre.spec.ts: two centred rows whose every item must reach the
  // middle. One has a length basis, padded in CSS alone; the other holds content-sized chips
  // (`itemBasis="auto"`), padded from the measured first and last chip. Those two chips differ in
  // width on purpose, so no single shared half-item could centre both ends.
  import { Badge, Scroller } from '@urbicon-ui/blocks';

  const cards = ['Sync', 'Audit', 'Reports', 'Access', 'API'];
  const chips = [
    'All',
    'Recently changed',
    'Draft',
    'Shared with me',
    'Needs review',
    'Waiting on a client reply'
  ];
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
</div>
