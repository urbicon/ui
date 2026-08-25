<script lang="ts">
  import { Button, Separator, getBlocksConfig } from '@urbicon-ui/blocks';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import { resolveAuthSlotClasses, slotClass } from '../../utils/slot-class.js';
  import type { NotificationCenterProps } from './index.js';

  let {
    t: tProp,
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onDelete,
    onNotificationClick,
    item: itemSnippet,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    class: className
  }: NotificationCenterProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveAuthSlotClasses(blocksConfig, 'NotificationCenter', preset, slotClassesProp)
  );

  const authLocale = useAuthLocale();
  const t = $derived(mergeAuthLocale(authLocale(), tProp));
  const unreadCount = $derived(notifications.filter((n) => !n.readAt).length);

  function timeAgo(date: Date | string): string {
    const now = Date.now();
    const then = (date instanceof Date ? date : new Date(date)).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    const labels = t.common.timeAgo;
    if (diffMin < 1) return labels.now;
    if (diffMin < 60) return labels.minutes.replace('{n}', String(diffMin));
    if (diffHrs < 24) return labels.hours.replace('{n}', String(diffHrs));
    return labels.days.replace('{n}', String(diffDays));
  }

  // Styling helper: in `unstyled` mode only the slot override applies.
  const cls = (base: string, slot?: string) => slotClass(unstyled, base, slot);
</script>

<div class={cls('flex flex-col', [slotClasses.root, className].filter(Boolean).join(' '))}>
  <div class={cls('flex items-center justify-between px-4 py-3', slotClasses.header)}>
    <h2 class={cls('text-text-primary text-base font-semibold')}>{t.notifications.center.title}</h2>
    {#if unreadCount > 0}
      <Button variant="ghost" size="sm" onclick={() => onMarkAllAsRead?.()} {unstyled}>
        {t.notifications.center.markAllRead}
      </Button>
    {/if}
  </div>

  <Separator {unstyled} />

  {#if notifications.length === 0}
    <p class={cls('text-text-tertiary px-4 py-8 text-center text-sm', slotClasses.empty)}>
      {t.notifications.center.empty}
    </p>
  {:else}
    <ul class={cls('flex flex-col', slotClasses.list)}>
      {#each notifications as notification (notification.id)}
        <!-- `data-unread` carries the read state structurally so unstyled
             consumers can style it — the bg-surface-quiet tint is dropped
             with the other default classes. -->
        <li
          class={unstyled
            ? slotClasses.item
            : [
                'hover:bg-surface-hover border-border-subtle flex items-start gap-3 border-b px-4 py-3 transition-colors',
                !notification.readAt ? 'bg-surface-quiet' : '',
                slotClasses.item
              ]
                .filter(Boolean)
                .join(' ')}
          data-unread={!notification.readAt || undefined}
        >
          {#if itemSnippet}
            {@render itemSnippet(notification)}
          {:else}
            <button
              type="button"
              class={cls('flex min-w-0 flex-1 flex-col gap-0.5 text-left')}
              onclick={() => {
                if (!notification.readAt) onMarkAsRead?.(notification.id);
                onNotificationClick?.(notification);
              }}
            >
              <span class={cls('text-text-primary text-sm font-medium')}>
                {#if !notification.readAt}
                  <span
                    class={cls('bg-primary mr-1.5 inline-block h-2 w-2 rounded-full')}
                    aria-hidden="true"
                  ></span>
                {/if}
                {notification.title}
              </span>
              {#if notification.body}
                <span class={cls('text-text-secondary line-clamp-2 text-xs')}>
                  {notification.body}
                </span>
              {/if}
              <time class={cls('text-text-tertiary text-xs')}>
                {timeAgo(notification.createdAt)}
              </time>
            </button>
            <Button
              variant="ghost"
              size="sm"
              intent="neutral"
              onclick={() => onDelete?.(notification.id)}
              {unstyled}
              class={cls('shrink-0')}
              aria-label={t.notifications.center.delete}
            >
              &times;
            </Button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
