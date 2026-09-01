import { createOptionalContext } from '$lib/utils/optional-context';

/**
 * What a wrapper hands down to the one component it wraps, so that component
 * resolves the wrapper's cascade against the props it is actually rendering
 * with.
 *
 * A wrapper (NumberInput over Input, ConfirmDialog over Dialog) resolves under
 * its **own** name, or a preset written for the number field would dress every
 * text field under the provider. But the state an `overrides` rule is matched
 * against lives one level down: the inner component reads `tier` off a context,
 * computes `messageType` from `error`, coerces the `error` string to the
 * boolean its axis is, and owns `open` outright. None of that is knowable above
 * it, and a rule matched against a stand-in built from what the caller wrote
 * fires on a state the component is not in — which paints, and so reads as a
 * success.
 *
 * So the name travels down and the resolution happens where the axes are. What
 * a wrapper contributes is exactly a name, a `preset` and its instance
 * `slotClasses`.
 *
 * **Down, not up.** A wrapper reading the inner component's resolved state back
 * would run its `$derived` before the child exists, so the server pass and the
 * first client pass would disagree — a flash in precisely the classes this
 * cascade places. Downward is synchronous, identical on both passes, and has no
 * cycle to break.
 */
export interface WrapperCascade {
  /** The name the cascade resolves under — the key the consumer types. */
  readonly component: string;
  readonly preset: string | undefined;
  readonly slotClasses: Record<string, string | undefined> | undefined;
  /**
   * The record the inner component resolved under {@link component}. A wrapper
   * with markup of its own reads its slots off this rather than resolving a
   * second time — NumberInput's stepper is the case: it renders as Input's
   * `rightIcon`, so Input's body has run by the time the snippet does, on the
   * server as in the browser.
   *
   * Installed by {@link consumeWrapperCascade}, which cannot be called without
   * supplying it, so a cascade that reached a component carries that
   * component's answer before any markup of either one renders.
   */
  resolved: () => Record<string, string>;
}

/** The two reactive fields a wrapper supplies; the name is passed separately. */
export type WrapperCascadeSource = Pick<WrapperCascade, 'preset' | 'slotClasses'>;

const [getWrapperCascade, setCascadeContext] = createOptionalContext<WrapperCascade>();

/**
 * Address the cascade below this wrapper, and hand back the object the wrapper
 * reads {@link WrapperCascade.resolved} off.
 *
 * The name is a string literal argument rather than a field of `source` so that
 * one pattern finds it wherever a component declares the name it resolves
 * under — `provider/__fixtures__/cascade-registry.ts` reads both this call and
 * `resolveSlotClasses` with it, and a name it cannot find is a component the
 * whole cascade sweep skips.
 *
 * `source` is read through, never copied: `preset` and `slotClasses` are props,
 * and this object outlives their current reading.
 */
export function setWrapperCascade(component: string, source: WrapperCascadeSource): WrapperCascade {
  const cascade: WrapperCascade = {
    component,
    get preset() {
      return source.preset;
    },
    get slotClasses() {
      return source.slotClasses;
    },
    // Overwritten the moment a component consumes this cascade. It stands in
    // for the answer of a component that never ran, which is what a wrapper
    // rendering no inner component would read.
    resolved: () => ({})
  };
  setCascadeContext(cascade);
  return cascade;
}

/**
 * Take the cascade addressed to this component off the context, publishing what
 * this component resolves it to in the same move.
 *
 * `publish` is a parameter rather than a later assignment so that consuming
 * without publishing is unrepresentable: a wrapper's own slots would otherwise
 * read an empty record from a component that had resolved them, and only a
 * wrapper that has such slots would ever notice. It is read lazily, so a
 * `$derived` declared *after* this call is a valid thing to close over — the
 * caller's binding is initialised long before any markup calls it.
 *
 * Consume-once: a cascade is addressed to the **one** component its wrapper
 * wraps, and everything below that is ordinary markup — the `<Input>` a
 * consumer writes into a `<ConfirmDialog>` body is a child of the Dialog, and
 * would otherwise wear the confirmation's rungs.
 */
export function consumeWrapperCascade(
  publish: () => Record<string, string>
): WrapperCascade | undefined {
  const cascade = getWrapperCascade();
  if (!cascade) return undefined;
  cascade.resolved = publish;
  setCascadeContext(undefined);
  return cascade;
}
