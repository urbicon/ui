<script lang="ts">
  import {
    DatabaseIcon as DatabaseIconDefault,
    headingTag,
    InboxIcon as InboxIconDefault,
    resolveIcon,
    SearchIcon as SearchIconDefault
  } from '@urbicon-ui/blocks';
  import type { Snippet } from 'svelte';
  import {
    type EmptyStateVariantProps,
    emptyStateVariants,
    tableRowVariants
  } from '#lib/variants/index.js';
  import { useTableI18n } from '../i18n';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';

  const tt = useTableI18n();

  const SearchIcon = resolveIcon('search', SearchIconDefault);
  const DatabaseIcon = resolveIcon('database', DatabaseIconDefault);
  const InboxIcon = resolveIcon('inbox', InboxIconDefault);

  export type EmptyStateProps = {
    message?: string;
    /** Heading level of the message, clamped to 1..6. @default 3 */
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
    description?: string;
    /**
     * The icon above the message: `'search'`, `'database'` or `'inbox'` draws that library
     * icon, a snippet renders your own. Omit it for no icon.
     */
    icon?: 'search' | 'database' | 'inbox' | Snippet;
    actionText?: string;
    onAction?: () => void;
    colSpan?: number;
    class?: string;
    testId?: string;
    useI18n?: boolean;
    size?: EmptyStateVariantProps['size'];
  };

  let {
    message = undefined,
    headingLevel = 3,
    description = undefined,
    icon = undefined,
    actionText = undefined,
    onAction = undefined,
    colSpan = 1,
    class: className = '',
    testId = 'empty-state',
    useI18n = true,
    size = 'md'
  }: EmptyStateProps = $props();

  const styleConfig = getTableStyleConfig();

  // TypeScript rejects any other string; this names the mistake for a JavaScript caller (a markup
  // string, a mistyped name) instead of failing as an anonymous call inside the template.
  const ownIcon = $derived.by(() => {
    if (!icon || icon === 'search' || icon === 'database' || icon === 'inbox') return undefined;
    if (typeof icon === 'function') return icon;
    throw new TypeError(
      `[EmptyState] icon must be 'search', 'database', 'inbox' or a snippet, got ${JSON.stringify(icon)}. A markup string does not render as HTML; pass a snippet.`
    );
  });

  // Smart message with I18n fallback
  const displayMessage = $derived.by(() => {
    if (message) return message;

    if (useI18n) {
      return tt('data.empty');
    }

    return 'No data found';
  });

  // Smart action text with I18n fallback
  const displayActionText = $derived.by(() => {
    if (actionText) return actionText;

    if (useI18n && onAction) {
      return tt('data.refresh');
    }

    return actionText;
  });

  // TV Styles
  const styles = $derived(emptyStateVariants({ size }));
  const rowStyles = $derived(tableRowVariants({ size }));

  // Event handlers
  function handleAction() {
    if (onAction) {
      onAction();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (onAction && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onAction();
    }
  }
</script>

<tr class={rowStyles.row()} data-testid={testId}>
  <td colspan={colSpan} class={rowStyles.cell()}>
    <div
      class={resolveSlotClass(
        styles.container,
        styleConfig.slotClasses.emptyState,
        styleConfig.unstyled,
        undefined,
        className
      )}
    >
      {#if icon}
        <div class={styles.icon()}>
          {#if icon === 'search'}
            <SearchIcon class={styles.iconSvg()} />
          {:else if icon === 'database'}
            <DatabaseIcon class={styles.iconSvg()} />
          {:else if icon === 'inbox'}
            <InboxIcon class={styles.iconSvg()} />
          {:else}
            {@render ownIcon?.()}
          {/if}
        </div>
      {/if}

      <div class={styles.content()}>
        <svelte:element this={headingTag(headingLevel)} class={styles.title()}>
          {displayMessage}
        </svelte:element>

        {#if description}
          <p class={styles.description()}>
            {description}
          </p>
        {/if}

        {#if displayActionText && onAction}
          <button
            class={styles.action()}
            onclick={handleAction}
            onkeydown={handleKeyDown}
            type="button"
          >
            {displayActionText}
          </button>
        {/if}
      </div>
    </div>
  </td>
</tr>
