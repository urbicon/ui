<script lang="ts" generics="Item">
  import { Badge } from '@urbicon-ui/blocks';
  import type { BadgeProps } from '@urbicon-ui/blocks';
  import { useTableI18n } from '$lib/i18n';
  import { customCellVariants, type CustomCellVariantProps } from '$lib/variants';

  const tt = useTableI18n();

  export type StatusConfig = {
    intent: BadgeProps['intent'];
    text: string;
    icon: boolean;
  };

  export type StatusBadgeProps<Item> = {
    item: Item;
    statusKey?: keyof Item;
    statusMap?: Record<string, StatusConfig>;
    size?: BadgeProps['size'];
    /** Visual variant — restricted to label variants. The `dot` arm of Badge forbids children. */
    variant?: Exclude<BadgeProps['variant'], 'dot'>;
    onClick?: (item: Item, status: string) => void;
    className?: string;
    testId?: string;
    align?: CustomCellVariantProps['align'];
    interactive?: boolean;
  };

  const defaultStatusMap: Record<string, StatusConfig> = $derived({
    active: { intent: 'success', text: tt('status.active'), icon: true },
    inactive: { intent: 'danger', text: tt('status.inactive'), icon: true },
    pending: { intent: 'warning', text: tt('status.pending'), icon: true },
    online: { intent: 'success', text: tt('status.online'), icon: true },
    offline: { intent: 'neutral', text: tt('status.offline'), icon: true },
    processing: { intent: 'primary', text: tt('status.processing'), icon: true },
    completed: { intent: 'success', text: tt('status.completed'), icon: false },
    failed: { intent: 'danger', text: tt('status.failed'), icon: false },
    draft: { intent: 'neutral', text: tt('status.draft'), icon: false },
    published: { intent: 'success', text: tt('status.published'), icon: true },
    archived: { intent: 'neutral', text: tt('status.archived'), icon: false }
  });

  const staticFallbackConfig: StatusConfig = { intent: 'neutral', text: '', icon: false };

  let {
    item,
    statusKey = 'status' as keyof Item,
    statusMap = undefined as Record<string, StatusConfig> | undefined,
    size = 'sm',
    variant = 'filled',
    onClick = undefined,
    className = '',
    testId = undefined,
    align = 'center',
    interactive = false
  }: StatusBadgeProps<Item> = $props();

  const mergedStatusMap = $derived({ ...defaultStatusMap, ...statusMap });
  const statusValue = $derived(String(item[statusKey]) || 'default');
  const fallbackConfig: StatusConfig = $derived({
    ...staticFallbackConfig,
    text: tt('status.unknown')
  });
  const config = $derived(mergedStatusMap[statusValue] || fallbackConfig);
  const isClickable = $derived(Boolean(onClick && !interactive === false));

  const computedTestId = $derived(() => {
    if (testId) return testId;
    if (item && typeof item === 'object' && 'id' in item) {
      return `status-badge-${item.id}`;
    }
    return 'status-badge';
  });

  const containerStyles = $derived(
    customCellVariants({
      align,
      interactive: isClickable,
      size: 'md'
    })
  );

  function handleClick(event: MouseEvent) {
    if (onClick) {
      event.stopPropagation();
      onClick(item, statusValue);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (onClick) {
        onClick(item, statusValue);
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="{containerStyles.container()} {className}"
  data-testid={computedTestId()}
  onclick={handleClick}
  onkeydown={handleKeyDown}
  role={isClickable ? 'button' : undefined}
  tabindex={isClickable ? 0 : undefined}
  title={`${tt('status.tooltip', { text: config.text })}${isClickable ? ` ${tt('status.clickToChange')}` : ''}`}
>
  <div class={containerStyles.content()}>
    <!-- min-w normalises the chips of one column to a shared width, so a
         status scan reads down a calm rail instead of ragged pill edges;
         longer labels may still grow to max-w before truncating. Badge
         centres its content, so short texts sit centred in the shared box. -->
    <div class="inline-block max-w-32 min-w-24">
      <Badge {size} {variant} intent={config.intent} class="w-full truncate">
        {#if config.icon}
          <div class="mr-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-75"></div>
        {/if}
        <span class="truncate">{config.text}</span>
      </Badge>
    </div>
  </div>
</div>
