<!--
  CoreSpinner — the bare rotating-arc SVG shared by embedding contexts (loading
  Button, and any internal surface that needs an inline busy indicator) WITHOUT
  pulling in the public Spinner.

  INTERNAL — never exported from the package barrel, no docs/MCP entry. For a
  configurable spinner (variants, speed, intent palette, sr-only label, unstyled
  / slotClasses) use the public `Spinner`; this core is deliberately fixed to the
  default variant at 1s.

  No `role` / `aria-*` / sr-only label here on purpose: the embedding context
  owns the semantics. Button wraps this in an `aria-hidden` span and announces
  loading via its own `aria-busy`; a `role="status"` here would nest a live
  region inside contexts that already declare one (e.g. Toast). The geometry is
  imported from `spinner-geometry.ts` so it can never drift from the public
  Spinner.
-->
<script lang="ts">
  import { SPINNER_ARC_PATH } from './spinner-geometry';

  let {
    size = 'md',
    class: className = ''
  }: {
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** Extra classes on the wrapper span (the call site supplies visual identity). */
    class?: string;
  } = $props();

  // Matches the public Spinner's per-size box (spinner.variants → base sizes).
  const sizeClass = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
</script>

<span class={['inline-flex items-center justify-center text-current', sizeClass[size], className]}>
  <svg
    class="w-full h-full animate-spin [animation-duration:1s] motion-reduce:animate-none"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25" />
    <path class="fill-current" d={SPINNER_ARC_PATH} />
  </svg>
</span>
