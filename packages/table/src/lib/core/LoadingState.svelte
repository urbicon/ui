<script lang="ts">
  import { useTableI18n } from '../i18n';
  import { Spinner } from '@urbicon-ui/blocks';
  import {
    loadingStateVariants,
    tableRowVariants,
    type LoadingStateVariantProps
  } from '$lib/variants';
  import { getTableStyleConfig, resolveSlotClass } from './table-style-context';

  const tt = useTableI18n();

  export type LoadingStateProps = {
    text?: string;
    description?: string;
    showSpinner?: boolean;
    colSpan?: number;
    class?: string;
    testId?: string;
    useI18n?: boolean;
    size?: LoadingStateVariantProps['size'];
  };

  let {
    text = undefined,
    description = undefined,
    showSpinner = true,
    colSpan = 1,
    class: className = '',
    testId = 'loading-state',
    useI18n = true,
    size = 'md'
  }: LoadingStateProps = $props();

  const SPINNER_SIZE_MAP = { sm: 'sm', md: 'md', lg: 'lg' } as const;

  const displayText = $derived.by(() => {
    if (text) return text;
    if (useI18n) return tt('data.loading');
    return 'Loading data...';
  });

  const styles = $derived(loadingStateVariants({ size }));
  const rowStyles = $derived(tableRowVariants({ size }));
  const styleConfig = getTableStyleConfig();
</script>

<tr class={rowStyles.row()} data-testid={testId}>
  <td colspan={colSpan} class={rowStyles.cell()}>
    <div
      class={resolveSlotClass(
        styles.container,
        styleConfig.slotClasses.loadingState,
        styleConfig.unstyled,
        className
      )}
    >
      {#if showSpinner}
        <Spinner size={SPINNER_SIZE_MAP[size]} intent="primary" label={displayText} />
      {/if}

      <div class={styles.content()}>
        <h3 class={styles.text()}>
          {displayText}
        </h3>

        {#if description}
          <p class={styles.description()}>
            {description}
          </p>
        {/if}
      </div>
    </div>
  </td>
</tr>
