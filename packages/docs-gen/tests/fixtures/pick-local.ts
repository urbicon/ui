/**
 * `Pick<LocalInterface, …>` where the base sits in the same file — the one
 * `Pick` shape single-file mode (no tsconfig, no program, no checker) can still
 * resolve, by intersecting the base interface's own members with the picked
 * keys.
 *
 * The counterpart to `omit-variants.ts`, which covers the same question for
 * `Omit`.
 */

/** Base props declared next to the component. */
export interface PickLocalBaseProps {
  /** Label text displayed above the widget. */
  label?: string;
  /** Size of the widget. @default 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Internal flag that consumers must not set. */
  hidden?: boolean;
}

/**
 * @description Pick-from-a-local-interface fixture.
 */
export interface PickLocalProps extends Pick<PickLocalBaseProps, 'label' | 'size'> {
  /** Click handler. */
  onclick?: (event: MouseEvent) => void;
}

/**
 * A utility type nothing resolves — the fallback still may not name a prop
 * after the *transformer*. `...Partial` is exactly as useless as the `...Pick`
 * this whole fixture exists for.
 *
 * @description Unresolved-utility fixture.
 */
export interface PartialFixtureProps extends Partial<PickLocalBaseProps> {
  /** Click handler. */
  onclick?: (event: MouseEvent) => void;
}
