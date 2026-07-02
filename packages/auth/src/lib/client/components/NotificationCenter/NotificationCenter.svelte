<script lang="ts">
  import { Button, Separator } from '@urbicon-ui/blocks';
  import { mergeAuthLocale, useAuthLocale } from '../../../i18n/index.js';
  import type { NotificationCenterProps } from './index.js';

  let {
    t: tProp,
    notifications,
    onMarkAsRead,
    onMarkAllAsRead,
    onDelete,
    onClick,
    item: itemSnippet,
    unstyled = false,
    slotClasses = {},
    class: className
  }: NotificationCenterProps = $props();

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
</script>

<div
  class={unstyled
    ? [slotClasses.root, className].filter(Boolean).join(' ')
    : ['flex flex-col', slotClasses.root, className].filter(Boolean).join(' ')}
>
  <div
    class={unstyled
      ? slotClasses.header
      : ['flex items-center justify-between px-4 py-3', slotClasses.header]
          .filter(Boolean)
          .join(' ')}
  >
    <h2 class="text-text-primary text-base font-semibold">{t.notifications.center.title}</h2>
    {#if unreadCount > 0}
      <Button variant="ghost" size="sm" onclick={() => onMarkAllAsRead?.()} {unstyled}>
        {t.notifications.center.markAllRead}
      </Button>
    {/if}
  </div>

  <Separator {unstyled} />

  {#if notifications.length === 0}
    <p
      class={unstyled
        ? slotClasses.empty
        : ['text-text-tertiary px-4 py-8 text-center text-sm', slotClasses.empty]
            .filter(Boolean)
            .join(' ')}
    >
      {t.notifications.center.empty}
    </p>
  {:else}
    <ul
      class={unstyled
        ? slotClasses.list
        : ['flex flex-col', slotClasses.list].filter(Boolean).join(' ')}
    >
      {#each notifications as notification (notification.id)}
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
        >
          {#if itemSnippet}
            {@render itemSnippet(notification)}
          {:else}
            <button
              type="button"
              class="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
              onclick={() => {
                if (!notification.readAt) onMarkAsRead?.(notification.id);
                onClick?.(notification);
              }}
            >
              <span class="text-text-primary text-sm font-medium">
                {#if !notification.readAt}
                  <span
                    class="bg-primary mr-1.5 inline-block h-2 w-2 rounded-full"
                    aria-hidden="true"
                  ></span>
                {/if}
                {notification.title}
              </span>
              {#if notification.body}
                <span class="text-text-secondary line-clamp-2 text-xs">{notification.body}</span>
              {/if}
              <time class="text-text-tertiary text-xs">
                {timeAgo(notification.createdAt)}
              </time>
            </button>
            <Button
              variant="ghost"
              size="sm"
              intent="neutral"
              onclick={() => onDelete?.(notification.id)}
              {unstyled}
              class="shrink-0"
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
