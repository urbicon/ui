<script lang="ts" generics="Item">
  import {
    Button,
    resolveIcon,
    CheckCircleIcon as CheckCircleIconDefault,
    CopyIcon as CopyIconDefault
  } from '@urbicon-ui/blocks';

  const CheckCircleIcon = resolveIcon('checkCircle', CheckCircleIconDefault);
  const CopyIcon = resolveIcon('copy', CopyIconDefault);
  import { useTableI18n } from '../i18n';
  import { type CopyButtonVariantProps, copyButtonVariants } from '$lib/variants';
  import { getNestedValue } from '$lib/utils';

  const tt = useTableI18n();

  export type CopyButtonProps<Item> = {
    item: Item;
    valueKey?: keyof Item;
    label?: string;
    size?: CopyButtonVariantProps['size'];
    responsive?: CopyButtonVariantProps['responsive'];
    className?: string;
  };

  let {
    item,
    valueKey = 'email' as keyof Item,
    label: labelProp = undefined as string | undefined,
    size = 'xs',
    responsive = true,
    className = ''
  }: CopyButtonProps<Item> = $props();

  const label = $derived(labelProp ?? tt('copy.button'));

  let copied = $state(false);
  let failed = $state(false);

  // Reactive value extraction
  const value = $derived(getNestedValue(item, String(valueKey)) || '');

  // Tailwind-Variants styling
  const styles = $derived(copyButtonVariants({ size, responsive }));

  async function copyToClipboard(event: MouseEvent) {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
      copied = true;
      failed = false;
      setTimeout(() => (copied = false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
      failed = true;
      setTimeout(() => (failed = false), 2000);
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      copyToClipboard(event as unknown as MouseEvent);
    }
  }
</script>

<div class="{styles.container()} {className}">
  <Button
    variant="ghost"
    size="xs"
    intent={copied ? 'success' : failed ? 'danger' : 'secondary'}
    onclick={copyToClipboard}
    onkeydown={handleKeyDown}
    title={copied ? tt('copy.copied') : failed ? tt('copy.failed') : `${label}: ${value}`}
    class={styles.button()}
    aria-label={copied ? tt('copy.copied') : failed ? tt('copy.failed') : label}
  >
    {#if copied}
      <CheckCircleIcon class={styles.icon()} />
      <span class={styles.textSuccess()}>{tt('copy.copied')}</span>
    {:else if failed}
      <CopyIcon class={styles.icon()} />
      <span class={styles.text()}>{tt('copy.failed')}</span>
    {:else}
      <CopyIcon class={styles.icon()} />
      <span class={styles.text()}>{label}</span>
    {/if}
  </Button>
</div>
