/**
 * `{#each}` keys for a list whose identities nothing makes unique — a consumer's
 * ids or labels. Two equal keys make Svelte throw `each_key_duplicate`, and the
 * component does not render.
 *
 * An item keys by its identity and the number of items before it that share
 * it: `${count}:${identity}`. The count holds no colon, so the first colon
 * splits a key back into the pair, and no two items share the pair. An item
 * whose identity is unique keeps its key wherever it moves, so its DOM moves
 * with it. The caller keeps identities of different kinds apart (`id:` /
 * `label:`), or an id that spells another item's label shares its count.
 */
export function eachKeys<T>(
  items: readonly T[],
  identity: (item: T, index: number) => string
): string[] {
  const seen = new Map<string, number>();
  return items.map((item, index) => {
    const id = identity(item, index);
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    return `${count}:${id}`;
  });
}
