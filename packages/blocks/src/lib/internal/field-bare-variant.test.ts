import { describe, expect, it } from 'vitest';
import { comboboxVariants } from '$lib/primitives/Combobox/combobox.variants';
import { inputVariants } from '$lib/primitives/Input/input.variants';
import { selectVariants } from '$lib/primitives/Select/select.variants';
import { textareaVariants } from '$lib/primitives/Textarea/textarea.variants';

/**
 * `bare` on the four fields that carry `underline`.
 *
 * Every claim here is a fold result, not a string in a config: the classes that
 * make `bare` bare have to *survive* the axes declared after `variant` and the
 * base slot declared before it. The size axis would put the padding and the
 * height back, the disabled axis a fill, and the base slot's
 * `focus-visible:outline-none` would silence the outline — so a config change
 * that merely reorders axes is exactly the failure this file exists to catch.
 */

const SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/** The type step each size keeps — the one thing `bare` takes from `size`. */
const TYPE_STEP: Record<(typeof SIZES)[number], string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl'
};

type Resolve = (props: Record<string, unknown>) => string;

/**
 * The frame slot of each field, the focus mode it lights in, and the slot the
 * type step lands on — for the multi-select tokenizer that is the search input
 * inside the frame, not the frame.
 */
const FIELDS: Array<
  [
    name: string,
    resolve: Resolve,
    focus: 'focus-visible' | 'focus-within',
    typeStep: Resolve,
    /** The one padding class `bare` keeps: the lane of an absolute control. */
    lane: string | null
  ]
> = [
  [
    'Input',
    (p) => inputVariants({ variant: 'bare', ...p }).base(),
    'focus-visible',
    (p) => inputVariants({ variant: 'bare', ...p }).base(),
    null
  ],
  [
    'Textarea',
    (p) => textareaVariants({ variant: 'bare', ...p }).base(),
    'focus-visible',
    (p) => textareaVariants({ variant: 'bare', ...p }).base(),
    null
  ],
  [
    'Select',
    (p) => selectVariants({ variant: 'bare', ...p }).trigger(),
    'focus-visible',
    (p) => selectVariants({ variant: 'bare', ...p }).trigger(),
    // Select's chevron is a flex child; only a `clearable` Select reserves a
    // lane, which the size sweep below covers on its own.
    null
  ],
  [
    'Combobox',
    (p) => comboboxVariants({ variant: 'bare', ...p }).input(),
    'focus-visible',
    (p) => comboboxVariants({ variant: 'bare', ...p }).input(),
    'pr-7'
  ],
  // Multi-select moves the frame onto the tokenizer, which lights via
  // focus-within and holds no type step of its own.
  [
    'Combobox (multi)',
    (p) => comboboxVariants({ variant: 'bare', ...p }).control(),
    'focus-within',
    (p) => comboboxVariants({ variant: 'bare', ...p }).search(),
    'pr-7'
  ]
];

describe.each(FIELDS)('%s bare', (_name, resolve, focus, typeStep, lane) => {
  it('carries no frame, no fill, no radius', () => {
    const cls = resolve({ size: 'md' });
    expect(cls).toContain('border-0');
    expect(cls).toContain('rounded-none');
    expect(cls).toContain('bg-transparent');
    expect(cls).not.toContain('bg-surface-base');
    expect(cls).not.toContain('border-border-subtle');
    expect(cls).not.toContain('rounded-modify');
  });

  it.each(SIZES)('keeps only the type step of size %s', (size) => {
    const classes = resolve({ size }).split(' ');

    expect(typeStep({ size }).split(' ')).toContain(TYPE_STEP[size]);
    expect(classes).toContain('h-auto');
    expect(classes).toContain('p-0');
    expect(classes).toContain('min-h-0');
    // No measure survives: no height step, no minimum height, and no padding
    // beyond the lane an absolutely positioned control needs back.
    expect(classes.filter((c) => /^(h|min-h)-(?!auto$|0$)/.test(c))).toEqual([]);
    const padding = classes.filter((c) => /^(p|px|py|pl|pr|ps|pe|pt|pb)-(?!0$)/.test(c));
    expect(padding).toEqual(lane ? [lane] : []);
  });

  it('replaces the tinted ring with an outline built from the focus tokens', () => {
    const cls = resolve({ size: 'md' });
    expect(cls).toContain(`${focus}:outline-solid`);
    // Width and offset come off the tokens, not a literal, so
    // `prefers-contrast: more` (which raises the width to 3px) reaches them.
    expect(cls).toContain(`${focus}:outline-[length:var(--blocks-focus-ring-width)]`);
    expect(cls).toContain(`${focus}:outline-offset-[length:var(--blocks-focus-ring-offset)]`);
    expect(cls).not.toContain(`${focus}:outline-2`);
    expect(cls).toContain(`${focus}:outline-(color:--blocks-focus-ring-color)`);
    // The base slot's `outline-none` must be gone, or the outline never paints.
    expect(cls).not.toContain(`${focus}:outline-none`);
    // The 20 %-alpha ring is the frame's indicator, not bare's.
    expect(cls).toContain(`${focus}:ring-0`);
    expect(cls.split(' ')).not.toContain(`${focus}:ring-2`);
  });

  it('turns the outline to the failure tone when invalid', () => {
    const cls = resolve({ size: 'md', error: true });
    expect(cls).toContain(`${focus}:outline-(color:--color-danger)`);
    expect(cls).not.toContain(`${focus}:outline-(color:--blocks-focus-ring-color)`);
  });

  it('grows no fill when disabled', () => {
    const cls = resolve({ size: 'md', disabled: true });
    expect(cls).not.toContain('bg-surface-disabled');
    expect(cls).not.toContain('bg-surface-subtle');
    expect(cls).toContain('bg-transparent');
  });
});

describe('bare on the natively editable fields', () => {
  const NATIVE: Array<[string, Resolve]> = [
    ['Input', (p) => inputVariants({ variant: 'bare', ...p }).base()],
    ['Textarea', (p) => textareaVariants({ variant: 'bare', ...p }).base()],
    ['Combobox', (p) => comboboxVariants({ variant: 'bare', ...p }).input()]
  ];

  it.each(NATIVE)(
    '%s grows no fill from the :disabled / :read-only fallbacks',
    (_name, resolve) => {
      const cls = resolve({ size: 'md' });
      expect(cls).toContain('disabled:bg-transparent');
      expect(cls).toContain('read-only:bg-transparent');
      expect(cls).not.toContain('disabled:bg-surface-subtle');
      expect(cls).not.toContain('read-only:bg-surface-subtle');
    }
  );
});

describe('bare next to content that needs room', () => {
  it('Input still insets its text for a leading icon', () => {
    const cls = inputVariants({ variant: 'bare', size: 'md', hasLeftIcon: true }).base();
    // `p-0` is the shorthand and `pl-10` the longhand, so the fold keeps both
    // and Tailwind's own cascade resolves the left side.
    expect(cls).toContain('p-0');
    expect(cls).toContain('pl-10');
  });

  it('Select pulls the clear button into the lane the padding no longer holds', () => {
    expect(selectVariants({ variant: 'bare', size: 'md' }).clear()).toContain('right-0');
    expect(selectVariants({ variant: 'outlined', size: 'md' }).clear()).toContain('right-3');
  });

  it.each([
    ['xs', 'pr-4'],
    ['sm', 'pr-5'],
    ['md', 'pr-5'],
    ['lg', 'pr-6'],
    ['xl', 'pr-8']
  ] as const)('Select keeps a %s lane when it is clearable', (size, lane) => {
    const clearable = selectVariants({ variant: 'bare', size, clearable: true }).trigger();
    expect(clearable.split(' ')).toContain(lane);
    // Only when there is a button to make room for …
    expect(selectVariants({ variant: 'bare', size }).trigger().split(' ')).not.toContain(lane);
    // … and never on a variant that still has the size axis's own padding.
    const outlined = selectVariants({ variant: 'outlined', size, clearable: true }).trigger();
    expect(outlined.split(' ')).not.toContain(lane);
  });

  it('Combobox keeps the lane unconditionally — one of its two buttons always renders', () => {
    const styles = comboboxVariants({ variant: 'bare', size: 'md' });
    expect(styles.clear()).toContain('right-0');
    expect(styles.chevronButton()).toContain('right-0');
    expect(styles.input().split(' ')).toContain('pr-7');
    expect(styles.control().split(' ')).toContain('pr-7');
  });
});

describe('the other variants are untouched', () => {
  it('ghost still reveals its frame on focus', () => {
    const cls = textareaVariants({ variant: 'ghost', size: 'md' }).base();
    expect(cls).toContain('focus-visible:border-border-subtle');
    expect(cls).toContain('focus-visible:bg-surface-base');
    expect(cls).toContain('border-transparent');
    expect(cls).toContain('min-h-[7rem]');
  });

  it('ghost keeps a transparent border under a tonal intent, and loses it on error', () => {
    const success = textareaVariants({ variant: 'ghost', size: 'md', intent: 'success' }).base();
    expect(success).toContain('border-transparent');
    expect(success).not.toContain(' border-success');

    const invalid = textareaVariants({ variant: 'ghost', size: 'md', error: true }).base();
    expect(invalid).toContain('border-danger');
    expect(invalid).not.toContain('border-transparent');
  });
});
