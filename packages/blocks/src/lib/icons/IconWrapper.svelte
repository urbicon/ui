<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconProps } from './icon-types';
  import { buildSvgTransform } from './icon-transform';

  let {
    size,
    strokeWidth = 2,
    class: className,
    rotate,
    flip,
    animation,
    content,
    children,
    ...restProps
  }: IconProps & { content?: string; children?: Snippet } = $props();

  const transform = $derived(buildSvgTransform(rotate, flip));
  const classes = $derived(
    [className, animation === 'spin' ? 'icon-spin' : animation === 'pulse' ? 'icon-pulse' : null]
      .filter(Boolean)
      .join(' ') || undefined
  );

  /**
   * Strip the outer <svg> wrapper from a raw SVG string, returning only
   * the inner geometry (path, circle, etc.). The .svg files are valid
   * standalone SVGs for IDE preview; we strip the wrapper at runtime
   * because IconWrapper provides its own <svg> with dynamic props.
   */
  function stripSvgWrapper(raw: string): string {
    return raw
      .replace(/<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '')
      .trim();
  }

  /**
   * Svelte attachment to inject trusted SVG content into an SVG <g> element.
   * Uses .innerHTML because child elements must be created in the SVG
   * namespace, which {@html} cannot guarantee. Content is build-time-only:
   * sourced from our own .svg files via Vite `?raw` imports — never from
   * user input. Safe.
   */
  function svgHtml(svg: string | undefined) {
    return (node: SVGGElement) => {
      node.innerHTML = svg ? stripSvgWrapper(svg) : '';
    };
  }
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  class={classes}
  aria-hidden="true"
  {...restProps}
>
  {#if content}
    <g {transform} {@attach svgHtml(content)}></g>
  {:else if children}
    <g {transform}>
      {@render children()}
    </g>
  {/if}
</svg>

<style>
  @keyframes icon-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes icon-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  :global(.icon-spin) {
    animation: icon-spin 1s linear infinite;
  }
  :global(.icon-pulse) {
    animation: icon-pulse 2s ease-in-out infinite;
  }
</style>
