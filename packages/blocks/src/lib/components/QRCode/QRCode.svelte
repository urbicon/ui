<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { QRCodeProps } from './index';
  import { qrCodeVariants, type QRCodeVariants } from './qr-code.variants';
  import { encodeQr } from './qr-encode';

  const bt = useBlocksI18n();

  let {
    value,
    errorCorrection = 'M',
    size = 160,
    quietZone = 4,
    foreground = 'currentColor',
    background = 'transparent',
    minVersion,
    maxVersion,
    frame = 'none',
    onError,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    id,
    'aria-label': ariaLabel
  }: QRCodeProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: QRCodeVariants = $derived({ frame });
  const styles = $derived(qrCodeVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'QRCode',
      preset,
      variantProps,
      slotClassesProp,
      qrCodeVariants.config
    )
  );

  // Encode once per (value, level, bounds) change. A too-long payload surfaces
  // as an `error` result (visible fallback) rather than throwing through render.
  // Kept pure — the `onError` side effect runs from an $effect below, so a
  // consumer handler may safely mutate its own state (a callback fired inside
  // `$derived.by` would trip `state_unsafe_mutation`).
  const result = $derived.by((): { modules: boolean[][] } | { error: Error } => {
    try {
      return { modules: encodeQr(value, errorCorrection, { minVersion, maxVersion }) };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  });

  $effect(() => {
    if ('error' in result) onError?.(result.error);
  });

  const dimension = $derived('modules' in result ? result.modules.length + quietZone * 2 : 0);

  // One SVG path for all dark modules — a single element scales crisply and
  // keeps the DOM light even for large codes (hundreds of modules).
  const pathData = $derived.by(() => {
    if (!('modules' in result)) return '';
    const mod = result.modules;
    let d = '';
    for (let y = 0; y < mod.length; y++) {
      for (let x = 0; x < mod.length; x++) {
        if (mod[y][x]) d += `M${x + quietZone} ${y + quietZone}h1v1h-1z`;
      }
    }
    return d;
  });

  const label = $derived(ariaLabel ?? bt('accessibility.qrCode'));
</script>

<span
  {id}
  class={unstyled
    ? resolveClassChain(slotClasses?.root, className)
    : styles.root({ class: [slotClasses?.root, className] })}
>
  {#if 'modules' in result}
    <svg
      width={size}
      height={size}
      viewBox="0 0 {dimension} {dimension}"
      shape-rendering="crispEdges"
      role="img"
      aria-label={label}
      class={unstyled ? (slotClasses?.svg ?? '') : styles.svg({ class: slotClasses?.svg })}
    >
      {#if background !== 'transparent' && background !== 'none'}
        <rect width={dimension} height={dimension} fill={background} />
      {/if}
      <path d={pathData} fill={foreground} />
    </svg>
  {:else}
    <span
      role="img"
      aria-label={label}
      style="width: {size}px; height: {size}px;"
      class={unstyled
        ? (slotClasses?.fallback ?? '')
        : styles.fallback({ class: slotClasses?.fallback })}
    >
      {result.error.message}
    </span>
  {/if}
</span>
