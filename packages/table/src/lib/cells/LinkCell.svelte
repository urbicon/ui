<script lang="ts" generics="Item">
  import { useTableI18n } from '../i18n';
  import { linkCellVariants, type LinkCellVariantProps } from '$lib/variants';
  import { resolveIcon, ExternalLinkIcon as ExternalLinkIconDefault } from '@urbicon-ui/blocks';

  const tt = useTableI18n();

  const ExternalLinkIcon = resolveIcon('externalLink', ExternalLinkIconDefault);

  export type LinkCellProps<Item> = {
    item: Item;
    href?: string | ((item: Item) => string);
    urlKey?: keyof Item;
    text?: string | ((item: Item) => string);
    textKey?: keyof Item;
    target?: '_blank' | '_self' | '_parent' | '_top';
    external?: boolean;
    download?: boolean | string;
    rel?: string;
    onClick?: (item: Item, event: MouseEvent) => void;
    fallback?: string;
    maxLength?: number;
    showIcon?: boolean;
    className?: string;
    testId?: string;
  } & LinkCellVariantProps;

  // Props with sensible defaults
  let {
    item,
    href = undefined,
    urlKey = undefined,
    text = undefined,
    textKey = undefined,
    target = '_self',
    external = false,
    download = false,
    rel = undefined,
    onClick = undefined,
    fallback = '—',
    maxLength = undefined,
    showIcon = true,
    className = '',
    testId = undefined,
    size = 'md',
    variant = 'default',
    disabled = false
  }: LinkCellProps<Item> = $props();

  // Extract URL from item or prop
  const extractUrl = (item: Item): string | null => {
    if (typeof href === 'function') {
      return href(item);
    }
    if (typeof href === 'string') {
      return href;
    }
    if (urlKey) {
      const value = item[urlKey];
      return typeof value === 'string' ? value : null;
    }
    return null;
  };

  // Extract display text from item or prop
  const extractText = (item: Item): string => {
    if (typeof text === 'function') {
      return text(item);
    }
    if (typeof text === 'string') {
      return text;
    }
    if (textKey) {
      const value = item[textKey];
      if (typeof value === 'string') return value;
    }

    // Fallback to URL if no text specified
    const url = extractUrl(item);
    if (url) {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname + urlObj.pathname;
      } catch {
        return url;
      }
    }

    return fallback;
  };

  // Get computed values
  const computedHref = $derived(() => extractUrl(item));
  const computedText = $derived(() => extractText(item));

  // Determine if link is valid
  const isValidLink = $derived(() => {
    const url = computedHref();
    return url && url.trim().length > 0;
  });

  // Determine if link should open externally
  const isExternal = $derived(() => {
    if (external) return true;
    if (target === '_blank') return true;

    const url = computedHref();
    if (!url) return false;

    try {
      const urlObj = new URL(url);
      return urlObj.origin !== window.location.origin;
    } catch {
      return false;
    }
  });

  // Compute rel attribute
  const computedRel = $derived(() => {
    if (rel) return rel;
    if (isExternal()) return 'noopener noreferrer';
    return undefined;
  });

  // Truncate text if maxLength is specified
  const displayText = $derived.by(() => {
    const text = computedText();
    if (!maxLength || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  });

  // Generate tooltip
  const tooltipText = $derived.by(() => {
    const url = computedHref();
    const text = computedText();

    if (!url) return undefined;

    if (maxLength && text.length > maxLength) {
      return `${text}\n${url}`;
    }

    if (text !== url) {
      return url;
    }

    return undefined;
  });

  const tooltipValue = $derived(tooltipText);

  // Generate test ID
  const computedTestId = $derived(() => {
    if (testId) return testId;
    if (item && typeof item === 'object' && 'id' in item) {
      return `link-cell-${item.id}`;
    }
    return undefined;
  });

  // Determine variant based on state
  const linkVariant = $derived.by(() => {
    if (!isValidLink()) return 'default'; // Will be overridden by disabled state in template
    if (isExternal()) return 'external';
    return variant;
  });

  const styles = $derived(
    linkCellVariants({ size, variant: linkVariant, disabled: !isValidLink() || disabled })
  );

  // Event handlers
  function handleClick(event: MouseEvent) {
    if (onClick) {
      onClick(item, event);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const linkElement = event.target as HTMLAnchorElement;
      linkElement.click();
    }
  }
</script>

{#if isValidLink()}
  <div class={styles.container()}>
    <!-- `href` is consumer-provided at runtime; `resolve()` only applies to
         internal SvelteKit routes and would false-positive on any external
         (mailto:/tel:/http) link the consumer configures. -->
    <a
      href={computedHref()}
      {target}
      rel={computedRel()}
      download={download === true ? true : download || undefined}
      class="{styles.link()} {className}"
      title={tooltipValue}
      data-testid={computedTestId}
      onclick={handleClick}
      onkeydown={handleKeyDown}
    >
      <span class={styles.text()}>
        {displayText}
      </span>

      {#if showIcon && isExternal()}
        <ExternalLinkIcon size={14} class={styles.icon()} />
      {/if}
    </a>
  </div>
{:else}
  <div class={styles.container()}>
    <span
      class="{styles.link()} {className}"
      title={tt('table.link.invalid')}
      data-testid={computedTestId}
    >
      <span class={styles.text()}>
        {displayText}
      </span>
    </span>
  </div>
{/if}
