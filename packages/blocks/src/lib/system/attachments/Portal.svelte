<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import { ClickOutside } from '..';
  import ContextIsolation from './ContextIsolation.svelte';

  interface Props {
    children: Snippet;
    target?: string | HTMLElement;
    className?: string;
    disabled?: boolean;
    clickAway?: boolean;
    onoutclick?: () => void;
    ignore?: Element | Element[];
    onMount?: (element: Element, targetElement: Element) => void;
    onUnmount?: (element: Element, targetElement: Element) => void;
    /**
     * Whether to isolate portal content from parent contexts (like ButtonGroup).
     * This prevents parent context values from bleeding into portal content.
     * @default true
     */
    isolateContext?: boolean;
    /**
     * Specific contexts to isolate from. Only used if isolateContext is true.
     * @default ['buttonGroup']
     */
    isolateContexts?: string[];
  }

  let {
    children,
    target = 'body',
    className = '',
    disabled = false,
    clickAway = true,
    ignore = [],
    onoutclick = () => {},
    onMount,
    onUnmount,
    isolateContext = true,
    isolateContexts = ['buttonGroup']
  }: Props = $props();

  const portal: Attachment = (node: Element) => {
    if (disabled) return;

    const targetElement = typeof target === 'string' ? document.querySelector(target) : target;

    if (!targetElement) {
      console.warn(`Portal target not found: ${target}`);
      return;
    }

    if (className) {
      node.classList.add(...className.split(' '));
    }

    targetElement.appendChild(node);
    onMount?.(node, targetElement);

    return () => {
      onUnmount?.(node, targetElement);
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    };
  };
</script>

{#if !disabled}
  <div {@attach portal}>
    {#if isolateContext}
      <ContextIsolation isolate={isolateContexts}>
        {#if clickAway}
          <ClickOutside {ignore} {onoutclick}>
            {@render children()}
          </ClickOutside>
        {:else}
          {@render children()}
        {/if}
      </ContextIsolation>
    {:else if clickAway}
      <ClickOutside {ignore} {onoutclick}>
        {@render children()}
      </ClickOutside>
    {:else}
      {@render children()}
    {/if}
  </div>
{/if}
