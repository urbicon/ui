<script lang="ts">
  import { mintRegistry } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { avatarVariants, type AvatarVariants } from '$lib/primitives';
  import { useBlocksI18n } from '$lib';
  import type { AvatarProps } from './index';

  const bt = useBlocksI18n();

  let {
    src,
    alt,
    name,
    children,
    size = 'md',
    variant = 'circle',
    intent = 'neutral',
    status,
    statusPosition = 'bottom-right',
    pulse = false,
    ring = false,
    ringIntent = 'primary',
    ringColor,
    randomColor = false,
    interactive = false,
    clickable = false,
    mint = 'none',
    onclick,
    onHover,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: AvatarProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let avatarElement = $state<HTMLElement>();
  let imageError = $state(false);

  const isInteractive = $derived(clickable || interactive || !!onclick);

  function getRandomColor(name?: string): string {
    if (!name) return '#4b5563'; // gray-600

    // Tailwind *-700 shades — dark enough that white text hits WCAG AA 4.5:1
    // on every hue. Lighter shades (*-500) used before produced ~3:1 contrast.
    const colors = [
      '#b91c1c', // red-700
      '#c2410c', // orange-700
      '#b45309', // amber-700
      '#a16207', // yellow-700
      '#4d7c0f', // lime-700
      '#15803d', // green-700
      '#047857', // emerald-700
      '#0e7490', // cyan-700
      '#0369a1', // sky-700
      '#1d4ed8', // blue-700
      '#4338ca', // indigo-700
      '#6d28d9', // violet-700
      '#7e22ce', // purple-700
      '#a21caf', // fuchsia-700
      '#be185d' // pink-700
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }

  function getInitials(name?: string): string {
    if (!name) return '?';
    return name
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  const randomBg = $derived(randomColor ? getRandomColor(name) : undefined);

  const variantProps: AvatarVariants = $derived({
    size,
    variant,
    intent: randomColor ? undefined : intent,
    status,
    statusPosition,
    pulse,
    ring,
    ringIntent: ringColor ? undefined : ringIntent,
    interactive: isInteractive
  });

  const styles = $derived(avatarVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Avatar', preset, variantProps, slotClassesProp)
  );

  // `randomColor` paints the visible fill, so it targets the `frame` slot.
  // Inline property names stay kebab-case — a previous camelCase
  // `backgroundColor` was silently ignored by browsers, dropping the avatar back
  // to surface-interactive + white text.
  const frameStyle = $derived(
    randomColor && randomBg ? `background-color: ${randomBg}; color: white` : undefined
  );

  // `ringColor` recolours the ring on the outer `base`. The ring is a
  // Tailwind `ring-2` box-shadow, so it reads `--tw-ring-color` — setting
  // `border-color` (the previous approach) was a no-op, as the avatar has no
  // border. Only meaningful together with `ring`.
  const baseStyle = $derived(ringColor ? `--tw-ring-color: ${ringColor}` : undefined);

  $effect(() => {
    if (avatarElement && mint && mint !== 'none' && isInteractive) {
      return mintRegistry.apply(avatarElement, mint);
    }
  });

  function handleMouseEnter() {
    onHover?.(true);
  }

  function handleMouseLeave() {
    onHover?.(false);
  }

  function handleClick(event: MouseEvent) {
    if (onclick) {
      onclick(event);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onclick?.(event as unknown as MouseEvent);
    }
  }

  function handleImageError() {
    imageError = true;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={avatarElement}
  class={[
    'blocks-avatar',
    `blocks-intent-${intent}`,
    unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })
  ]}
  style={baseStyle}
  role={isInteractive ? 'button' : undefined}
  tabindex={isInteractive ? 0 : undefined}
  aria-label={isInteractive ? alt || name || bt('accessibility.avatar') : undefined}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
  onclick={handleClick}
  onkeydown={handleKeydown}
  {...restProps}
>
  <!-- `frame` clips the image/initials to the avatar shape; the status dot
       below is a sibling so it renders outside the clip and stays whole. -->
  <div
    class={unstyled ? (slotClasses?.frame ?? '') : styles.frame({ class: slotClasses?.frame })}
    style={frameStyle}
  >
    {#if src && !imageError}
      <img
        {src}
        alt={alt || name || bt('accessibility.avatar')}
        class={unstyled ? (slotClasses?.image ?? '') : styles.image({ class: slotClasses?.image })}
        onerror={handleImageError}
      />
    {:else if children}
      {@render children()}
    {:else}
      <span
        class={unstyled
          ? (slotClasses?.fallback ?? '')
          : styles.fallback({ class: slotClasses?.fallback })}
      >
        {getInitials(name)}
      </span>
    {/if}
  </div>

  {#if status}
    <span
      class={unstyled ? (slotClasses?.status ?? '') : styles.status({ class: slotClasses?.status })}
      role="img"
      aria-label={`Status: ${status}`}
    ></span>
  {/if}
</div>

<style>
  /* `.blocks-mint-*` rules live in `packages/blocks/src/lib/mint/styles.css`
     — see XC-12. Previously Avatar duplicated scale/translate/rotate/glow
     and used `currentColor` for the glow, which made it impossible to
     consume the global intent-aware glow token. */
  :global(.blocks-mint-pulse) {
    animation: avatar-pulse 2s var(--blocks-ease-smooth) infinite;
  }

  @keyframes avatar-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.05);
    }
  }

  /* AVT-3: opt-in "live" pulse on the status dot. A radar ring radiates via an
     animated box-shadow — no extra DOM — coloured to match the status through
     the per-status `--blocks-avatar-pulse-color` set in avatar.variants.ts.
     The dot now sits outside the frame's overflow-hidden clip, so the ring is
     never cut off. */
  :global(.blocks-avatar-status-pulse) {
    animation: avatar-status-pulse 1.6s var(--blocks-ease-confident) infinite;
  }

  /* The ring must reach its brightest while it is already clear of the dot —
     a shadow at spread 0 hides behind the opaque dot, so a plain from/to fade
     only ever shows the faint, expanded tail. The mid stop lights it up at a
     visible radius; it then keeps growing and fades to nothing. */
  @keyframes avatar-status-pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in oklab, var(--blocks-avatar-pulse-color) 0%, transparent);
    }
    35% {
      box-shadow: 0 0 0 0.22rem
        color-mix(in oklab, var(--blocks-avatar-pulse-color) 60%, transparent);
    }
    100% {
      box-shadow: 0 0 0 0.6rem color-mix(in oklab, var(--blocks-avatar-pulse-color) 0%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.blocks-mint-pulse),
    :global(.blocks-avatar-status-pulse) {
      animation: none;
    }
  }

  /* High-contrast delineation for the avatar disc. Targets the stable
     `blocks-avatar` root marker exactly — not `[class*='blocks-avatar']`, which
     would also catch the `blocks-avatar-status-pulse` dot and ring it. */
  @media (prefers-contrast: high) {
    :global(.blocks-avatar) {
      outline: 2px solid currentColor;
      outline-offset: -2px;
    }
  }
</style>
