export interface MintConfig {
  trigger?: 'hover' | 'click' | 'focus' | 'load';
  duration?: number;
  delay?: number;
  easing?: string;
  disabled?: boolean;
}

export interface Mint<TConfig extends MintConfig = MintConfig> {
  /** Called once after element is in the DOM */
  init(el: HTMLElement, config?: TConfig): void;

  /** Optional cleanup */
  destroy?(el: HTMLElement): void;

  /** Optional config updates */
  update?(el: HTMLElement, config: TConfig): void;
}

export type MintFactory<TConfig extends MintConfig = MintConfig> = (
  config?: TConfig
) => Mint<TConfig>;

export interface MintInstance {
  mint: Mint;
  destroy: () => void;
}

// Specific mint configs
export interface MicroInteractionConfig extends MintConfig {
  intensity?: number;
  transformOrigin?: string;
}

export interface RippleConfig extends MintConfig {
  color?: string;
  opacity?: number;
  size?: number;
}

export interface CompositeConfig extends MintConfig {
  mints: Array<string | { name: string; config?: MintConfig }>;
}

// Polymorphic mint property type
export type MintProp =
  | string
  | { name: string; config?: MintConfig & Record<string, unknown> }
  | Array<string>
  | Array<string | { name: string; config?: MintConfig & Record<string, unknown> }>;
