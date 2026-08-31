import type { MenuDividerItem, MenuItemType, MenuSectionHeader } from './index';

/**
 * One rendered entry of a section group.
 *
 * `index` is the entry's position in the ORIGINAL flat `items` array, not in
 * the group — the id and `{#each}` key fallbacks derive from it, so grouping
 * must not renumber them.
 */
export type MenuGroupEntry<TItem> = {
  item: TItem;
  index: number;
  /** `{ type: 'divider' }` — renders a rule, never a row. */
  divider: boolean;
};

/** A section header plus the items it owns; `section: null` for the leading bare run. */
export type MenuSectionGroup<TItem> = {
  section: MenuSectionHeader | null;
  /** Position of the header in the original array — the `{#each}` key. */
  sectionIndex: number;
  entries: MenuGroupEntry<TItem>[];
};

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
 * A divider stays where the consumer wrote it — inside the section it falls
 * in, not as a group boundary of its own.
 */
export function groupMenuItems<TItem extends MenuItemType>(
  items: readonly TItem[],
  isSection: (item: MenuItemType) => boolean
): MenuSectionGroup<TItem>[] {
  const groups: MenuSectionGroup<TItem>[] = [];
  let current: MenuSectionGroup<TItem> | null = null;

  for (let index = 0; index < items.length; index++) {
    const raw = items[index];
    if (isSection(raw)) {
      current = { section: raw as MenuSectionHeader, sectionIndex: index, entries: [] };
      groups.push(current);
      continue;
    }
    if (!current) {
      current = { section: null, sectionIndex: -1, entries: [] };
      groups.push(current);
    }
    current.entries.push({ item: raw, index, divider: isMenuDividerItem(raw) });
  }

  return groups;
}

/** Stable `{#each}` key for one entry — dividers carry no id of their own. */
export function menuEntryKey<TItem extends MenuItemType>(
  entry: MenuGroupEntry<TItem>,
  resolveId: (item: TItem, fallbackIndex: number) => string
): string {
  return entry.divider ? `divider-${entry.index}` : resolveId(entry.item, entry.index);
}
