<script lang="ts">
  import {
    ChevronDownIcon as ChevronDownIconDefault,
    DangerCircleIcon as DangerCircleIconDefault,
    headingTag,
    RefreshIcon as RefreshIconDefault,
    resolveIcon
  } from '@urbicon-ui/blocks';
  import {
    type ErrorStateVariantProps,
    errorStateVariants,
    tableRowVariants
  } from '#lib/variants/index.js';
  import { useTableI18n } from '../i18n';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';

  const tt = useTableI18n();

  const DangerIcon = resolveIcon('danger', DangerCircleIconDefault);
  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);
  const RefreshIcon = resolveIcon('refresh', RefreshIconDefault);

  export type ErrorStateProps = {
    title?: string;
    /** Heading level of the title, clamped to 1..6. @default 3 */
    headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
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
    headingLevel = 3,
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
    <!-- Live region on the content wrapper, not the row — see LoadingState. -->
    <div
      role="alert"
      class={resolveSlotClass(
        styles.container,
        styleConfig.slotClasses.errorState,
        styleConfig.unstyled,
        undefined,
        className
      )}
    >
      <div class={styles.icon()}>
        <DangerIcon class={styles.iconSvg()} />
      </div>

      <div class={styles.content()}>
        <svelte:element this={headingTag(headingLevel)} class={styles.title()}>
          {title}
        </svelte:element>

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
              <ChevronDownIcon size={16} class={styles.detailsIcon()} />
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
            <RefreshIcon class={styles.retryIcon()} />
            {retryText}
          </button>
        {/if}
      </div>
    </div>
  </td>
</tr>
