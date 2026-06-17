<script lang="ts">
  import { useBlocksI18n } from '$lib/i18n';
  import { CloseIcon } from '$lib/icons';
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import {
    computePosition,
    autoUpdate,
    flip,
    shift,
    offset,
    arrow as floatingArrow
  } from '$lib/utils/floating';
  import { observeTargetResolution } from '$lib/utils/observe-target';
  import { getGuideContext } from './guide.context';
  import { guideHintVariants } from './guide.variants';
  import type { GuideHintProps } from './index';

  const bt = useBlocksI18n();

  let {
    for: topicId,
    seenId: seenIdProp,
    open = false,
    trigger = 'mount',
    once = true,
    placement = 'bottom',
    arrow = true,
    title,
    children,
    onDismiss,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: GuideHintProps = $props();

  const guide = getGuideContext();

  if (import.meta.env.DEV && !guide) {
    console.warn(
      '[Guide] <GuideHint> is used without a <GuideProvider> ancestor — it will not render.'
    );
  }

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.GuideHint?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'GuideHint', preset),
      slotClassesProp
    )
  );
  const styles = $derived(guideHintVariants());

  const seenId = $derived(seenIdProp ?? topicId);

  let hintEl = $state<HTMLElement>();
  let arrowEl = $state<HTMLElement>();
  let arrowStyle = $state('');
  let dismissed = $state(false);
  // Bumped when the anchor (`data-guide` element) appears (lazy render) or vanishes — the
  // DOM-fallback `querySelector` is not otherwise reactive. The show/hide effect re-resolves.
  let targetRevision = $state(0);

  // `trigger: 'mount'` shows as soon as it mounts; `'manual'` waits for `open`
  // (the consumer's on-route / on-condition strategy drives that boolean).
  const requested = $derived(trigger === 'manual' ? open : true);
  const alreadySeen = $derived(once && guide ? guide.hasSeen(seenId) : false);
  // Top-layer discipline (§3.4): step aside while a foreign modal / tour is open.
  const blocked = $derived((guide?.overlayDepth ?? 0) > 0);
  const visible = $derived(!!guide && requested && !alreadySeen && !dismissed && !blocked);

  // A manual re-open clears a prior in-session dismiss, so on-route / on-condition hints
  // can re-surface (the `once` persistence still gates cross-mount reappearance). Also warn
  // in DEV when `open` is set without `trigger="manual"`, where it is silently ignored.
  $effect(() => {
    if (trigger === 'manual') {
      if (open) dismissed = false;
    } else if (import.meta.env.DEV && open) {
      console.warn('[Guide] <GuideHint open> is ignored unless trigger="manual".');
    }
  });

  function dismiss() {
    dismissed = true;
    if (once) guide?.markSeen(seenId);
    onDismiss?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Escape dismisses only while focus is inside the hint (non-modal courtesy).
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      dismiss();
    }
  }

  function updatePosition() {
    const target = guide?.resolveTarget(topicId);
    if (!target || !hintEl) return;
    computePosition(target, hintEl, {
      placement,
      strategy: 'fixed',
      middleware: [
        offset(10),
        flip(),
        shift({ padding: 8 }),
        ...(arrow && arrowEl ? [floatingArrow({ element: arrowEl, padding: 6 })] : [])
      ]
    })
      .then(({ x, y, middlewareData, placement: resolved }) => {
        if (!hintEl || !Number.isFinite(x) || !Number.isFinite(y)) return;
        hintEl.style.left = `${x}px`;
        hintEl.style.top = `${y}px`;

        const arrowData = middlewareData.arrow as { x?: number; y?: number } | undefined;
        if (arrowData && arrowEl) {
          const staticSide =
            { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[
              resolved.split('-')[0]
            ] ?? 'bottom';
          arrowStyle = `position:absolute;${arrowData.x != null ? `left:${arrowData.x}px;` : ''}${
            arrowData.y != null ? `top:${arrowData.y}px;` : ''
          }${staticSide}:-5px;`;
        }
      })
      .catch((err) => console.warn('[GuideHint] computePosition failed', err));
  }

  // Single exit point (mirrors Tooltip): when visible + target resolvable, show the
  // popover and attach autoUpdate; otherwise hide and tear down.
  let cleanup: (() => void) | undefined;
  $effect(() => {
    if (!hintEl) return;
    void targetRevision; // re-resolve when the anchor renders/vanishes (lazy / route swap)
    const target = visible ? guide?.resolveTarget(topicId) : null;

    if (!target) {
      cleanup?.();
      cleanup = undefined;
      if (hintEl.matches(':popover-open')) {
        try {
          hintEl.hidePopover();
        } catch (err) {
          console.warn('[GuideHint] hidePopover failed', err);
        }
      }
      return;
    }

    if (!hintEl.matches(':popover-open')) {
      try {
        hintEl.showPopover();
      } catch (err) {
        console.warn('[GuideHint] showPopover failed', err);
      }
    }
    cleanup?.();
    cleanup = autoUpdate(target, hintEl, updatePosition);

    return () => {
      cleanup?.();
      cleanup = undefined;
    };
  });

  // Lazy / vanishing anchor: while the hint wants to show, watch the DOM so an anchor that
  // renders *after* the hint mounts gets picked up, and one that is removed hides the hint.
  // `autoUpdate` (above) only tracks an existing element's box, not its existence.
  $effect(() => {
    if (!guide || !visible) return;
    const controller = guide;
    const id = topicId;
    return observeTargetResolution(
      () => controller.resolveTarget(id),
      () => targetRevision++
    );
  });

  // DEV resilience: a requested hint whose target can't be resolved is a silent
  // no-op otherwise — warn so a wrong `for` id is noticed (mirrors the engine).
  $effect(() => {
    if (import.meta.env.DEV && guide && visible && !guide.resolveTarget(topicId)) {
      console.warn(
        `[Guide] <GuideHint for="${topicId}"> cannot anchor — no element with [data-guide="${topicId}"] (or registered target) found.`
      );
    }
  });
</script>

{#if guide}
  <div
    bind:this={hintEl}
    class={[
      'guide-hint',
      unstyled
        ? [slotClasses?.hint, className].filter(Boolean).join(' ')
        : styles.hint({ class: [slotClasses?.hint, className] })
    ]}
    role="status"
    aria-live="polite"
    aria-atomic="true"
    onkeydown={handleKeydown}
    {...restProps}
    popover="manual"
    style="position:fixed;margin:0;inset:auto;overflow:visible;"
  >
    {#if title}
      <p
        class={unstyled ? (slotClasses?.title ?? '') : styles.title({ class: slotClasses?.title })}
      >
        {title}
      </p>
    {/if}
    <div class={unstyled ? (slotClasses?.body ?? '') : styles.body({ class: slotClasses?.body })}>
      {@render children?.()}
    </div>
    <button
      type="button"
      class={unstyled
        ? (slotClasses?.dismiss ?? '')
        : styles.dismiss({ class: slotClasses?.dismiss })}
      onclick={dismiss}
      aria-label={bt('guide.dismiss', {})}
    >
      <CloseIcon class="h-4 w-4" />
    </button>
    {#if arrow}
      <div
        bind:this={arrowEl}
        class={unstyled ? (slotClasses?.arrow ?? '') : styles.arrow({ class: slotClasses?.arrow })}
        style={arrowStyle}
      ></div>
    {/if}
  </div>
{/if}

<style>
  /* Entry/exit motion for the native popover. `allow-discrete` lets display/overlay
     animate so the hint fades out too, not just in. Reduced-motion opts out. */
  .guide-hint {
    opacity: 0;
    transform: translateY(4px);
    transition:
      opacity var(--blocks-duration-normal, 200ms) var(--blocks-ease-confident, ease),
      transform var(--blocks-duration-normal, 200ms) var(--blocks-ease-confident, ease),
      overlay var(--blocks-duration-normal, 200ms) allow-discrete,
      display var(--blocks-duration-normal, 200ms) allow-discrete;
  }

  .guide-hint:popover-open {
    opacity: 1;
    transform: translateY(0);
  }

  @starting-style {
    .guide-hint:popover-open {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .guide-hint {
      transition: none;
    }
  }
</style>
