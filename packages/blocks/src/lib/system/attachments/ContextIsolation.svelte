<script lang="ts">
  import type { Snippet } from 'svelte';
  import { setButtonGroupContext } from '../../primitives/ButtonGroup/buttonGroup.context';

  interface Props {
    children: Snippet;
    /**
     * Which contexts to isolate from parent scope. The string IDs are
     * mapped to known compound-context setters internally.
     * @default ['buttonGroup']
     */
    isolate?: string[];
    /**
     * Reserved for a future, more comprehensive isolation implementation.
     * Currently behaves identical to the default `isolate` list.
     * @default false
     */
    isolateAll?: boolean;
  }

  let { children, isolate = ['buttonGroup'] }: Props = $props();

  // Map of supported isolation IDs → context-setter that clears the value.
  // createContext keys are module-scoped Symbols, so callers can't pass them
  // directly; this stays string-based to keep the public API stable.
  const ISOLATIONS: Record<string, () => void> = {
    buttonGroup: () => setButtonGroupContext(undefined)
  };

  // Isolation is applied once at init — the prop is not meant to change reactively.
  // svelte-ignore state_referenced_locally
  for (const key of isolate) {
    ISOLATIONS[key]?.();
  }
</script>

{@render children()}
