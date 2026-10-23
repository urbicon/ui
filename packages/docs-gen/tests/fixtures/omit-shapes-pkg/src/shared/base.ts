/**
 * Bases for every shape an `Omit` / `Pick` clause can take. The members carry
 * JSDoc and `@default` so a test can tell which declaration a row was read from.
 */

/** A DOM-like bag declared inside the package, so its members count as the package's own. */
export interface DomBag {
  /** Element id. */
  id?: string;
  /** Class list. */
  class?: string;
  /** Tooltip text. */
  title?: string;
}

export interface RootProps {
  /**
   * Root a.
   * @default 'x'
   */
  a?: string;
  /** Root tone. */
  tone?: 'calm' | 'loud';
}

export interface MidProps extends RootProps {
  /** Mid b. */
  b?: number;
  /**
   * Mid size.
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
}

export interface MidWithDom extends MidProps, Omit<DomBag, 'class'> {
  /** Mid own c. */
  c?: boolean;
}

export interface OtherProps {
  /** Other size, same type as Mid size. */
  size?: 'sm' | 'md' | 'lg';
  /** Other d. */
  d?: string;
}

export type AliasBase = {
  /** Alias e. */
  e?: string;
  /** Alias f. */
  f?: number;
};

export interface GenericBase<T> {
  /** Generic value. */
  value?: T;
  /** Generic list. */
  items?: T[];
  /** Plain g. */
  g?: string;
}

/** A base whose callback is a method signature rather than a property. */
export interface MethodBaseProps {
  /** Method label. */
  label?: string;
  /** Fired with the picked value. */
  onPick?(value: string): void;
  /** Left out by the clauses below. */
  hidden?: boolean;
}

type VariantProps<T> = {
  [K in keyof T]?: keyof T[K];
};

/** A tv() config: the axes are keys of an object literal, documented by nothing. */
const widgetVariants = {
  density: { roomy: {}, compact: {} },
  internal: { on: {}, off: {} }
};

export type WidgetVariants = VariantProps<typeof widgetVariants>;

/** A config axis whose values are a shared object, named rather than written out. */
const spacingScale = { roomy: {}, compact: {} };
const panelVariants = { spacing: spacingScale };

export type PanelVariants = VariantProps<typeof panelVariants>;

export interface PanelProps extends PanelVariants {
  /** Panel label. */
  label?: string;
}

/** A props interface whose axes arrive through the variants alias. */
export interface WidgetProps extends Omit<WidgetVariants, 'internal'> {
  /** Widget label. */
  label?: string;
}
