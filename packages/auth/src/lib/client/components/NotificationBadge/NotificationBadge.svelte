<script lang="ts">
  import { Badge, getBlocksConfig, resolveClassChain } from '@urbicon-ui/blocks';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { resolveAuthSlotClasses } from '../../utils/slot-class.js';
  import type { NotificationBadgeProps } from './index.js';

  let {
    t: tProp,
    count,
    onclick,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className,
    ...restProps
  }: NotificationBadgeProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'NotificationBadge', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));

  const shown = $derived(count > 99 ? '99+' : String(count));
  // The name substitutes the *shown* text, not `count`: what a voice-control
  // user says has to be in the name they see (WCAG 2.5.3), and past 99 the two
  // differ.
  const label = $derived(t.notifications.badge.unread.replace('{n}', shown));
</script>

{#if count > 0}
  <!-- `aria-label` before the spread: a consumer's own attribute overrides it. -->
  <Badge
    intent="danger"
    variant="filled"
    size="sm"
    interactive={!!onclick}
    {onclick}
    {unstyled}
    class={resolveClassChain(slotClasses.root, className)}
    aria-label={label}
    {...restProps}
  >
    {shown}
  </Badge>
{/if}
