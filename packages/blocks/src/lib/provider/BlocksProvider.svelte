<script
  lang="ts"
  generics="TDefaults extends BlocksDefaults<TDefaults>, TPresets extends BlocksPresets<TPresets>"
>
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
    defaults = {} as TDefaults,
    presets = {} as TPresets,
    children
  }: {
    unstyled?: boolean;
    /**
     * Project-wide styling per component, keyed by the name the component
     * resolves under. Each entry is checked against that component's own slot
     * names; a name the library does not know keeps taking any key, which is
     * what a consumer's own wrapper needs.
     */
    defaults?: TDefaults;
    /**
     * Named, project-defined visual styles per component.
     * Used via the `preset="..."` prop on supported components.
     * See `packages/docs-gen/templates/llms-full-template.md` → Customization for guidance.
     */
    presets?: TPresets;
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
