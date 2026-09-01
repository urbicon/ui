<script lang="ts">
  import { buttonGroupVariants, type ButtonGroupVariants } from '$lib/primitives';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { composeHandlers } from '$lib/utils/compose-handlers';
  import { edgeEnabledIndex, nextEnabledIndex } from '$lib/utils';
  import { getTierContext, setTierContext } from '$lib/utils/tier-context';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { ButtonGroupContext, ButtonGroupProps } from './index';
  import { setButtonGroupContext } from './buttonGroup.context';

  let {
    children,
    orientation = 'horizontal',
    connected = true,
    size = 'md',
    intent = 'neutral',
    variant = 'outlined',
    tier,
    selection = 'none',
    value = $bindable(),
    disabled = false,
    mint = 'none',
    onSelectionChange,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ariaLabel,
    ariaLabelledBy,
    // Pulled out of restProps so the `{...restProps}`-first spread (internal
    // attributes win — see docs/COMPONENT-API-CONVENTIONS.md) can't clobber
    // it: the roving keyboard navigation below is composed with a consumer's
    // own handler (internal first, consumer second) instead of either side
    // silently replacing the other.
    onkeydown: onkeydownProp,
    ...restProps
  }: ButtonGroupProps = $props();

  // Tier precedence: own prop → outer TierContext (e.g. Toolbar) → orientation
  // default. Re-propagate as our own TierContext so child Buttons inherit our
  // tier (and not the outer one) when we override.
  //
  // Why the fallback is orientation-aware: `commit` caps the group's outer
  // corners at the pill radius, which is right horizontally (that IS the
  // segmented-control pill — the cap is clamped to half the button height, the
  // group's short side). Vertically the same cap is clamped by the *width*, so
  // a stacked group of text buttons domes top and bottom into a lozenge (#194).
  // Only the unset default softens; an explicit `tier="commit"` still gets the
  // capsule, which is what a narrow icon-only stack wants — a judgement about
  // the content that CSS cannot make. A wrapping Toolbar's TierContext counts as
  // set for the same reason (it is a deliberate setting one level out), so a
  // vertical group inside `<Toolbar tier="commit">` is a capsule too; Toolbar
  // itself defaults to `modify`. Disconnected groups have no caps at all, so
  // they keep the pill default their individual buttons read as.
  const outerTierCtx = getTierContext();
  const defaultTier = $derived(connected && orientation === 'vertical' ? 'modify' : 'commit');
  const effectiveTier = $derived(tier ?? outerTierCtx?.tier ?? defaultTier);
  setTierContext({
    get tier() {
      return effectiveTier;
    }
  });

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: ButtonGroupVariants = $derived({
    orientation,
    connected,
    tier: effectiveTier,
    disabled
  });
  const styles = $derived(buttonGroupVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'ButtonGroup',
      preset,
      variantProps,
      slotClassesProp,
      buttonGroupVariants.config
    )
  );

  let selectedValues = $state<Set<string>>(new Set());

  $effect(() => {
    if (selection === 'single' && typeof value === 'string') {
      selectedValues = new Set(value ? [value] : []);
    } else if (selection === 'multiple' && Array.isArray(value)) {
      selectedValues = new Set(value);
    } else {
      selectedValues = new Set();
    }
  });

  // Bumped (deferred to a microtask — registration runs during the child's
  // render, where a synchronous $state write would be state_unsafe_mutation)
  // whenever a Button registers, so the roving effect below re-runs for
  // buttons mounted *after* the group's initial render. Without it a
  // runtime-added radio kept its native tabbability until the next selection
  // change — a second tab stop in the radiogroup.
  let registryVersion = $state(0);
  let registryBumpQueued = false;

  function noteRegistration() {
    if (registryBumpQueued) return;
    registryBumpQueued = true;
    queueMicrotask(() => {
      registryBumpQueued = false;
      registryVersion++;
    });
  }

  function registerButton(buttonValue: string | undefined) {
    noteRegistration();
    return {
      get isSelected() {
        return buttonValue ? selectedValues.has(buttonValue) : false;
      },
      onClick() {
        if (disabled || !buttonValue || selection === 'none') return;

        // Local-only copy, not stored in state.
        const next = new Set(selectedValues);

        if (selection === 'single') {
          next.clear();
          if (!selectedValues.has(buttonValue)) next.add(buttonValue);
          selectedValues = next;
          value = next.size > 0 ? buttonValue : undefined;
        } else if (selection === 'multiple') {
          if (next.has(buttonValue)) next.delete(buttonValue);
          else next.add(buttonValue);
          selectedValues = next;
          value = Array.from(next);
        }

        onSelectionChange?.(value, Array.from(selectedValues));
      },
      getButtonProps() {
        // A value-less Button is an action button, not a selection option, so
        // it gets no radio/checkbox role. Selection options additionally carry
        // their value as `data-value`, committed in the same render as the
        // role — the radiogroup resolves the selected radio by *matching
        // value* against the queried elements, so duplicate values and
        // runtime-mounted/removed buttons can never drift an index space.
        if (selection === 'none' || !buttonValue) return {};
        const checked = selectedValues.has(buttonValue);
        return {
          role: selection === 'single' ? ('radio' as const) : ('checkbox' as const),
          'aria-checked': checked,
          'data-value': buttonValue
        };
      }
    };
  }

  setButtonGroupContext({
    get orientation() {
      return orientation;
    },
    get connected() {
      return connected;
    },
    get size() {
      return size;
    },
    get intent() {
      return intent;
    },
    get variant() {
      return variant;
    },
    get selection() {
      return selection;
    },
    get disabled() {
      return disabled;
    },
    get mint() {
      return mint;
    },
    get selectedValues() {
      return selectedValues;
    },
    registerButton
  });

  let containerElement = $state<HTMLDivElement>();

  // Single-select is a WAI-ARIA radiogroup: ONE tab stop, arrow keys move the
  // selection (roving tabindex). Tab/SegmentGroup drive this from a value→element
  // registry their own item components populate; ButtonGroup's items are shared
  // <Button>s (outside this component), so the radiogroup owns the roving from
  // the container instead — it queries the radio *elements* from the DOM (for
  // focus + disabled state), reads the *selected* one from reactive state (see
  // selectedRadioIndex), reuses the shared index math (utils/roving), skips
  // disabled radios, and drives selection by clicking the target radio (Button's
  // own click handler does the rest). `multiple`/`none` keep every button
  // natively tabbable (checkbox-group / plain toolbar convention — not roved).
  function rovingRadios(): HTMLButtonElement[] {
    return containerElement
      ? Array.from(containerElement.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
      : [];
  }

  // Position of the selected radio within the queried elements: each radio
  // carries its value as `data-value` (same render commit as its role), and
  // the *selected* one is read from the reactive selection — not the DOM's
  // aria-checked, which a parent effect can observe before the child
  // <Button>s commit it. Matching by value (not by a parallel registration
  // index) keeps duplicates and runtime-mounted/removed buttons correct: the
  // tab stop sticks to the element whose value is selected, wherever it sits.
  function selectedRadioIndex(radios: readonly HTMLButtonElement[]): number {
    return radios.findIndex((radio) => {
      const v = radio.dataset.value;
      return v !== undefined && selectedValues.has(v);
    });
  }

  $effect(() => {
    // `registryVersion` re-runs the assignment when Buttons mount after the
    // group's initial render (the DOM query itself is not reactive).
    void registryVersion;
    if (selection !== 'single' || !containerElement) return;
    const radios = rovingRadios();
    if (radios.length === 0) return;

    const checkedIndex = selectedRadioIndex(radios);
    // Nothing selected yet → the first enabled radio holds the tab stop, so the
    // group stays reachable with Tab (standard radiogroup entry behaviour).
    const activeIndex =
      checkedIndex >= 0
        ? checkedIndex
        : edgeEnabledIndex(radios.length, 1, (i) => radios[i].disabled);

    radios.forEach((radio, i) => {
      radio.tabIndex = i === activeIndex ? 0 : -1;
    });

    // Restore native tabbability when the group stops roving (selection flips
    // away from single, or it unmounts) — otherwise the imposed -1 would strand
    // the buttons out of the tab order. Queried fresh at teardown time so
    // radios mounted since this run are restored too.
    return () => {
      for (const radio of rovingRadios()) radio.removeAttribute('tabindex');
    };
  });

  // A disabled radio renders a `<button disabled>`, which can't hold focus, so
  // arrow navigation must step over it — otherwise selection strands on an
  // unfocusable radio (aria-checked set, focus stuck on the previous one). The
  // index math lives in the shared roving helpers (utils/roving).
  function handleKeyDown(event: KeyboardEvent) {
    if (disabled || selection !== 'single') return;

    const radios = rovingRadios();
    if (radios.length === 0) return;

    const currentIndex = selectedRadioIndex(radios);
    const isDisabled = (i: number) => radios[i].disabled;
    let newIndex: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        newIndex = nextEnabledIndex(radios.length, currentIndex, 1, isDisabled);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        newIndex = nextEnabledIndex(radios.length, currentIndex, -1, isDisabled);
        break;
      case 'Home':
        event.preventDefault();
        newIndex = edgeEnabledIndex(radios.length, 1, isDisabled);
        break;
      case 'End':
        event.preventDefault();
        newIndex = edgeEnabledIndex(radios.length, -1, isDisabled);
        break;
      default:
        return;
    }

    if (newIndex !== currentIndex && newIndex >= 0) {
      const target = radios[newIndex];
      target.click(); // Button's own click handler performs the selection
      target.focus();
    }
  }

  const ariaRole = $derived(selection === 'single' ? 'radiogroup' : 'group');
  // ARIA allows `aria-orientation` on `radiogroup`, not on `group` — emitting it
  // on the multi-selection arm is an `aria-allowed-attr` violation. The visual
  // orientation is unaffected; it comes from the variant classes, not from ARIA.
  const ariaOrientation = $derived(ariaRole === 'radiogroup' ? orientation : undefined);
</script>

<!--
  restProps spreads FIRST so component-owned state wins (COMPONENT-API-CONVENTIONS
  §restProps ordering) — a consumer role/tabindex through restProps must not
  defeat the radiogroup semantics. The attributes after the spread are
  conditional merges, not plain overrides, because an explicit `undefined`
  after a spread REMOVES the attribute:
  - role: always internally computed (radiogroup/group) — internal wins outright.
  - aria-label / aria-labelledby: the dedicated props win, a consumer's own
    `aria-label`/`aria-labelledby` through restProps is the fallback.
  - aria-orientation: internal on the radiogroup arm; on the `group` arm it is
    actively removed even against restProps — ARIA disallows aria-orientation
    on role=group (aria-allowed-attr), mirroring Button's aria-pressed force-off.
  - aria-disabled: internal `true` is unoverridable, idle falls back to the
    consumer value; the default DOM output stays byte-identical (attr absent).
  - onkeydown is destructured (never in restProps) and composed: the roving
    keyboard nav always runs, a consumer handler runs after it.
-->
<div
  bind:this={containerElement}
  {...restProps}
  role={ariaRole}
  class={unstyled
    ? resolveClassChain(slotClasses?.base, className)
    : styles.base({ class: [slotClasses?.base, className] })}
  aria-label={ariaLabel ?? restProps['aria-label']}
  aria-labelledby={ariaLabelledBy ?? restProps['aria-labelledby']}
  aria-orientation={ariaOrientation}
  aria-disabled={disabled || restProps['aria-disabled'] || undefined}
  onkeydown={composeHandlers(handleKeyDown, onkeydownProp)}
>
  {@render children?.()}
</div>
