<script lang="ts" generics="TDefaultKeys extends string, TPresetKeys extends string">
  import type { Snippet } from 'svelte';
  import type {
    BlocksDefaults,
    BlocksPresets,
    ComponentDefaults,
    PresetMap
  } from './blocks-context';
  import { setBlocksConfig } from './blocks-context';

  let {
    unstyled = false,
    defaults = {},
    presets = {},
    children
  }: {
    unstyled?: boolean;
    /**
     * Project-wide styling per component, keyed by the name the component
     * resolves under: `props` picks the look every instance takes when it sets
     * none itself (`{ Input: { props: { variant: 'underline' } } }`), and
     * `slotClasses` / `overrides` add classes on top. `props` takes style props
     * only — `variant`, `size`, `intent`, `tier` and the other looks the library
     * names — never behaviour or state such as `disabled` or `orientation`.
     * Each entry is checked against that component's own slot names and prop
     * types; a name the library does not know keeps taking any key, which is
     * what a consumer's own wrapper needs.
     */
    defaults?: BlocksDefaults<Record<TDefaultKeys, unknown>>;
    /**
     * Named, project-defined looks per component, applied where an instance
     * passes `preset="name"`. A preset carries the same keys as a `defaults`
     * entry and ranks above it, below the instance's own props and classes.
     * See `packages/docs-gen/templates/llms-full-template.md` → Customization for guidance.
     */
    presets?: BlocksPresets<Record<TPresetKeys, unknown>>;
    children: Snippet;
  } = $props();

  // Written per component name and read by one: the props above check each entry
  // against the slot names of the component its key names, while the cascade
  // looks entries up under a name it only has at runtime — including names from
  // outside this package (`@urbicon-ui/auth`, a consumer wrapper). The read side
  // is string-keyed for that reason, and this is where the two meet.
  setBlocksConfig({
    get unstyled() {
      return unstyled;
    },
    get defaults() {
      return defaults as Readonly<Record<string, ComponentDefaults>>;
    },
    get presets() {
      return presets as PresetMap;
    }
  });
</script>

{@render children()}
