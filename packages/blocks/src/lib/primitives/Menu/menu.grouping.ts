import { eachKeys } from '#lib/internal/each-keys.js';
import type { MenuDividerItem, MenuItemType, MenuSectionHeader } from './index';

/**
 * One rendered entry of a section group.
 *
 * `index` is the entry's position in the ORIGINAL flat `items` array, not in
 * the group — the key of a rule or of a row without an id derives from it, so
 * grouping must not renumber it.
 */
export type MenuGroupEntry<TItem> = {
  item: TItem;
  index: number;
  /** A rule, per the `isDivider` predicate — renders a separator, never a row. */
  divider: boolean;
  /**
   * `{#each}` key, distinct across the whole `items` array however the ids
   * repeat. A row with an id keys by it, so its DOM moves with the item; a
   * rule or a row without one keys by `index`.
   */
  key: string;
};

/** A section header plus the items it owns; `section: null` for a bare run. */
export type MenuSectionGroup<TItem> = {
  section: MenuSectionHeader | null;
  /**
   * `{#each}` key, derived from the group's own first position. A run of
   * bare items can occur more than once (a rule between two sections opens
   * one), so a constant key for the bare case would collide.
   */
  key: string;
  entries: MenuGroupEntry<TItem>[];
};

/**
 * The structural divider shape, used when the consumer supplies no `isDivider`
 * mapper. Consulted only through that mapper's fallback: a consumer whose own
 * item type happens to carry `type: 'divider'` must be able to say so, or
 * their row would silently become a rule.
 */
export function isMenuDividerItem(item: MenuItemType): item is MenuDividerItem {
  return typeof item === 'object' && item !== null && (item as MenuDividerItem).type === 'divider';
}

/**
 * Segment a flat `items` array into section groups.
 *
 * Shared by Menu's top level and MenuSubmenu's child pipeline so the two
 * cannot disagree about what belongs to a section: before this, the submenu
 * rendered section headers flat and grouped nothing, which made the same
 * `{ type: 'section' }` entry produce a different accessibility tree
 * depending on how deep it sat.
 *
 * Both predicates and the id come from the caller — never read off the item
 * here — so every classification runs through the consumer's `isSection` /
 * `isDivider` / `getItemId` mappers, exactly like every other field.
 *
 * A rule stays where the consumer wrote it, inside the section it falls in.
 * The one exception is a rule that sits directly before the next header: it
 * separates the two sections rather than belonging to the closing one, so it
 * moves out of the group and renders between them.
 */
export function groupMenuItems<TItem extends MenuItemType>(
  items: readonly TItem[],
  isSection: (item: MenuItemType) => boolean,
  isDivider: (item: MenuItemType) => boolean,
  resolveId: (item: TItem) => string | undefined
): MenuSectionGroup<TItem>[] {
  const groups: MenuSectionGroup<TItem>[] = [];
  let current: MenuSectionGroup<TItem> | null = null;
  const keys = eachKeys(items, (item, index) => {
    const id = isSection(item) || isDivider(item) ? undefined : resolveId(item);
    return id == null ? `index:${index}` : `id:${id}`;
  });

  function openBare(firstIndex: number): MenuSectionGroup<TItem> {
    const group: MenuSectionGroup<TItem> = {
      section: null,
      key: `bare-${firstIndex}`,
      entries: []
    };
    groups.push(group);
    return group;
  }

  for (let index = 0; index < items.length; index++) {
    const raw = items[index];

    if (isSection(raw)) {
      // Trailing rules belong between the sections, not under the closing
      // section's name — they move into a bare run ahead of the new header.
      if (current?.section) {
        const trailing: MenuGroupEntry<TItem>[] = [];
        while (current.entries.at(-1)?.divider) {
          trailing.unshift(current.entries.pop() as MenuGroupEntry<TItem>);
        }
        if (trailing.length > 0) openBare(trailing[0].index).entries.push(...trailing);
      }
      current = { section: raw as MenuSectionHeader, key: `section-${index}`, entries: [] };
      groups.push(current);
      continue;
    }

    if (!current) current = openBare(index);
    current.entries.push({ item: raw, index, divider: isDivider(raw), key: keys[index] });
  }

  return groups;
}
