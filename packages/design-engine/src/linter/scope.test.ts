import { describe, expect, it } from 'vitest';
import { lintDesign } from './linter.js';
import type { Finding } from './types.js';

function has(findings: Finding[], ruleId: string): boolean {
  return findings.some((f) => f.ruleId === ruleId);
}

/**
 * The regression pair for the code-view scoping (scope.ts):
 *  (1) sensitivity — a real violation in every class-bearing position is still
 *      found (nothing the whole-file scan caught in a real position is lost);
 *  (2) specificity — the same strings in prose/text content are NOT flagged
 *      (quoting an anti-pattern is not committing it).
 */
describe('code-view scoping — sensitivity (real violations still found)', () => {
  it('class="…" string attribute', () => {
    expect(has(lintDesign('<div class="bg-blue-500">x</div>').findings, 'raw-tailwind-color')).toBe(
      true
    );
  });

  it('class={…} conditional expression', () => {
    expect(
      has(
        lintDesign(`<div class={active ? 'bg-blue-500' : 'bg-surface-base'}>x</div>`).findings,
        'raw-tailwind-color'
      )
    ).toBe(true);
  });

  it('class={[…]} array syntax', () => {
    expect(
      has(
        lintDesign(`<div class={['p-4', cond && 'focus:ring-2']}>x</div>`).findings,
        'focus-not-visible'
      )
    ).toBe(true);
  });

  it('class={`…`} template literal (incl. broken interpolation)', () => {
    const { findings } = lintDesign('<div class={`dark:bg-red-500 py-${pad}`}>x</div>');
    expect(has(findings, 'dark-mode-override')).toBe(true);
    expect(has(findings, 'dynamic-class-interpolation')).toBe(true);
  });

  it('Svelte string-attr interpolation class="gap-{x}"', () => {
    expect(
      has(lintDesign('<div class="gap-{x}">x</div>').findings, 'dynamic-class-interpolation')
    ).toBe(true);
  });

  it('slotClasses={{ base: "…" }} object expression', () => {
    expect(
      has(
        lintDesign(`<Button slotClasses={{ base: 'bg-green-500 z-50' }}>Go</Button>`).findings,
        'raw-tailwind-color'
      )
    ).toBe(true);
    expect(
      has(
        lintDesign(`<Button slotClasses={{ base: 'z-50' }}>Go</Button>`).findings,
        'hardcoded-z-index'
      )
    ).toBe(true);
  });

  it('consumer *Class-named string attributes', () => {
    expect(
      has(lintDesign('<Field inputClass="text-red-500" />').findings, 'raw-tailwind-color')
    ).toBe(true);
  });

  it('class:directive names carry the class', () => {
    expect(
      has(lintDesign('<div class:bg-blue-500={cond}>x</div>').findings, 'raw-tailwind-color')
    ).toBe(true);
  });

  it('tv()-style config literals in a <script> block', () => {
    const code = [
      '<script lang="ts">',
      '  const styles = tv({',
      "    base: 'flex focus:outline-none',",
      "    variants: { intent: { danger: 'bg-red-500 duration-[250ms]' } }",
      '  });',
      '</script>'
    ].join('\n');
    const { findings } = lintDesign(code);
    expect(has(findings, 'raw-tailwind-color')).toBe(true);
    expect(has(findings, 'focus-not-visible')).toBe(true);
    expect(has(findings, 'hardcoded-motion')).toBe(true);
  });

  it('deep-internal-import in a <script> block', () => {
    const code =
      "<script>import Button from '@urbicon-ui/blocks/primitives/Button/Button.svelte';</script>";
    expect(has(lintDesign(code).findings, 'deep-internal-import')).toBe(true);
  });

  it('{@const} template expressions in text position', () => {
    expect(
      has(
        lintDesign(`{#if x}{@const cls = 'bg-blue-500'}<div class={cls}>x</div>{/if}`).findings,
        'raw-tailwind-color'
      )
    ).toBe(true);
  });

  it('@apply declarations in a <style> block', () => {
    const code = '<style>\n  .btn { @apply bg-blue-500 focus:ring-2; }\n</style>';
    const { findings } = lintDesign(code);
    expect(has(findings, 'raw-tailwind-color')).toBe(true);
    expect(has(findings, 'focus-not-visible')).toBe(true);
  });

  it('token-hallucination in class positions', () => {
    expect(
      has(lintDesign('<div class="bg-status-danger">x</div>').findings, 'token-hallucination')
    ).toBe(true);
    expect(
      has(
        lintDesign(`<Card slotClasses={{ body: 'text-muted-foreground' }} />`).findings,
        'token-hallucination'
      )
    ).toBe(true);
  });

  it('teaching-code template literals stay scanned by the deterministic rules', () => {
    // Example code a consumer copies must itself be correct (docs-gen recipe lint).
    expect(
      has(
        lintDesign('code={`<button class="focus:ring-2">x</button>`}').findings,
        'focus-not-visible'
      )
    ).toBe(true);
  });

  it("mode: 'code' (.ts input): top-level literals and imports are scanned", () => {
    const code = [
      "import Button from '@urbicon-ui/blocks/primitives/Button/Button.svelte';",
      "const cls = 'bg-blue-500 dark:bg-black focus:ring-2';"
    ].join('\n');
    const { findings } = lintDesign(code, { filename: 'styles.ts' });
    expect(has(findings, 'deep-internal-import')).toBe(true);
    expect(has(findings, 'raw-tailwind-color')).toBe(true);
    expect(has(findings, 'dark-mode-override')).toBe(true);
    expect(has(findings, 'focus-not-visible')).toBe(true);
    // Explicit mode without a filename behaves identically.
    expect(has(lintDesign(code, { mode: 'code' }).findings, 'deep-internal-import')).toBe(true);
  });

  it('line numbers survive the view (blank-preserving mask)', () => {
    const code = '<div>ok</div>\n<p>prose</p>\n<div class="bg-blue-500">x</div>';
    const f = lintDesign(code).findings.find((x) => x.ruleId === 'raw-tailwind-color');
    expect(f?.line).toBe(3);
  });
});

describe('code-view scoping — specificity (quoting is not violating)', () => {
  it('a class name in element text content is not flagged', () => {
    const code = '<p class="pl-4">✗ [raw-tailwind-color] `bg-green-500`</p>';
    expect(has(lintDesign(code).findings, 'raw-tailwind-color')).toBe(false);
  });

  it('focus:/dark: quoted in prose are not flagged', () => {
    const code =
      '<p>! [focus-not-visible] `focus:ring-2`</p><p>use light-dark() instead of dark:bg-x</p>';
    const { findings } = lintDesign(code);
    expect(has(findings, 'focus-not-visible')).toBe(false);
    expect(has(findings, 'dark-mode-override')).toBe(false);
  });

  it('a deep import path quoted in prose is not flagged', () => {
    const code = "<p>never import '@urbicon-ui/blocks/primitives/Button/Button.svelte'</p>";
    expect(has(lintDesign(code).findings, 'deep-internal-import')).toBe(false);
  });

  it('CSS custom properties in a style attribute are not token hallucinations', () => {
    // The landing's poster scope: `--room-accent-fg` matched `accent-fg` under the
    // whole-file scan and was flagged as a hallucinated token.
    const code =
      '<div class="poster-card" style="--room-accent: {bg}; --room-accent-fg: {fg}">x</div>';
    expect(has(lintDesign(code).findings, 'token-hallucination')).toBe(false);
  });

  it('non-class string attributes (aria-label, placeholder, href) are prose', () => {
    const code =
      '<button aria-label="never use bg-red-500 or focus:ring-2" data-note="z-50">x</button>';
    const { findings } = lintDesign(code);
    expect(has(findings, 'raw-tailwind-color')).toBe(false);
    expect(has(findings, 'focus-not-visible')).toBe(false);
    expect(has(findings, 'hardcoded-z-index')).toBe(false);
  });

  it('z-index / motion / hallucination vocab in prose is not flagged', () => {
    const code =
      '<p>avoid z-50, duration-[250ms] and made-up tokens like bg-status-danger in your markup</p>';
    const { findings } = lintDesign(code);
    expect(has(findings, 'hardcoded-z-index')).toBe(false);
    expect(has(findings, 'hardcoded-motion')).toBe(false);
    expect(has(findings, 'token-hallucination')).toBe(false);
  });

  it('CSS in <style> outside @apply is not scanned by the class rules', () => {
    const code = '<style>\n  .x { color: var(--room-accent-fg); }\n</style>';
    expect(has(lintDesign(code).findings, 'token-hallucination')).toBe(false);
  });

  it('a // comment in <script> quoting a violation is not flagged', () => {
    const code = "<script>\n  // don't use bg-red-500 here\n  const ok = 'bg-primary';\n</script>";
    expect(has(lintDesign(code).findings, 'raw-tailwind-color')).toBe(false);
  });

  it("a comment apostrophe does not swallow the literal after it (don't-case)", () => {
    const code = "<script>\n  // don't do this\n  const cls = 'bg-red-500';\n</script>";
    expect(has(lintDesign(code).findings, 'raw-tailwind-color')).toBe(true);
  });

  it('heuristics keep their whole-file view (style attrs still count for slop)', () => {
    // The slop axis is advisory and deliberately unscoped — generic-font on an
    // inline style attribute must keep firing.
    const code = '<div style="font-family: Helvetica, sans-serif">x</div>';
    expect(has(lintDesign(code).findings, 'generic-font')).toBe(true);
  });
});
