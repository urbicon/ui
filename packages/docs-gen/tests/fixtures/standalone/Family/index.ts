import type { Snippet } from 'svelte';

/**
 * @description Primary component of the family — named after the directory.
 * @tag display
 * @stability stable
 */
export interface FamilyProps {
  /** Content. */
  children?: Snippet;
}

/**
 * @description An independent surface that opts into its own catalog entry.
 * @tag overlay
 * @related Family
 * @stability beta
 * @standalone
 */
export interface FamilyPanelProps {
  /** Panel title. */
  title?: string;
}

/**
 * @description A compound subcomponent — same metadata shape, but NOT standalone.
 * @tag display
 */
export interface FamilyItemProps {
  /** Item label. */
  label: string;
}

/**
 * @description Tagged standalone but never exported as a component — must be skipped.
 * @tag display
 * @standalone
 */
export interface OrphanProps {
  /** Unused. */
  value?: string;
}

interface FamilyToggleOnProps {
  /** Discriminator. */
  state: 'on';
}

interface FamilyToggleOffProps {
  /** Discriminator. */
  state: 'off';
}

/**
 * @description A standalone surface whose Props is a type-alias union
 * (the Tab/Badge discriminated-union pattern).
 * @tag form
 * @standalone
 */
export type FamilyToggleProps = FamilyToggleOnProps | FamilyToggleOffProps;

export { default as Family } from './Family.svelte';
export { default as FamilyItem } from './FamilyItem.svelte';
export { default as FamilyPanel } from './FamilyPanel.svelte';
export { default as FamilyToggle } from './FamilyToggle.svelte';
