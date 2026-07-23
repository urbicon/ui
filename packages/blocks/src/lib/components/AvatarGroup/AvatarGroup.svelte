<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { Avatar } from '$lib/primitives/Avatar';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { avatarGroupVariants } from './avatar-group.variants';
  import type { AvatarGroupProps } from './index';

  let {
    items,
    size = 'md',
    max,
    spacing = 'normal',
    borderColor = 'var(--color-surface-base)',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: AvatarGroupProps = $props();

  const bt = useBlocksI18n();
  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const styles = $derived(unstyled ? null : avatarGroupVariants({ spacing }));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'AvatarGroup', preset, { spacing, size }, slotClassesProp)
  );

  // When `max` is set and exceeded, show (max - 1) avatars + one "+N" chip so the
  // total rendered count is exactly `max`.
  const capped = $derived(typeof max === 'number' && max > 0 && items.length > max);
  const shown = $derived(capped ? items.slice(0, (max as number) - 1) : items);
  const overflow = $derived(capped ? items.length - ((max as number) - 1) : 0);

  const baseClass = $derived(
    [styles?.base(), slotClasses?.base, className].filter(Boolean).join(' ') || undefined
  );
  const overflowClass = $derived(
    [styles?.overflow(), slotClasses?.overflow].filter(Boolean).join(' ') || undefined
  );
</script>

<div class={baseClass} role="group" aria-label={bt('accessibility.avatarGroup')} {...restProps}>
  {#each shown as avatar, i (`${avatar.name ?? avatar.src ?? ''}-${i}`)}
    <Avatar {...avatar} {size} ring ringColor={borderColor} />
  {/each}
  {#if overflow > 0}
    <Avatar
      {size}
      ring
      ringColor={borderColor}
      intent="neutral"
      class={overflowClass}
      aria-label={`+${overflow}`}
    >
      {#snippet children()}+{overflow}{/snippet}
    </Avatar>
  {/if}
</div>
