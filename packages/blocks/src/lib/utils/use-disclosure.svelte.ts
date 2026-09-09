/**
 * `useDisclosure` — the show/hide contract of a disclosure (trigger +
 * controlled region) without any of the markup: the open state, the single
 * mutation point, and the ARIA pair that links the two elements.
 *
 * Collapsible already gets that wiring right, but only inside its own layout —
 * a root `<div>` around a trigger and an animated region. A disclosure whose
 * revealed content is a SIBLING (the next row of the same grid, a panel in
 * another column, a detail strip below a virtualised list) cannot use it and
 * has to hand-write `aria-expanded` / `aria-controls` / `inert`. This hook is
 * that wiring on its own; Collapsible consumes it, so both readings come from
 * one place.
 *
 * **The caller owns the ids.** `$props.id()` is only valid as a component
 * top-level initializer, so the two-step pattern stays at the call site and
 * the hook just takes the results. That also keeps it usable from a test or a
 * non-component module.
 *
 * **Controlled vs uncontrolled** follows the same family contract as
 * Collapsible (`docs/COMPONENT-API-CONVENTIONS.md` § Open-state vocabulary):
 * without `open` the hook holds the state itself and `onOpenChange` only
 * reports; with `open` the caller is the source of truth and MUST apply every
 * `onOpenChange` — the hook never writes to a state it does not own.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useDisclosure } from '@urbicon-ui/blocks';
 *
 *   let open = $state(false);
 *   const propsId = $props.id();
 *   const detail = useDisclosure(() => ({
 *     open,
 *     triggerId: `row-${propsId}-trigger`,
 *     contentId: `row-${propsId}-detail`,
 *     onOpenChange: (next) => (open = next)
 *   }));
 * </script>
 *
 * <!-- Trigger and content are siblings on one grid, not nested. -->
 * <div class="grid grid-cols-[1fr_auto]">
 *   <span>Rebuild the deployment pipeline</span>
 *   <button {...detail.triggerProps} onclick={detail.toggle}>Details</button>
 *   <div {...detail.contentProps} class="col-span-2">…</div>
 * </div>
 * ```
 */

/** Attributes for the control that opens and closes the region. */
export interface DisclosureTriggerProps {
  readonly id: string;
  readonly 'aria-expanded': boolean;
  readonly 'aria-controls': string;
  /**
   * `aria-disabled`, not the native `disabled` attribute: a disabled native
   * button drops out of the tab order, so a keyboard user cannot reach the
   * control that explains why the region will not open. Spread these onto a
   * native `<button>` and it stays focusable while {@link
   * UseDisclosureReturn.toggle} refuses to act. A caller that wants the native
   * semantics instead sets `disabled` itself and leaves this one off.
   */
  readonly 'aria-disabled': true | undefined;
}

/** Attributes for the region the trigger reveals. */
export interface DisclosureContentProps {
  readonly id: string;
  readonly 'aria-labelledby': string;
  /**
   * `inert` while collapsed. The region is expected to stay mounted (a height
   * or grid-rows animation needs it), and a mounted-but-hidden subtree is both
   * tabbable and in the accessibility tree without this.
   */
  readonly inert: boolean;
}

export interface UseDisclosureInputs {
  /**
   * Controlled open state. Leave it `undefined` for the uncontrolled mode, in
   * which the hook holds the state.
   */
  open?: boolean;
  /** Uncontrolled seed. Read once, on the first call — later changes are ignored. */
  defaultOpen?: boolean;
  /**
   * Fired once per transition, after the state the hook owns has been applied.
   * In the controlled mode this is the only notification the caller gets, and
   * applying it is what moves `open`.
   */
  onOpenChange?: (open: boolean) => void;
  /** Refuse to toggle, and report `aria-disabled` on the trigger. */
  disabled?: boolean;
  /** DOM id of the trigger. Compute it once in the caller via `$props.id()`. */
  triggerId: string;
  /** DOM id of the region the trigger controls. */
  contentId: string;
}

export interface UseDisclosureReturn {
  /** Whether the region is expanded — the controlled value when given, else the hook's own. */
  readonly open: boolean;
  /** Flip the state. A no-op while `disabled`. */
  toggle: () => void;
  readonly triggerProps: DisclosureTriggerProps;
  readonly contentProps: DisclosureContentProps;
}

/** The ARIA half, as a pure function of the state. Unit-tested directly. */
export function computeDisclosureAria(input: {
  open: boolean;
  disabled?: boolean;
  triggerId: string;
  contentId: string;
}): { triggerProps: DisclosureTriggerProps; contentProps: DisclosureContentProps } {
  return {
    triggerProps: {
      id: input.triggerId,
      'aria-expanded': input.open,
      'aria-controls': input.contentId,
      'aria-disabled': input.disabled ? true : undefined
    },
    contentProps: {
      id: input.contentId,
      'aria-labelledby': input.triggerId,
      inert: !input.open
    }
  };
}

/**
 * Reactive wrapper around {@link computeDisclosureAria} plus the uncontrolled
 * state. Inputs arrive as ONE getter — the same shape `useFormField` takes —
 * so every field is re-read on each change and a plain value cannot freeze the
 * hook at the state it had on the first render.
 */
export function useDisclosure(inputs: () => UseDisclosureInputs): UseDisclosureReturn {
  // Seeded once. A `defaultOpen` that later changes must not clobber an
  // interaction the user already made.
  let uncontrolled = $state(inputs().defaultOpen ?? false);
  const open = $derived(inputs().open ?? uncontrolled);
  const aria = $derived(
    computeDisclosureAria({
      open,
      disabled: inputs().disabled,
      triggerId: inputs().triggerId,
      contentId: inputs().contentId
    })
  );

  function toggle() {
    const current = inputs();
    if (current.disabled) return;
    const next = !open;
    // The hook writes only the state it owns. In the controlled mode the write
    // is the caller's, out of `onOpenChange` — which is why an ignored callback
    // there leaves the trigger reporting a state that never changed.
    if (current.open === undefined) uncontrolled = next;
    current.onOpenChange?.(next);
  }

  return {
    get open() {
      return open;
    },
    toggle,
    get triggerProps() {
      return aria.triggerProps;
    },
    get contentProps() {
      return aria.contentProps;
    }
  };
}
