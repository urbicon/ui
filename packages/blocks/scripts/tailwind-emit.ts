/**
 * tailwind-emit — ask the real Tailwind compiler which classes produce CSS.
 *
 * The sibling guard in `theme-tokens.ts` answers the same question from a
 * hand-written model of Tailwind's namespaces: `text-<key>` needs
 * `--text-<key>`, and so on. That model is exact where it reaches, and it is
 * what produces the precise "looked for --text-2xs" diagnosis. But it reaches
 * nine namespaces, and extending it to the colour-capable ones was never a
 * line in an array: `bg-` alone mixes `bg-cover`, `bg-clip-text`,
 * `bg-blend-multiply`, `bg-linear-to-r`, `bg-origin-border` and arbitrary
 * values in with the colour keys, and a wrong statics list turns the guard
 * into noise across a hundred variant configs (#61).
 *
 * So this module does not model anything. It compiles the classes and reports
 * the ones Tailwind emits no rule for — the exact property the guard exists to
 * check, for every namespace at once, including variant prefixes
 * (`hover:bg-primaryx`) and the nine colour-capable siblings `bg-` was blocked
 * behind: `border-`, `ring-`, `outline-`, `divide-`, `fill-`, `stroke-`,
 * `accent-`, `caret-`, `decoration-`.
 *
 * Measured 2026-08-02 over a 64-class probe: 13 planted typos all reported,
 * 51 legitimate classes (statics, arbitrary values, `animate-spin`,
 * `font-sans`, gradients, `outline-hidden`, `decoration-wavy`) all clean.
 */

import { compile } from '@tailwindcss/node';

/**
 * Escape a class name for use in a CSS selector, the way Tailwind does when it
 * writes the rule. `bg-primary/70` becomes `bg-primary\/70`,
 * `z-[var(--z-tooltip)]` becomes `z-\[var\(--z-tooltip\)\]`.
 *
 * Two exceptions, and both fail in the expensive direction — a valid class
 * reported dead, failing CI with no fix available but a wrong allowlist entry:
 *
 *   - A **leading digit** cannot be backslash-escaped in a CSS identifier, so
 *     Tailwind emits a hex escape plus a terminating space: `2xl:px-4` is
 *     written `.\32 xl\:px-4` (measured).
 *   - **Non-ASCII** characters are not escaped at all. `\w` is ASCII-only, so
 *     a naive `[^\w-]` backslashes every codepoint ≥ U+0080 — and without the
 *     `u` flag, one before *each surrogate half* of an astral character.
 *     `content-['✓']` and `content-['🎉']` both reproduced the leading-digit
 *     false positive that way; seven variant configs already use
 *     `content-[…]`, so a `content-['×']` is one edit from a red CI.
 */
export function escapeClass(cls: string): string {
  const escaped = cls.replace(/[^\w-]/gu, (ch) =>
    (ch.codePointAt(0) ?? 0) >= 0x80 ? ch : `\\${ch}`
  );
  return /^\d/.test(escaped) ? `\\3${escaped[0]} ${escaped.slice(1)}` : escaped;
}

/**
 * True when `css` contains a rule whose selector uses exactly this class —
 * not merely one whose name starts with it. Without the boundary check,
 * `.text-sm\/6` in the output would vouch for a dead `text-sm`.
 */
function emitsRuleFor(css: string, cls: string): boolean {
  const escaped = escapeClass(cls);
  let from = 0;
  for (;;) {
    const at = css.indexOf(`.${escaped}`, from);
    if (at === -1) return false;
    const next = css[at + escaped.length + 1];
    // End of the class name in a selector: whitespace, combinator, pseudo,
    // another class, attribute, or the start of the declaration block. A
    // `\` means the name continues with an escaped character.
    if (next === undefined || /[\s,{:>~+.[)]/.test(next)) return true;
    from = at + 1;
  }
}

/**
 * Classes that legitimately emit nothing, by kind rather than by name.
 *
 * `group` and `peer` — bare or named (`group/cell`) — are *labels*: Tailwind
 * reads them so that `group-hover:` / `group-hover/cell:` can target them, and
 * writes no rule of their own. Measured, including the bare forms. Naming each
 * one in an allowlist would mean editing this file every time a component
 * gains a named group.
 */
export function isNonEmittingByDesign(cls: string): boolean {
  return /^(group|peer)(\/|$)/.test(cls);
}

export type EmitProbe = {
  /** Classes Tailwind produced no rule for. */
  dead: string[];
  /** How many classes were compiled, for the caller's canary check. */
  checked: number;
  /** The compiled stylesheet, so a second pass can read what each class writes
   *  without starting the compiler again. */
  css: string;
};

/**
 * Compile `classes` against `css` (the app's own `@import 'tailwindcss'` plus
 * every `@theme` source) and return the ones that yield no rule.
 *
 * `base` is the directory `@import` specifiers resolve against.
 */
export async function findNonEmittingClasses(
  classes: readonly string[],
  { css, base }: { css: string; base: string }
): Promise<EmitProbe> {
  const compiler = await compile(css, { base, onDependency: () => {} });
  const unique = [...new Set(classes)];
  const out = compiler.build(unique);
  return {
    dead: unique.filter((cls) => !isNonEmittingByDesign(cls) && !emitsRuleFor(out, cls)),
    checked: unique.length,
    css: out
  };
}
