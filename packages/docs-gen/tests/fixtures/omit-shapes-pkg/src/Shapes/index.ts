import type {
  AliasBase,
  GenericBase,
  MidProps,
  MidWithDom,
  OtherProps,
  RootProps,
  WidgetProps
} from '../shared/base';
import type { FieldProps } from '../shared/field.variants';

/** Omit over a derived interface. */
export interface OmitTwoLevelProps extends Omit<MidProps, 'a'> {
  /** Own. */
  own?: string;
}

/** Omit over an Omit. */
export interface NestedOmitProps extends Omit<Omit<MidProps, 'a'>, 'b'> {
  /** Own. */
  own?: string;
}

/** Omit over an intersection. */
export interface IntersectionOmitProps extends Omit<MidProps & OtherProps, 'a'> {
  /** Own. */
  own?: string;
}

/** Omit over an object type alias. */
export interface AliasOmitProps extends Omit<AliasBase, 'e'> {
  /** Own. */
  own?: string;
}

/** Two clauses that both bring `size`; the first one's declaration is the type's. */
export interface TwoClausesProps extends Omit<MidProps, 'a' | 'b'>, Pick<OtherProps, 'size' | 'd'> {
  /** Own. */
  own?: string;
}

/** The same two clauses the other way round. */
export interface TwoClausesReversedProps
  extends Pick<OtherProps, 'size' | 'd'>,
    Omit<MidProps, 'a' | 'b'> {
  /** Own. */
  own?: string;
}

/** Pick across two levels. */
export interface PickTwoLevelProps extends Pick<MidProps, 'a' | 'size'> {
  /** Own. */
  own?: string;
}

/** Omit by `keyof` another interface. */
export interface OmitKeyofProps extends Omit<MidProps, keyof RootProps> {
  /** Own. */
  own?: string;
}

/** Omit over an interface that itself omits from a DOM-like bag. */
export interface OmitDomProps extends Omit<MidWithDom, 'title'> {
  /** Own. */
  own?: string;
}

/** Omit over an instantiated generic. */
export interface GenericOmitProps extends Omit<GenericBase<string>, 'g'> {
  /** Own. */
  own?: string;
}

/** Omit over a generic still open in the props type. */
export interface OpenGenericProps<T> extends Omit<GenericBase<T>, 'g'> {
  /** Own. */
  own?: T;
}

/** Omit over a mapped type of an interface. */
export interface PartialOmitProps extends Omit<Partial<MidProps>, 'a'> {
  /** Own. */
  own?: string;
}

/** Omit whose every member is declared outside the package (lib.dom). */
export interface ForeignOmitProps extends Omit<Partial<ARIAMixin>, 'role'> {
  /** Own. */
  own?: string;
}

/** Omit that resolves to no member at all. */
export interface NothingOmitProps extends Omit<Record<never, string>, 'x'> {
  /** Own. */
  own?: string;
}

/** Pick that resolves to no member at all. */
export interface NothingPickProps extends Pick<Record<never, string>, never> {
  /** Own. */
  own?: string;
}

/** A tv() axis through Omit of a props interface, not redeclared. */
export interface BareAxisProps extends Omit<WidgetProps, 'label'> {
  /** Own. */
  own?: string;
}

/** The same clause with the axis redeclared. */
export interface DeclaredAxisProps extends Omit<WidgetProps, 'label'> {
  /** Own. */
  own?: string;
  /**
   * Row spacing, forwarded to the widget.
   * @default 'roomy'
   */
  density?: WidgetProps['density'];
}

/** A tv() axis through Pick of a props interface, not redeclared. */
export interface BarePickAxisProps extends Pick<WidgetProps, 'density' | 'label'> {
  /** Own. */
  own?: string;
}

/** The NumberInput shape: a wrapper that redeclares the axes of the field it wraps. */
export interface WrapFieldProps extends Omit<FieldProps, 'label'> {
  /**
   * Radius tier, forwarded to the field.
   * @default 'modify'
   */
  tier?: FieldProps['tier'];
  /**
   * Field size, forwarded to the field.
   * @default 'md'
   */
  size?: FieldProps['size'];
}
