import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { AvatarSlots, AvatarVariants } from './avatar.variants';

/**
 * @description User profile image component with fallback initials, multiple sizes, and interactive states.
 *
 * @tag display
 * @related Badge
 *
 * @example
 * ```svelte
 * <Avatar src="/user-photo.jpg" name="John Doe" size="lg" />
 * ```
 *
 * @example
 * ```svelte
 * <Avatar name="Jane Smith" randomColor clickable onclick={() => showProfile()} />
 * ```
 */
export interface AvatarProps
  extends AvatarVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Image URL. Falls back to initials or `children` when empty or on load error. */
  src?: string;
  /** Alt text for the image. Defaults to `name`. */
  alt?: string;
  /** Full user name — used for initials generation, `randomColor` hashing, and `aria-label`. */
  name?: string;
  /** Custom fallback content rendered instead of auto-generated initials. Useful for overflow counters, icons, or fully custom avatars with `unstyled`. */
  children?: Snippet;

  /** Custom ring color (CSS value). Overrides `ringIntent` when set. */
  ringColor?: string;
  /** Derive a deterministic background color from `name`. The same name always produces the same color, making it easy to visually distinguish users without images. Overrides `intent`. */
  randomColor?: boolean;

  /** Mark the avatar as clickable (adds hover/focus styles and keyboard support). Alias for the `interactive` variant. */
  clickable?: boolean;
  /** Click handler. Automatically enables interactive styles. */
  onclick?: (event: MouseEvent) => void;

  /** Micro-interaction preset. Only applies when the avatar is interactive. */
  mint?: MintProp;

  /** Called when the hover state changes. */
  onHover?: (hovered: boolean) => void;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides merged with tv styles. Slots: base | image | fallback | status */
  slotClasses?: Partial<Record<AvatarSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Avatar: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Avatar } from './Avatar.svelte';
export { type AvatarVariants, avatarVariants } from './avatar.variants';
