<script lang="ts">
  import type { Snippet } from 'svelte';
  import { mintAttachment } from '$lib';
  import { resolveIcon } from '$lib/icons';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import { getMenuContext, getMenuParentId } from './menu.context';
  import { menuIconVariants } from './menu.variants';

  const CheckIcon = resolveIcon('check', CheckIconDefault);

  let {
    id: idProp,
    label,
    disabled = false,
    icon,
    checked,
    detail,
    onSelect,
    keepOpen = false,
    children,
    class: className = ''
  }: {
    /** Stable id for sub-menu bookkeeping. Auto-generated when omitted. */
    id?: string;
    /** Display label. Falls back to the slot's text content. */
    label?: string;
    /** @default false */
    disabled?: boolean;
    /** Optional leading icon component. */
    icon?: unknown;
    /**
     * Marks the item as a selectable setting: `true` / `false` renders
     * `role="menuitemradio"` with `aria-checked` and a checkmark indicator
     * (empty gutter when unchecked); `undefined` keeps the plain
     * `role="menuitem"`. The state is consumer-owned — Menu only displays it.
     */
    checked?: boolean;
    /** Right-aligned secondary text on the row (current value, shortcut hint). */
    detail?: string;
    /** Invoked when the item is activated (click / Enter / Space). */
    onSelect?: () => void;
    /**
     * Keep the menu open after activation. Useful for repeated actions like
     * "Add tag" where the user picks several entries in a row.
     * @default false
     */
    keepOpen?: boolean;
    children?: Snippet;
    class?: string;
  } = $props();

  const ctx = getMenuContext();
  const parentId = getMenuParentId();

  if (!ctx) {
    throw new Error('MenuItem must be used inside Menu');
  }

  const propsId = $props.id();
  const itemId = $derived(idProp ?? `item-${propsId}`);

  let labelSpanRef = $state<HTMLSpanElement>();
  let buttonRef = $state<HTMLButtonElement>();

  $effect(() => {
    const textLabel = labelSpanRef?.textContent?.trim();
    const effectiveLabel = label ?? textLabel ?? itemId;
    ctx.registerItem({
      id: itemId,
      label: effectiveLabel,
      disabled,
      parentId: parentId ?? null
    });
    return () => ctx.unregisterItem(itemId);
  });

  /**
   * Activate the item: fire the consumer's `onSelect` exactly once and then
   * let the Menu close (or keep open) via `ctx.onItemActivated`. This is the
   * single dispatch path — the wrapping Menu does *not* fire `onSelect`
   * separately, so a consumer's `onSelect` always runs exactly once per
   * activation regardless of whether the item came from `items[]` or from
   * a declarative `<MenuItem>`.
   */
  function activate(e?: MouseEvent | KeyboardEvent) {
    if (disabled) return;
    e?.stopPropagation();
    onSelect?.();
    ctx.onItemActivated(keepOpen);
  }

  function onKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        activate(e);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (buttonRef) ctx.focusNextItem(buttonRef);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (buttonRef) ctx.focusPrevItem(buttonRef);
        break;
    }
  }

  const itemSizeVariant = $derived<'sm' | 'md' | 'lg'>(ctx.itemSizeForDepth(parentId ? 1 : 0));
</script>

<button
  bind:this={buttonRef}
  id={`${ctx.rootId}-item-${itemId}`}
  type="button"
  {disabled}
  onclick={activate}
  onkeydown={onKeydown}
  role={checked === undefined ? 'menuitem' : 'menuitemradio'}
  tabindex={-1}
  aria-checked={checked === undefined ? undefined : checked}
  data-state={checked === undefined ? undefined : checked ? 'checked' : 'unchecked'}
  aria-disabled={disabled || undefined}
  class={ctx.unstyled
    ? [ctx.slotClasses?.item, className].filter(Boolean).join(' ')
    : ctx.styles.item({
        itemSize: itemSizeVariant,
        disabled,
        class: [ctx.slotClasses?.item, className]
      })}
  {@attach mintAttachment(ctx.mint, { enabled: !disabled })}
>
  {#if checked !== undefined}
    <!-- The check gutter renders for every selectable item — `invisible` when
         unchecked — so checked and unchecked rows in one group stay aligned. -->
    <span
      aria-hidden="true"
      class={ctx.unstyled
        ? (ctx.slotClasses?.indicator ?? '')
        : ctx.styles.indicator({ class: ctx.slotClasses?.indicator })}
    >
      <CheckIcon
        class={menuIconVariants({ type: 'checkmark', class: checked ? undefined : 'invisible' })}
      />
    </span>
  {/if}
  {#if icon}
    {@const Icon = icon as import('svelte').Component<{ class?: string }>}
    <span
      class={ctx.unstyled
        ? (ctx.slotClasses?.indicator ?? '')
        : ctx.styles.indicator({ class: ctx.slotClasses?.indicator })}
    >
      <Icon class="h-4 w-4" />
    </span>
  {/if}
  <span bind:this={labelSpanRef} class="flex-1 truncate text-left">
    {#if children}
      {@render children()}
    {:else if label != null}
      {label}
    {/if}
  </span>
  {#if detail}
    <span
      class={ctx.unstyled
        ? (ctx.slotClasses?.detail ?? '')
        : ctx.styles.detail({ class: ctx.slotClasses?.detail })}
    >
      {detail}
    </span>
  {/if}
</button>
