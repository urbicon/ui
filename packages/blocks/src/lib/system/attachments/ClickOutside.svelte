<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Attachment } from 'svelte/attachments';

  interface Props {
    children: Snippet;
    ignore?: Element | Element[];
    onoutclick?: () => void;
  }

  let { ignore = [], children, onoutclick = () => {} }: Props = $props();

  function clickOutside(ignore: Element | Element[]): Attachment {
    return (node: Element) => {
      const handleClick = (event: MouseEvent) => {
        if (!node || event.defaultPrevented) return;

        if (node.contains(event.target as Node)) return;

        if (ignore) {
          const ignoreElements = Array.isArray(ignore) ? ignore : [ignore];
          const isInsideIgnored = ignoreElements.some(
            (element: Element) => element && element.contains(event.target as Node)
          );
          if (isInsideIgnored) return;
        }

        node.dispatchEvent(new CustomEvent('outclick'));
      };

      document.addEventListener('click', handleClick, true);

      return () => {
        document.removeEventListener('click', handleClick, true);
      };
    };
  }
</script>

<div {@attach clickOutside(ignore)} {onoutclick}>
  {@render children()}
</div>
