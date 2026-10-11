export { default as BlocksProvider } from './BlocksProvider.svelte';
export {
  type BlocksConfig,
  type BlocksDefaults,
  type BlocksPresets,
  type ComponentDefaults,
  type ComponentPreset,
  type ConditionalOverride,
  getBlocksConfig,
  mergeSlotClasses,
  type PresetMap,
  resolveOverrideSlotClasses,
  resolvePresetSlotClasses,
  resolveSlotClasses
} from './blocks-context';
export type { ComponentSlotMap, SlotOf, ThemePropsOf } from './component-slots';
export { STYLE_PROPS, type StyleProp, type StylePropsOf, useThemeProps } from './theme-props';
