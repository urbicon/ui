/**
 * `composeHandlers` — run a component's own DOM event handler *and* a
 * consumer-supplied one that arrived through `restProps`.
 *
 * ## Why this exists
 *
 * The library's `restProps` contract (see docs/COMPONENT-API-CONVENTIONS.md)
 * spreads `{...restProps}` **first**, so the component's own attributes win: a
 * consumer can't silently cancel state the component owns. Applied naively to
 * event handlers that rule would go too far in the other direction — a
 * `restProps`-first spread makes the component's `onkeydown` clobber the
 * *consumer's*, which is just the original bug pointed the other way.
 *
 * Neither side should lose. Handlers are additive by nature (the DOM itself
 * allows many listeners per event), so the component destructures the handler
 * out of `restProps` and composes it: **internal first, consumer second**.
 *
 * ## Ordering: internal first
 *
 * 1. The component's behaviour is then unconditional — it cannot be skipped by
 *    a consumer handler that throws, which is exactly what "internal wins"
 *    has to mean for a dismiss/focus-trap path.
 * 2. The consumer observes the event *after* the component reacted, so
 *    `event.defaultPrevented` tells them whether the component claimed it
 *    (e.g. Dialog preventDefaults `Escape` when it closes on it).
 *
 * ## `preventDefault` is deliberately NOT a veto
 *
 * The consumer's handler runs after the internal one, so calling
 * `event.preventDefault()` there cannot suppress the component's behaviour —
 * by design. Overloading `preventDefault` as "also disable this component's
 * dismissal" would re-create the silent-disable bug through a different door:
 * `preventDefault` has an established DOM meaning (suppress the *browser's*
 * default action), and a consumer calling it for that reason would lose
 * dismissal without ever asking to. Opting out of a behaviour is spelled with
 * the named, discoverable prop that already exists for it — `closeOnEscape`,
 * `closeOnBackdropClick` — not with a magic event side-effect.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   let { onkeydown: onkeydownProp, ...restProps }: Props = $props();
 *   function handleKeydown(event: KeyboardEvent) { ... }
 * </script>
 *
 * <dialog {...restProps} onkeydown={composeHandlers(handleKeydown, onkeydownProp)}>
 * ```
 */

/**
 * Structural mirror of svelte/elements' internal `EventHandler` type, which is
 * declared there but not exported. Matching the shape keeps the composed result
 * assignable to the `on*` props of `HTMLAttributes` (`MouseEventHandler<T>`,
 * `KeyboardEventHandler<T>`, …).
 */
type DomEventHandler<TEvent extends Event, TElement extends EventTarget> = (
  event: TEvent & { currentTarget: EventTarget & TElement }
) => unknown;

/**
 * Combine an internal handler with an optional consumer handler from `restProps`.
 *
 * The internal handler always runs first and always runs; the consumer handler
 * runs afterwards when present. See the module doc for the ordering and
 * `preventDefault` rationale.
 *
 * @param internal The component's own handler. Runs first, unconditionally.
 * @param consumer The consumer's handler from `restProps`. May be `null`/`undefined`.
 * @returns A handler assignable to the element's `on*` attribute.
 */
export function composeHandlers<TEvent extends Event, TElement extends EventTarget = Element>(
  internal: (event: TEvent & { currentTarget: EventTarget & TElement }) => unknown,
  consumer: DomEventHandler<TEvent, TElement> | null | undefined
): DomEventHandler<TEvent, TElement> {
  return (event) => {
    internal(event);
    consumer?.(event);
  };
}
