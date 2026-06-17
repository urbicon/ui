<script lang="ts" generics="Item">
  import type { Component, Snippet } from 'svelte';
  import { useTableI18n } from '$lib/i18n';
  import { customCellVariants, type CustomCellVariantProps } from '$lib/variants';

  const tt = useTableI18n();

  export type CustomCellProps<Item> = {
    item: Item;
    content?: (item: Item) => string;
    component?: Component<Record<string, unknown>>;
    componentProps?: Record<string, unknown>;
    children?: Snippet<[item: Item]>;
    class?: string;
    style?: string;
    align?: CustomCellVariantProps['align'];
    wrap?: CustomCellVariantProps['wrap'];
    truncate?: CustomCellVariantProps['truncate'];
    interactive?: CustomCellVariantProps['interactive'];
    size?: CustomCellVariantProps['size'];
    onClick?: (item: Item) => void;
    onDoubleClick?: (item: Item) => void;
    title?: string | ((item: Item) => string);
    testId?: string;
  };

  let {
    item,
    content = undefined,
    component = undefined,
    componentProps = {},
    class: className = '',
    style = '',
    align = 'left',
    wrap = false,
    truncate = true,
    interactive = false,
    size = 'md',
    onClick = undefined,
    onDoubleClick = undefined,
    title = undefined,
    testId = undefined,
    children = undefined
  }: CustomCellProps<Item> = $props();

  // Compute dynamic properties
  const isClickable = $derived(Boolean(onClick || onDoubleClick || interactive));

  const computedTitle = $derived.by(() => {
    if (typeof title === 'function') {
      return title(item);
    }
    return title;
  });

  const computedTestId = $derived.by(() => {
    if (testId) return testId;
    if (item && typeof item === 'object' && 'id' in item) {
      return `custom-cell-${item.id}`;
    }
    return 'custom-cell';
  });

  // Tailwind-Variants styling
  const styles = $derived(
    customCellVariants({
      align,
      wrap,
      truncate,
      interactive: isClickable,
      size
    })
  );

  // Event handlers
  function handleClick(event: MouseEvent) {
    if (onClick) {
      event.stopPropagation();
      onClick(item);
    }
  }

  function handleDoubleClick(event: MouseEvent) {
    if (onDoubleClick) {
      event.stopPropagation();
      onDoubleClick(item);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (onClick) {
        onClick(item);
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="{styles.container()} {className}"
  {style}
  title={computedTitle}
  data-testid={computedTestId}
  onclick={handleClick}
  ondblclick={handleDoubleClick}
  onkeydown={handleKeyDown}
  role={isClickable ? 'button' : undefined}
  tabindex={isClickable ? 0 : undefined}
  aria-label={isClickable ? tt('aria.interactiveCell') : undefined}
>
  <div class={styles.content()}>
    {#if component}
      <!-- Svelte Component Rendering -->
      {@const Component = component}
      <Component {item} {...componentProps} />
    {:else if content}
      <!-- HTML Content Function — consumers opt into this API explicitly
           and are responsible for sanitising the output; the `content`
           callback is their authoring surface. -->
      <div class={styles.text()}>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html content(item)}
      </div>
    {:else if children}
      <!-- Snippet-based Content -->
      {@render children(item)}
    {:else}
      <!-- Default fallback content -->
      <span class={styles.fallback()}>
        {JSON.stringify(item)}
      </span>
    {/if}
  </div>
</div>
