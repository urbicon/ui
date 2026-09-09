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

/**
 * Attributes for the region the trigger reveals. No role: a bare `<div>` is
 * `generic`, which the accessible-name calculation skips, so a name handed to
 * one would not be exposed. Add `role="region"` plus
 * `aria-labelledby={triggerId}` yourself where the content is a section worth
 * landing on (what Collapsible does); a per-row detail strip stays roleless,
 * because a region per list row is landmark spam.
 */
export interface DisclosureContentProps {
  readonly id: string;
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
      inert: !input.open
    }
  };
}

/**
 * The show/hide contract of a disclosure — open state, one mutation point, and
 * the attributes that link trigger and region — without any markup. Collapsible
 * has the same wiring but only inside its own layout, so content that must be a
 * SIBLING of the trigger (the next row of one grid, a panel in another column)
 * cannot reach it; Collapsible consumes this hook, so both readings come from
 * one place.
 *
 * Inputs arrive as ONE getter — the shape `useFormField` takes — so every field
 * is re-read on each change and a value cannot freeze the hook at its first
 * render. `triggerId`/`contentId` come from the caller because `$props.id()` is
 * only valid as a component top-level initializer; that also keeps the hook
 * usable outside a component.
 *
 * Controlled and uncontrolled follow the family contract
 * (`docs/COMPONENT-API-CONVENTIONS.md` § Open-state vocabulary): without `open`
 * the hook holds the state and `onOpenChange` only reports; with `open` the
 * caller is the source of truth and must apply every `onOpenChange` — the hook
 * never writes a state it does not own.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useDisclosure } from '@urbicon-ui/blocks';
 *
 *   let open = $state(false);
 *   const propsId = $props.id();
 *
 *   const detail = useDisclosure(() => ({
 *     open,
 *     triggerId: `entry-${propsId}-trigger`,
 *     contentId: `entry-${propsId}-detail`,
 *     onOpenChange: (next) => (open = next)
 *   }));
 * </script>
 *
 * <div class="grid grid-cols-[1fr_auto]">
 *   <span>Rebuild the deployment pipeline</span>
 *   <button {...detail.triggerProps} type="button" onclick={detail.toggle}>Details</button>
 *   <!-- The revealed region is a sibling row spanning both columns. -->
 *   <div {...detail.contentProps} class="col-span-2">…</div>
 * </div>
 * ```
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
