<script lang="ts">
  import { mintRegistry } from '$lib';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import CoreIconButton from '$lib/internal/core/CoreIconButton.svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import { useBlocksI18n } from '$lib';

  const CloseIcon = resolveIcon('close', CloseIconDefault);
  import { badgeVariants, type BadgeVariants } from '$lib/primitives';
  import { getTierContext } from '$lib/utils/tier-context';
  import type { BadgeProps } from './index';

  const bt = useBlocksI18n();

  let {
    tier,
    intent: intentProp,
    purpose,
    variant = 'filled',
    size = 'md',
    counter = false,
    pulse = false,
    removable = false,
    interactive = false,
    disabled = false,
    mint = 'none',
    placement,
    border = false,
    children,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    onRemove,
    onclick,
    onHover,
    role,
    ...restProps
  }: BadgeProps = $props();

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let badgeElement = $state<HTMLElement>();

  // `purpose` is the canonical semantic axis; it orchestrates the low-level
  // visual props so the tv() config stays as-is. When set it wins over the
  // deprecated `variant="dot"` / `counter` boolean; when unset those apply
  // directly (back-compat).
  //
  // `tag` is the one purpose that also picks the intent, because its whole
  // meaning is "this label carries no severity": a category, a version, a type.
  // Until 2026-08-02 it inherited the `primary` default and rendered a
  // brand-coloured pill — the documented contract ("a neutral inline label")
  // and the behaviour disagreed, and the measured failure it invites is exactly
  // categories painted as statuses. An explicit `intent` still wins, so a
  // consumer who deliberately tints a tag keeps their colour.
  const intent = $derived(intentProp ?? (purpose === 'tag' ? 'neutral' : 'primary'));
  const effVariant = $derived(purpose === 'dot' ? 'dot' : variant);
  const effCounter = $derived(purpose === 'counter' || counter);
  const isDot = $derived(effVariant === 'dot');
  const isInteractive = $derived(purpose === 'chip' || interactive || !!onclick);
  const isRemovable = $derived(removable && !isDot);

  // An interactive badge (clickable chip / onclick) carries button semantics:
  // it is focusable and Enter/Space-activatable, so screen readers must hear a
  // button, not a `status` region. An explicit `role` always wins; a disabled
  // badge is inert (pointer-events-none, guarded handlers) so it stays `status`.
  const effRole = $derived(role ?? (isInteractive && !disabled ? 'button' : 'status'));

  const variantProps: BadgeVariants = $derived({
    tier: effectiveTier,
    intent,
    variant: effVariant,
    size,
    counter: effCounter || undefined,
    pulse: pulse || undefined,
    removable: isRemovable || undefined,
    interactive: isInteractive || undefined,
    disabled: disabled || undefined,
    placement,
    border: border || undefined
  });

  const styles = $derived(badgeVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Badge', preset, variantProps, slotClassesProp)
  );

  $effect(() => {
    if (badgeElement && mint && mint !== 'none' && isInteractive && !disabled) {
      return mintRegistry.apply(badgeElement, mint);
    }
  });

  function handleMouseEnter() {
    onHover?.(true);
  }

  function handleMouseLeave() {
    onHover?.(false);
  }

  function handleClick(event: MouseEvent) {
    if (disabled) return;
    onclick?.(event);
  }

  function handleRemove(event: Event) {
    event.stopPropagation();
    onRemove?.();
  }

  function handleKeydown(event: KeyboardEvent) {
    // Mirror the pointer path: `disabled` sets pointer-events-none (mouse dead) and
    // handleClick guards — without this guard the keyboard could still activate
    // or remove a disabled badge.
    if (disabled) return;
    if (isRemovable && (event.key === 'Delete' || event.key === 'Backspace')) {
      handleRemove(event);
    }
    if (onclick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onclick?.(event as unknown as MouseEvent);
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span
  bind:this={badgeElement}
  class={[
    `blocks-intent-${intent}`,
    unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })
  ]}
  role={effRole}
  data-purpose={purpose}
  tabindex={isInteractive && !disabled ? 0 : undefined}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onclick={handleClick}
  onkeydown={handleKeydown}
  aria-label={isRemovable ? bt('accessibility.removableBadge') : undefined}
  aria-disabled={disabled}
  {...restProps}
>
  {#if !isDot}
    <span
      class={unstyled
        ? (slotClasses?.content ?? '')
        : styles.content({ class: slotClasses?.content })}
    >
      {@render children?.()}
    </span>
  {/if}

  {#if isRemovable}
    <CoreIconButton
      {disabled}
      class={unstyled
        ? (slotClasses?.removeButton ?? '')
        : styles.removeButton({ class: slotClasses?.removeButton })}
      onclick={handleRemove}
      aria-label={bt('accessibility.removeBadge')}
    >
      <CloseIcon
        class={unstyled
          ? (slotClasses?.removeIcon ?? '')
          : styles.removeIcon({ class: slotClasses?.removeIcon })}
      />
    </CoreIconButton>
  {/if}
</span>

<style>
  /* `.blocks-mint-*` rules live in `packages/blocks/src/lib/mint/styles.css`
     — see XC-12. The local glow override used `currentColor`, which gave
     the wrong color in the badge's filled variants (white text → white
     glow → invisible). The global token cascades via `blocks-intent-*`. */

  /* `badge-pulse` keyframes live in blocks/style/index.css so the Tailwind
     arbitrary-animation utility on the badge (outside this component's
     Svelte scope) can resolve them. */
</style>
