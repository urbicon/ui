<script lang="ts">
  import { Popover } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveIcon } from '$lib/icons';
  import LinkIconDefault from '$lib/icons/LinkIcon.svelte';
  import { checkLinkUrl } from '../markdown/url-policy.js';
  import { citationChipVariants } from './citation-chip.variants';
  import type { CitationChipProps } from './index';

  const LinkIcon = resolveIcon('link', LinkIconDefault);

  let {
    source,
    index,
    citationStyle = 'numeric',
    urlPolicy,
    openLabel = 'Open source',
    label,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: CitationChipProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps = $derived({ citationStyle });
  const styles = $derived(citationChipVariants(variantProps));
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'CitationChip', preset, variantProps, slotClassesProp)
  );

  // Numeric markers show the 1-based ordinal, falling back to the raw id when
  // no index is supplied (standalone reference lists). Label markers show the
  // (truncated) title.
  const displayLabel = $derived(
    citationStyle === 'label' ? source.title : index != null ? String(index) : source.id
  );

  const ariaLabel = $derived(
    label ?? (index != null ? `Source ${index}: ${source.title}` : `Source: ${source.title}`)
  );

  // Run the same strict URL policy as the streaming-markdown engine: a blocked
  // or absent URL yields no link, only the title/snippet.
  const linkCheck = $derived(
    source.url !== undefined ? checkLinkUrl(source.url, urlPolicy) : ({ ok: false } as const)
  );
  const linkHref = $derived(linkCheck.ok ? linkCheck.href : undefined);
</script>

<!-- The aria-label on Popover lands on the panel via its restProps spread, so
     the opened popover is not an unnamed dialog (axe: aria-dialog-name). -->
<Popover placement="bottom-start" aria-label={ariaLabel}>
  {#snippet trigger()}
    <button
      type="button"
      class={unstyled
        ? [slotClasses?.trigger, className].filter(Boolean).join(' ')
        : styles.trigger({ class: [slotClasses?.trigger, className] })}
      aria-label={ariaLabel}
      {...restProps}
    >
      <!-- truncate must sit on an inner block-ish span: on the inline-flex
           trigger itself the ellipsis never renders and justify-center clips
           the START of long labels. -->
      <span class="min-w-0 truncate">{displayLabel}</span>
    </button>
  {/snippet}
  <div
    class={unstyled
      ? (slotClasses?.popover ?? '')
      : styles.popover({ class: slotClasses?.popover })}
  >
    <span
      class={unstyled ? (slotClasses?.title ?? '') : styles.title({ class: slotClasses?.title })}
    >
      {source.title}
    </span>
    {#if source.snippet}
      <p
        class={unstyled
          ? (slotClasses?.snippet ?? '')
          : styles.snippet({ class: slotClasses?.snippet })}
      >
        {source.snippet}
      </p>
    {/if}
    {#if linkHref}
      <a
        href={linkHref}
        target="_blank"
        rel="noopener noreferrer"
        class={unstyled ? (slotClasses?.link ?? '') : styles.link({ class: slotClasses?.link })}
      >
        <LinkIcon
          class={unstyled
            ? (slotClasses?.linkIcon ?? '')
            : styles.linkIcon({ class: slotClasses?.linkIcon })}
        />
        {openLabel}
      </a>
    {/if}
  </div>
</Popover>
