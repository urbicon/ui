import { describe, expect, it } from 'vitest';
import { lintDesign, maskComments } from './linter.js';
import type { Finding } from './types.js';

function ids(findings: Finding[]): string[] {
  return findings.map((f) => f.ruleId);
}
function has(findings: Finding[], ruleId: string): boolean {
  return findings.some((f) => f.ruleId === ruleId);
}

describe('raw-tailwind-color', () => {
  it('flags numbered chromatic palette utilities', () => {
    const { findings } = lintDesign(
      '<div class="bg-blue-500 text-red-600 border-l-amber-400">x</div>'
    );
    expect(findings.filter((f) => f.ruleId === 'raw-tailwind-color')).toHaveLength(3);
  });
  it('flags opacity-suffixed raw colours', () => {
    expect(has(lintDesign('<div class="bg-green-500/40">').findings, 'raw-tailwind-color')).toBe(
      true
    );
  });
  it('does NOT flag library tokens (intents, neutral, surfaces)', () => {
    const { findings } = lintDesign(
      '<div class="bg-primary-500 bg-neutral-100 bg-surface-base text-success border-border-subtle">'
    );
    expect(has(findings, 'raw-tailwind-color')).toBe(false);
  });
});

describe('dark-mode-override', () => {
  it('flags dark: variants', () => {
    expect(
      has(
        lintDesign('<div class="bg-white dark:bg-surface-elevated">').findings,
        'dark-mode-override'
      )
    ).toBe(true);
  });
  it('flags the important-modifier form dark:!', () => {
    expect(
      has(lintDesign('<div class="dark:!bg-surface-elevated">').findings, 'dark-mode-override')
    ).toBe(true);
  });
  it('does NOT flag plain semantic tokens', () => {
    expect(
      has(lintDesign('<div class="bg-surface-elevated">').findings, 'dark-mode-override')
    ).toBe(false);
  });
});

describe('focus-not-visible', () => {
  it('flags focus: and group-focus:', () => {
    expect(has(lintDesign('<button class="focus:ring-2">').findings, 'focus-not-visible')).toBe(
      true
    );
    expect(
      has(lintDesign('<div class="group-focus:opacity-100">').findings, 'focus-not-visible')
    ).toBe(true);
  });
  it('does NOT flag focus-visible: or focus-within:', () => {
    const { findings } = lintDesign(
      '<button class="focus-visible:ring-2 focus-within:bg-surface-hover">'
    );
    expect(has(findings, 'focus-not-visible')).toBe(false);
  });
});

describe('hardcoded-z-index', () => {
  it('flags numeric and bracketed z-index', () => {
    expect(has(lintDesign('<div class="z-10">').findings, 'hardcoded-z-index')).toBe(true);
    expect(has(lintDesign('<div class="z-[999]">').findings, 'hardcoded-z-index')).toBe(true);
  });
  it('does NOT flag the z-index token form or z-auto', () => {
    const { findings } = lintDesign('<div class="z-[var(--z-modal)] z-auto">');
    expect(has(findings, 'hardcoded-z-index')).toBe(false);
  });
});

describe('dynamic-class-interpolation', () => {
  it('flags interpolated Tailwind utility fragments', () => {
    expect(
      has(
        lintDesign("<div class=\"gap-{isHero ? '4' : '3'}\">").findings,
        'dynamic-class-interpolation'
      )
    ).toBe(true);
    expect(
      has(lintDesign('<div class={`py-${pad}`}>').findings, 'dynamic-class-interpolation')
    ).toBe(true);
  });
  it('does NOT flag interpolation that is not a Tailwind root (ids, data keys)', () => {
    const { findings } = lintDesign('<label for={`field-${id}`}>');
    expect(has(findings, 'dynamic-class-interpolation')).toBe(false);
  });
});

describe('token-hallucination', () => {
  it('flags invented status-* and -fg tokens', () => {
    expect(has(lintDesign('<div class="bg-status-danger">').findings, 'token-hallucination')).toBe(
      true
    );
    expect(has(lintDesign('<div class="text-success-fg">').findings, 'token-hallucination')).toBe(
      true
    );
  });
  it('flags intent-with-bad-suffix and namespace typos', () => {
    expect(has(lintDesign('<div class="bg-primary-muted">').findings, 'token-hallucination')).toBe(
      true
    );
    expect(has(lintDesign('<div class="bg-surface-raised">').findings, 'token-hallucination')).toBe(
      true
    );
  });
  it('does NOT flag valid tokens', () => {
    const valid =
      '<div class="bg-surface-subtle text-text-primary bg-primary bg-primary-500 text-success bg-feedback-success-subtle border-border-strong">';
    expect(has(lintDesign(valid).findings, 'token-hallucination')).toBe(false);
  });
  it('does NOT flag genuine Tailwind utilities or arbitrary values', () => {
    const { findings } = lintDesign(
      '<div class="bg-transparent bg-[#fff] text-sm bg-cover from-transparent">'
    );
    expect(has(findings, 'token-hallucination')).toBe(false);
  });
  it('does NOT flag font-size cores sharing the text- namespace', () => {
    const { findings } = lintDesign('<div class="bg-text-sm text-text-2xl border-text-base">');
    expect(has(findings, 'token-hallucination')).toBe(false);
  });
  it('keeps the opacity suffix in the reported match', () => {
    const f = lintDesign('<div class="bg-surface-raised/50">').findings.find(
      (x) => x.ruleId === 'token-hallucination'
    );
    expect(f?.match).toBe('bg-surface-raised/50');
  });
  it('flags shadcn/ui vocabulary — the top hallucination source (round-3 finding)', () => {
    const code =
      '<div class="text-foreground bg-accent text-muted-foreground bg-card bg-surface text-fg text-fg-muted border-card-foreground bg-destructive">x</div>';
    const matches = lintDesign(code)
      .findings.filter((f) => f.ruleId === 'token-hallucination')
      .map((f) => f.match);
    for (const t of [
      'text-foreground',
      'bg-accent',
      'text-muted-foreground',
      'bg-card',
      'bg-surface',
      'text-fg',
      'text-fg-muted',
      'border-card-foreground',
      'bg-destructive'
    ]) {
      expect(matches, t).toContain(t);
    }
  });
});

describe('extraTokens (per-call whitelist)', () => {
  it('whitelists an otherwise-hallucinated core so it is not flagged', () => {
    // `surface-brand` sits in our namespace but is not a built-in token → normally flagged.
    const code = '<div class="bg-surface-brand">';
    expect(has(lintDesign(code).findings, 'token-hallucination')).toBe(true);
    expect(
      has(lintDesign(code, { extraTokens: ['surface-brand'] }).findings, 'token-hallucination')
    ).toBe(false);
  });

  it('whitelists only the supplied cores, still flagging the rest on the same line', () => {
    const code = '<div class="bg-surface-brand bg-surface-imaginary">';
    const matches = lintDesign(code, { extraTokens: ['surface-brand'] })
      .findings.filter((f) => f.ruleId === 'token-hallucination')
      .map((f) => f.match);
    expect(matches).toContain('bg-surface-imaginary');
    expect(matches).not.toContain('bg-surface-brand');
  });

  it('cannot weaken the raw-palette gate — extraTokens is scoped to hallucination only', () => {
    // A consumer must not be able to whitelist a raw Tailwind palette colour; a
    // different, error-severity rule owns that and does not consult the whitelist.
    const code = '<div class="bg-blue-500">';
    expect(
      has(lintDesign(code, { extraTokens: ['blue-500'] }).findings, 'raw-tailwind-color')
    ).toBe(true);
  });

  it('ignores blank/whitespace entries (nothing whitelisted → still flagged)', () => {
    const code = '<div class="bg-surface-brand">';
    expect(has(lintDesign(code, { extraTokens: ['  ', ''] }).findings, 'token-hallucination')).toBe(
      true
    );
  });
});

describe('heuristics', () => {
  it('flags an intent rainbow of ≥4 chromatic background hues', () => {
    const code =
      '<div class="bg-primary"></div><div class="bg-success"></div><div class="bg-warning"></div><div class="bg-danger"></div>';
    expect(has(lintDesign(code).findings, 'intent-rainbow')).toBe(true);
  });
  it('does NOT count neutral backgrounds toward the rainbow', () => {
    const code =
      '<div class="bg-neutral-100"></div><div class="bg-neutral-200"></div><div class="bg-surface-base"></div><div class="bg-surface-elevated"></div>';
    expect(has(lintDesign(code).findings, 'intent-rainbow')).toBe(false);
  });
  it('flags uniform spacing (one rhythm tier)', () => {
    const code =
      '<div class="gap-4"><div class="gap-4"></div><div class="gap-4"></div><div class="gap-4"></div><div class="gap-4"></div><div class="gap-4"></div></div>';
    expect(has(lintDesign(code).findings, 'spacing-uniform')).toBe(true);
  });
  it('does NOT flag two-tier spacing', () => {
    const code =
      '<div class="gap-10"><div class="gap-3"></div><div class="gap-3"></div><div class="gap-10"></div><div class="gap-3"></div><div class="gap-10"></div></div>';
    expect(has(lintDesign(code).findings, 'spacing-uniform')).toBe(false);
  });
  it('flags identical Cards (no visual-weight variation)', () => {
    const card = '<Card variant="elevated" padding="md">x</Card>';
    expect(has(lintDesign(card.repeat(4)).findings, 'card-monotony')).toBe(true);
  });
  it('does NOT flag differentiated Cards', () => {
    const code =
      '<Card variant="elevated" padding="lg">x</Card><Card variant="outlined" padding="md">x</Card><Card variant="outlined" padding="md">x</Card><Card variant="quiet" padding="sm">x</Card>';
    expect(has(lintDesign(code).findings, 'card-monotony')).toBe(false);
  });
  it('nudges when surfaces exist but no radius strategy does', () => {
    const code = '<Card>a</Card><Card>b</Card><Card>c</Card>';
    expect(has(lintDesign(code).findings, 'no-radius-strategy')).toBe(true);
  });
  it('does NOT nudge once a radius override is present', () => {
    const code =
      '<Card class="rounded-xl">a</Card><Card class="rounded-xl">b</Card><Card class="rounded-xl">c</Card>';
    expect(has(lintDesign(code).findings, 'no-radius-strategy')).toBe(false);
  });
  it('does NOT treat bordered table rows / dividers as surfaces (no false radius nudge)', () => {
    const code =
      '<table><tr class="border-b"><td>a</td></tr><tr class="border-b"><td>b</td></tr><tr class="border-b"><td>c</td></tr></table>';
    expect(has(lintDesign(code).findings, 'no-radius-strategy')).toBe(false);
  });
  it('can be skipped via skipHeuristics', () => {
    const code = '<Card variant="elevated" padding="md">x</Card>'.repeat(4);
    const { findings } = lintDesign(code, { skipHeuristics: true });
    expect(findings.every((f) => f.kind === 'deterministic')).toBe(true);
  });
  it('flags uniform font-weights but not a varied scale', () => {
    expect(
      has(lintDesign('<span class="font-bold">x</span>'.repeat(5)).findings, 'font-weight-uniform')
    ).toBe(true);
    const varied =
      '<h1 class="font-bold">A</h1><p class="font-normal">b</p><p class="font-normal">c</p><small class="font-medium">d</small><span class="font-semibold">e</span>';
    expect(has(lintDesign(varied).findings, 'font-weight-uniform')).toBe(false);
  });
});

describe('slop-floor rules', () => {
  it('generic-font: flags hardcoded stacks, not family tokens', () => {
    expect(has(lintDesign('<div class="font-[\'Arial\']">x</div>').findings, 'generic-font')).toBe(
      true
    );
    expect(
      has(
        lintDesign('<div style="font-family: Helvetica, sans-serif">x</div>').findings,
        'generic-font'
      )
    ).toBe(true);
    expect(
      has(lintDesign('<div class="font-sans font-bold">x</div>').findings, 'generic-font')
    ).toBe(false);
  });

  it('arbitrary-color: flags hex/rgb literals, not var() token refs', () => {
    expect(has(lintDesign('<div class="bg-[#3b82f6]">x</div>').findings, 'arbitrary-color')).toBe(
      true
    );
    expect(
      has(lintDesign('<div class="text-[rgb(0,0,0)]">x</div>').findings, 'arbitrary-color')
    ).toBe(true);
    expect(
      has(
        lintDesign('<div class="bg-[var(--color-surface-base)]">x</div>').findings,
        'arbitrary-color'
      )
    ).toBe(false);
  });

  it('transition-all: flags the catch-all, not a specific property', () => {
    expect(
      has(lintDesign('<button class="transition-all">x</button>').findings, 'transition-all')
    ).toBe(true);
    expect(
      has(lintDesign('<button class="transition-colors">x</button>').findings, 'transition-all')
    ).toBe(false);
  });

  it('animated-dimensions: flags transitioning layout, not transform/opacity', () => {
    expect(
      has(lintDesign('<div class="transition-[width]">x</div>').findings, 'animated-dimensions')
    ).toBe(true);
    expect(
      has(
        lintDesign('<div class="transition-[opacity] transition-transform">x</div>').findings,
        'animated-dimensions'
      )
    ).toBe(false);
  });

  it('magic-dimension: flags off-scale px, not scale utils, ch bounds, or hairlines', () => {
    expect(
      has(lintDesign('<div class="w-[317px] h-[42px]">x</div>').findings, 'magic-dimension')
    ).toBe(true);
    expect(
      has(lintDesign('<div class="w-64 max-w-[65ch] h-[1px]">x</div>').findings, 'magic-dimension')
    ).toBe(false);
  });

  it('important-modifier: flags `!util-`, not JS negation', () => {
    expect(
      has(lintDesign('<div class="!p-0 !bg-primary">x</div>').findings, 'important-modifier')
    ).toBe(true);
    expect(
      has(lintDesign('<div class={!isOpen ? "p-0" : "p-4"}>x</div>').findings, 'important-modifier')
    ).toBe(false);
  });

  it('inline-style: flags static CSS, not a custom property or interpolated value', () => {
    expect(
      has(lintDesign('<div style="padding: 12px; color: red">x</div>').findings, 'inline-style')
    ).toBe(true);
    expect(has(lintDesign('<div style="--progress: 40%">x</div>').findings, 'inline-style')).toBe(
      false
    );
    // Dynamic, interpolated values have no static utility equivalent → legitimate.
    expect(
      has(lintDesign('<div style="left: {x}%; width: {w}%">x</div>').findings, 'inline-style')
    ).toBe(false);
  });

  it('gradient-text: flags bg-clip-text', () => {
    expect(
      has(lintDesign('<h1 class="bg-clip-text text-transparent">x</h1>').findings, 'gradient-text')
    ).toBe(true);
    expect(has(lintDesign('<h1 class="text-text-primary">x</h1>').findings, 'gradient-text')).toBe(
      false
    );
  });

  it('grey-on-intent: flags muted text on an intent bg, not on a neutral surface', () => {
    expect(
      has(
        lintDesign('<div class="bg-primary text-text-tertiary">x</div>').findings,
        'grey-on-intent'
      )
    ).toBe(true);
    expect(
      has(lintDesign('<div class="bg-primary text-on-primary">x</div>').findings, 'grey-on-intent')
    ).toBe(false);
    expect(
      has(
        lintDesign('<div class="bg-surface-base text-text-tertiary">x</div>').findings,
        'grey-on-intent'
      )
    ).toBe(false);
  });

  it('centered-bodytext: flags a centred <p>, not a centred heading', () => {
    expect(
      has(
        lintDesign('<p class="text-center text-text-secondary">body copy</p>').findings,
        'centered-bodytext'
      )
    ).toBe(true);
    expect(
      has(lintDesign('<h1 class="text-center">Title</h1>').findings, 'centered-bodytext')
    ).toBe(false);
  });

  it('placeholder-content: flags lorem ipsum, not a real string or input placeholder', () => {
    expect(
      has(lintDesign('<p>Lorem ipsum dolor sit amet</p>').findings, 'placeholder-content')
    ).toBe(true);
    expect(
      has(lintDesign('<input placeholder="Email address" />').findings, 'placeholder-content')
    ).toBe(false);
  });

  it('emoji-as-icon: flags pictographic emoji, not an icon component or monochrome text glyph', () => {
    expect(has(lintDesign('<button>🚀 Launch</button>').findings, 'emoji-as-icon')).toBe(true);
    expect(
      has(lintDesign('<button><RocketIcon /> Launch</button>').findings, 'emoji-as-icon')
    ).toBe(false);
    // Bare monochrome glyphs used as text (no emoji-presentation selector) are not flagged.
    expect(
      has(lintDesign('<span>✓ done · ⚠ heads up · → next</span>').findings, 'emoji-as-icon')
    ).toBe(false);
  });

  it('heading-skip: flags h1→h3, not a sequential or shallower order', () => {
    expect(has(lintDesign('<h1>A</h1><h3>B</h3>').findings, 'heading-skip')).toBe(true);
    expect(has(lintDesign('<h1>A</h1><h2>B</h2><h3>C</h3>').findings, 'heading-skip')).toBe(false);
    expect(has(lintDesign('<h2>A</h2><h1>B</h1>').findings, 'heading-skip')).toBe(false);
  });

  it('touch-target-small: flags a tiny interactive element, not a ≥44px one', () => {
    expect(
      has(lintDesign('<button class="h-6 px-2">x</button>').findings, 'touch-target-small')
    ).toBe(true);
    expect(
      has(lintDesign('<button class="h-11 px-4">x</button>').findings, 'touch-target-small')
    ).toBe(false);
  });

  it('justified-text: flags text-justify, not text-left', () => {
    expect(
      has(lintDesign('<p class="text-justify">long copy</p>').findings, 'justified-text')
    ).toBe(true);
    expect(has(lintDesign('<p class="text-left">long copy</p>').findings, 'justified-text')).toBe(
      false
    );
  });

  it('scores slop, never correctness — and fires at most once per repeated sin', () => {
    // Three inline paint styles are one slop verdict (flat SLOP_WEIGHT), not three.
    const code =
      '<div style="color: red">a</div><div style="color: blue">b</div><div style="background: green">c</div>';
    const { findings, scores } = lintDesign(code);
    const inline = findings.filter((f) => f.ruleId === 'inline-style');
    expect(inline).toHaveLength(1);
    expect(inline[0]?.kind).toBe('heuristic');
    expect(scores.correctness).toBe(100); // pure slop, correctness untouched
    expect(scores.slop).toBe(90); // one −10, not −30
  });
});

describe('comment masking', () => {
  it('ignores violations inside HTML and block comments', () => {
    const code =
      '<!-- class="focus:ring-2 bg-blue-500" --><div class="bg-surface-base">/* z-50 */</div>';
    const { findings } = lintDesign(code);
    expect(findings).toHaveLength(0);
  });
  it('keeps line numbers correct after masking', () => {
    const masked = maskComments('a\n<!--\nx\n-->\nfocus:ring');
    expect(masked.split('\n')).toHaveLength(5);
  });
});

describe('scoring (two axes)', () => {
  it('scores clean code 100/100 on both axes', () => {
    const { scores } = lintDesign('<div class="bg-surface-base text-text-primary">clean</div>');
    expect(scores.correctness).toBe(100);
    expect(scores.slop).toBe(100);
  });
  it('deducts correctness per finding and floors at 0', () => {
    const oneError = lintDesign('<div class="bg-blue-500">');
    expect(oneError.scores.correctness).toBe(90);
    // Per-line dedupe collapses identical hits on one line, so spread distinct hits across lines.
    const many = lintDesign(
      Array.from({ length: 12 }, () => '<div class="bg-blue-500">').join('\n')
    );
    expect(many.scores.correctness).toBe(0);
  });
  it('scores slop on its own axis, leaving correctness untouched', () => {
    // An intent rainbow is pure slop — the tokens are all valid, so correctness stays 100.
    const code =
      '<div class="bg-primary"></div><div class="bg-success"></div><div class="bg-warning"></div><div class="bg-danger"></div>';
    const { scores } = lintDesign(code);
    expect(scores.correctness).toBe(100);
    expect(scores.slop).toBeLessThan(100);
  });
  it('does not let a clean slop axis hide a correctness defect (never mixed)', () => {
    const { scores } = lintDesign('<div class="bg-blue-500">solo defect</div>');
    expect(scores.correctness).toBeLessThan(100);
    expect(scores.slop).toBe(100);
  });
  it('reports severity counts', () => {
    const { counts } = lintDesign('<div class="bg-blue-500 bg-status-x">');
    expect(counts.error).toBeGreaterThanOrEqual(1);
    expect(counts.warning).toBeGreaterThanOrEqual(1);
  });
});

describe('rule metadata', () => {
  it('every finding carries a fix hint', () => {
    const code =
      '<button class="bg-blue-500 dark:bg-red-500 focus:ring z-50 gap-{x} bg-status-bad">';
    for (const f of lintDesign(code).findings) {
      expect(f.fix.length).toBeGreaterThan(0);
      expect(f.ruleId.length).toBeGreaterThan(0);
    }
  });
  it('produces a stable id ordering for the same input', () => {
    const code = '<div class="z-50 bg-blue-500">';
    expect(ids(lintDesign(code).findings)).toEqual(ids(lintDesign(code).findings));
  });
});
