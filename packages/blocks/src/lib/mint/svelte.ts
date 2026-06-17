import { onDestroy, onMount } from 'svelte';
import { mintRegistry } from './registry';
import type { MintProp } from './types';

/**
 * Svelte 5 action for mints
 */
export function mint(node: HTMLElement, params: MintProp) {
  let cleanup: (() => void) | undefined;

  const apply = (p: MintProp) => {
    // Clean up previous mints
    cleanup?.();

    // Apply new mints
    cleanup = mintRegistry.apply(node, p);
  };

  apply(params);

  return {
    update(newParams: MintProp) {
      apply(newParams);
    },
    destroy() {
      cleanup?.();
    }
  };
}

/**
 * Svelte 5 composable for mints
 */
export function useMint(element: HTMLElement | undefined, mints: MintProp) {
  let cleanup: (() => void) | undefined;

  onMount(() => {
    if (!element) return;

    cleanup = mintRegistry.apply(element, mints);
  });

  onDestroy(() => {
    cleanup?.();
  });
}
