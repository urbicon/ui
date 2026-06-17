<script lang="ts">
  import { useTableI18n } from '../i18n';
  import { errorStateVariants, tableRowVariants, type ErrorStateVariantProps } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';

  const tt = useTableI18n();

  export type ErrorStateProps = {
    title?: string;
    message?: string;
    details?: string;
    retryText?: string;
    onRetry?: () => void;
    colSpan?: number;
    className?: string;
    testId?: string;
    size?: ErrorStateVariantProps['size'];
  };

  let {
    title = tt('error.loadingError'),
    message = tt('error.genericMessage'),
    details = undefined,
    retryText = tt('error.retry'),
    onRetry = undefined,
    colSpan = 1,
    className = '',
    testId = 'error-state',
    size = 'md'
  }: ErrorStateProps = $props();

  const styleConfig = getTableStyleConfig();

  let showDetails = $state(false);

  // TV Styles
  const styles = $derived(errorStateVariants({ size, detailsExpanded: showDetails }));
  const rowStyles = $derived(tableRowVariants({ size }));

  // Event handlers
  function handleRetry() {
    if (onRetry) {
      onRetry();
    }
  }

  function toggleDetails() {
    showDetails = !showDetails;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const target = event.target as HTMLElement;

      if (target.classList.contains('retry-button')) {
        handleRetry();
      } else if (target.classList.contains('details-toggle')) {
        toggleDetails();
      }
    }
  }
</script>

<tr class={rowStyles.row()} data-testid={testId}>
  <td colspan={colSpan} class={rowStyles.cell()}>
    <div
      class={resolveSlotClass(
        styles.container(),
        styleConfig.slotClasses.errorState,
        styleConfig.unstyled,
        className
      )}
    >
      <div class={styles.icon()}>
        <svg
          class={styles.iconSvg()}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>

      <div class={styles.content()}>
        <h3 class={styles.title()}>
          {title}
        </h3>

        <p class={styles.message()}>
          {message}
        </p>

        {#if details}
          <div class={styles.details()}>
            <button
              class="{styles.detailsToggle()} details-toggle"
              onclick={toggleDetails}
              onkeydown={handleKeyDown}
              type="button"
              aria-expanded={showDetails}
            >
              <span>{tt('actions.showDetails')}</span>
              <svg
                class={styles.detailsIcon()}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </button>

            {#if showDetails}
              <div class={styles.detailsContent()}>
                <pre class={styles.detailsText()}>{details}</pre>
              </div>
            {/if}
          </div>
        {/if}

        {#if onRetry}
          <button
            class="{styles.retryButton()} retry-button"
            onclick={handleRetry}
            onkeydown={handleKeyDown}
            type="button"
          >
            <svg
              class={styles.retryIcon()}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="23,4 23,10 17,10"></polyline>
              <polyline points="1,20 1,14 7,14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            {retryText}
          </button>
        {/if}
      </div>
    </div>
  </td>
</tr>
