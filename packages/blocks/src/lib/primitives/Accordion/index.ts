import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { AccordionSlots, AccordionVariants } from './accordion.variants';

/** Context for Accordion ↔ AccordionItem communication */
export interface AccordionContext {
  toggle: (value: string) => void;
  isOpen: (value: string) => boolean;
  variant: AccordionVariants['variant'];
  size: AccordionVariants['size'];
  disabled: boolean;
}

/**
 * Props interface for Accordion component
 *
 * @summary Stacked sections that expand one at a time, or several at once.
 * @description Collapsible content sections with expand/collapse animation.
 * Supports single or multiple open items, keyboard navigation, and ARIA accordion pattern.
 *
 * @tag layout
 * @related Collapsible
 * @related Card
 *
 * @example
 * ```svelte
 * <Accordion>
 *   <AccordionItem value="faq-1" title="What is Urbicon UI?">
 *     A Svelte 5 component library with built-in i18n and design tokens.
 *   </AccordionItem>
 *   <AccordionItem value="faq-2" title="How does dark mode work?">
 *     Semantic tokens automatically handle light/dark via the CSS light-dark() function.
 *   </AccordionItem>
 * </Accordion>
 * ```
 *
 * @example
 * ```svelte
 * <Accordion type="multiple" variant="card" bind:value={openItems}>
 *   <AccordionItem value="section-1" title="Section 1">Content</AccordionItem>
 *   <AccordionItem value="section-2" title="Section 2">Content</AccordionItem>
 * </Accordion>
 * ```
 */
export interface AccordionProps
  extends AccordionVariants,
    Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Allow single or multiple items open at once @default 'single' */
  type?: 'single' | 'multiple';
  /** Visual style @default 'default' */
  variant?: 'default' | 'card' | 'ghost';
  /** Size @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Controlled open item(s) – string for single, string[] for multiple */
  value?: string | string[];
  /** Default open item(s) */
  defaultValue?: string | string[];
  /** Callback when open items change */
  onValueChange?: (value: string | string[]) => void;
  /** Disable all items @default false */
  disabled?: boolean;
  /** Whether items can be fully collapsed @default true */
  collapsible?: boolean;
  /**
   * Override every item's expand/collapse animation duration in milliseconds. Defaults to the
   * `--blocks-collapse-duration` token (the `normal` 250ms). Respects `prefers-reduced-motion`.
   */
  transitionDuration?: number;
  /**
   * Override every item's expand/collapse easing as a CSS `<easing-function>` — e.g.
   * `'ease-in-out'`, `'cubic-bezier(0.4,0,0.2,1)'`, or a token like `'var(--blocks-ease-springy)'`.
   * Defaults to the `--blocks-collapse-easing` token. (A CSS string, not the `(t) => number`
   * easing function the overlay components take — Accordion animates via CSS.)
   */
  transitionEasing?: string;
  /** Accordion items */
  children: Snippet;
  /** Custom CSS class */
  class?: string;
  /** Remove default styles */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | item | trigger | chevron | content | contentInner */
  slotClasses?: Partial<Record<AccordionSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Accordion: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

/**
 * Props interface for AccordionItem component
 *
 * @description Single collapsible section within an Accordion.
 *
 * @description Single expandable section inside an Accordion.
 * Provides the trigger label and the expanded content.
 *
 * @tag layout
 * @related Accordion
 *
 * @example
 * ```svelte
 * <AccordionItem value="item-1" title="Click to expand">
 *   Expanded content here.
 * </AccordionItem>
 * ```
 */
export interface AccordionItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
  /** Unique identifier for this item */
  value: string;
  /** Trigger label text (required unless a custom trigger snippet is provided) */
  title?: string;
  /** Custom trigger snippet (replaces default title) */
  trigger?: Snippet<[{ open: boolean }]>;
  /** Expanded content */
  children: Snippet;
  /** Disable this item @default false */
  disabled?: boolean;
  /** Custom CSS class */
  class?: string;
  /** Remove default styles */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: item | trigger | chevron | content | contentInner */
  slotClasses?: Partial<Record<Exclude<AccordionSlots, 'base'>, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ AccordionItem: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Accordion } from './Accordion.svelte';
export { default as AccordionItem } from './AccordionItem.svelte';
export { type AccordionVariants, accordionVariants } from './accordion.variants';
