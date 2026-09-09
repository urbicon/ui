<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { collapsibleVariants, type CollapsibleVariants } from './collapsible.variants';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import { useDisclosure } from '$lib/utils/use-disclosure.svelte';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { CollapsibleProps } from './index';

  const ChevronDownIcon = resolveIcon('chevronDown', ChevronDownIconDefault);

  let {
    open = $bindable(),
    defaultOpen = false,
    onOpenChange,
    disabled = false,
    title,
    trigger,
    variant = 'default',
    size = 'md',
    transitionDuration,
    transitionEasing,
    name,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: CollapsibleProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // ACC-3: per-instance collapse motion. Set the shared collapse CSS variables inline only when
  // a prop is provided, so the unset default keeps inheriting the reduced-motion-aware token.
  const collapseDuration = $derived(
    transitionDuration != null ? `${transitionDuration}ms` : undefined
  );

  const variantProps: CollapsibleVariants = $derived({ variant, size });
  const styles = $derived(collapsibleVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Collapsible',
      preset,
      variantProps,
      slotClassesProp,
      collapsibleVariants.config
    )
  );

  const propsId = $props.id();
  const fallbackName = `collapsible-${propsId}`;
  const uid = $derived(name ?? fallbackName);
  const triggerId = $derived(`${uid}-trigger`);
  const contentId = $derived(`${uid}-content`);

  // The open state and the trigger↔region ARIA pair come from the public
  // `useDisclosure` hook, so a consumer whose revealed content is a sibling
  // rather than a child reads the same wiring out of `utils/` instead of
  // hand-writing it.
  const disclosure = useDisclosure(() => ({
    open,
    defaultOpen,
    disabled,
    triggerId,
    contentId,
    onOpenChange: applyOpen
  }));
  const isOpen = $derived(disclosure.open);

  // Single mutation point. Family contract (COMPONENT-API-CONVENTIONS.md
  // §Open-state vocabulary): the transition is applied optimistically — `open`
  // is written *before* `onOpenChange` fires, once per transition (the
  // uncontrolled seed is the hook's own and is written before it calls this).
  // With `bind:open` that write is the propagation. A consumer passing `open`
  // without `bind:` must mirror every `onOpenChange` back into its state
  // (Svelte can't distinguish `open={x}` from `bind:open={x}` at runtime, so a
  // rejected transition is undetectable from in here). To veto transitions, own
  // them instead: drive `open` from your source of truth and toggle it from a
  // custom `trigger` snippet — see AccordionItem's collapsible=false handling.
  function applyOpen(next: boolean) {
    if (open !== undefined) open = next;
    onOpenChange?.(next);
  }

  // Read field by field rather than spread: the default trigger is a native
  // `<button>` and keeps the native `disabled`, so it must not also carry the
  // hook's `aria-disabled`. The region follows the same form so both halves of
  // the wiring read alike.
  const triggerProps = $derived(disclosure.triggerProps);
  const contentProps = $derived(disclosure.contentProps);
</script>

<div
  class={unstyled
    ? resolveClassChain(slotClasses?.base, className)
    : styles.base({ class: [slotClasses?.base, className] })}
  style:--blocks-collapse-duration={collapseDuration}
  style:--blocks-collapse-easing={transitionEasing}
  data-state={isOpen ? 'open' : 'closed'}
  {...restProps}
>
  {#if trigger}
    {@render trigger({ open: isOpen, toggle: disclosure.toggle, disabled, triggerId, contentId })}
  {:else}
    <button
      id={triggerProps.id}
      type="button"
      class={unstyled
        ? (slotClasses?.trigger ?? '')
        : styles.trigger({ class: slotClasses?.trigger })}
      aria-expanded={triggerProps['aria-expanded']}
      aria-controls={triggerProps['aria-controls']}
      {disabled}
      onclick={disclosure.toggle}
    >
      <span>{title ?? ''}</span>
      <ChevronDownIcon
        class={unstyled
          ? resolveClassChain(isOpen ? 'rotate-180' : '', slotClasses?.chevron)
          : styles.chevron({ class: [isOpen ? 'rotate-180' : '', slotClasses?.chevron] })}
      />
    </button>
  {/if}

  <!-- `inert` while collapsed (Popover's pattern): the clipped children stay
       mounted for the grid-rows animation, so without it a keyboard user tabs
       into invisible controls (e.g. a CodeBlock copy button inside a collapsed
       ToolCallCard — WCAG 2.4.3/2.4.7) and the subtree stays in the a11y tree.

       The role and its name are Collapsible's own: the hook hands out no role,
       because a bare `<div>` is `generic` and would not expose a name at all.
       This panel is a section worth landing on, so it takes both. -->
  <div
    id={contentProps.id}
    role="region"
    aria-labelledby={triggerId}
    inert={contentProps.inert}
    class={unstyled
      ? (slotClasses?.content ?? '')
      : styles.content({ class: slotClasses?.content })}
    style="display:grid; grid-template-rows: {isOpen ? '1fr' : '0fr'};"
  >
    <div class="overflow-hidden">
      <div
        class={unstyled
          ? (slotClasses?.contentInner ?? '')
          : styles.contentInner({ class: slotClasses?.contentInner })}
      >
        {@render children()}
      </div>
    </div>
  </div>
</div>
