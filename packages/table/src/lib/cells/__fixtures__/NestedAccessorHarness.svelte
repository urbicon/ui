<script lang="ts">
  import type { TableItem } from '$lib/types/tableTypes';
  import DateCell from '../DateCell.svelte';
  import LinkCell from '../LinkCell.svelte';
  import NumberCell from '../NumberCell.svelte';
  import StatusBadge from '../StatusBadge.svelte';
  import UserAvatar from '../UserAvatar.svelte';

  /**
   * Renders the factory cells with dotted accessors against one nested item,
   * or the flat-key / missing-path controls. Exists for the same reason as
   * `LocaleHarness`: the cells are generic in `Item`, and instantiating that
   * generic takes a component context — `render()` on the cell directly makes
   * TypeScript infer `Item` from every prop at once, where a dotted key and
   * `keyof Item` cannot agree.
   */
  let { variant = 'nested' }: { variant?: 'nested' | 'controls' } = $props();

  const item: TableItem = {
    user: { status: 'active', name: 'Ada Lovelace', email: 'ada@example.com' },
    stats: { amount: 1234.56 },
    meta: { created: '2026-03-12' },
    links: { url: 'https://example.com/docs', label: 'Docs' }
  };
  const flatItem: TableItem = { status: 'active' };
</script>

{#if variant === 'nested'}
  <StatusBadge {item} statusKey="user.status" />
  <NumberCell {item} valueKey="stats.amount" />
  <DateCell {item} dateKey="meta.created" />
  <LinkCell {item} urlKey="links.url" textKey="links.label" />
  <UserAvatar {item} nameKey="user.name" />
{:else}
  <StatusBadge item={flatItem} statusKey="status" />
  <DateCell {item} dateKey="meta.missing" />
{/if}
