<script lang="ts">
  import { useTableI18n } from '../i18n';
  import { emptyStateVariants, tableRowVariants, type EmptyStateVariantProps } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';

  const tt = useTableI18n();

  export type EmptyStateProps = {
    message?: string;
    description?: string;
    icon?: string;
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
        className
      )}
    >
      {#if icon}
        <div class={styles.icon()}>
          {#if icon === 'search'}
            <svg
              class={styles.iconSvg()}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <path d="M21 21L16.65 16.65"></path>
            </svg>
          {:else if icon === 'database'}
            <svg
              class={styles.iconSvg()}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
          {:else if icon === 'inbox'}
            <svg
              class={styles.iconSvg()}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="22,12 18,12 15,21 9,21 6,12 2,12"></polyline>
              <path
                d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
              ></path>
            </svg>
          {:else}
            <!-- Consumer-provided SVG markup; they are responsible for
                 sanitisation (same contract as the other icon slots). -->
            {@html icon}
          {/if}
        </div>
      {/if}

      <div class={styles.content()}>
        <h3 class={styles.title()}>
          {displayMessage}
        </h3>

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
