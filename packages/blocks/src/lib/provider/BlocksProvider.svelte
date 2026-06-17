<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ComponentDefaults, PresetMap } from './blocks-context';
  import { setBlocksConfig } from './blocks-context';

  let {
    unstyled = false,
    defaults = {},
    presets = {},
    children
  }: {
    unstyled?: boolean;
    defaults?: Record<string, ComponentDefaults>;
    /**
     * Named, project-defined visual styles per component.
     * Used via the `preset="..."` prop on supported components.
     * See `packages/docs-gen/templates/llms-full-template.md` → Customization for guidance.
     */
    presets?: PresetMap;
    children: Snippet;
  } = $props();

  setBlocksConfig({
    get unstyled() {
      return unstyled;
    },
    get defaults() {
      return defaults;
    },
    get presets() {
      return presets;
    }
  });
</script>

{@render children()}
