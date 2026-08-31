import { describe, expect, it } from 'vitest';
import { accordionVariants } from '../primitives/Accordion/accordion.variants';
import { badgeVariants } from '../primitives/Badge/badge.variants';
import { buttonVariants } from '../primitives/Button/button.variants';
import { checkboxVariants } from '../primitives/Checkbox/checkbox.variants';
import { dialogVariants } from '../primitives/Dialog/dialog.variants';
import { inputVariants } from '../primitives/Input/input.variants';
import { menuVariants } from '../primitives/Menu/menu.variants';
import { paginationVariants } from '../primitives/Pagination/pagination.variants';
import { segmentGroupVariants } from '../primitives/SegmentGroup/segmentgroup.variants';
import { sidebarVariants } from '../primitives/Sidebar/sidebar.variants';
import { skeletonVariants } from '../primitives/Skeleton/skeleton.variants';
import { cx, matchesCompound, resolveClassChain, tv, type VariantProps } from './variants';

// ─── cx ──────────────────────────────────────────────────────────────────────

describe('cx', () => {
  it('joins strings', () => {
    expect(cx('a', 'b', 'c')).toBe('a b c');
  });

  it('filters falsy values', () => {
    expect(cx('a', undefined, null, false, 'b')).toBe('a b');
  });

  it('trims whitespace', () => {
    expect(cx('  a  ', '  b  ')).toBe('a b');
  });

  it('flattens arrays', () => {
    expect(cx(['a', 'b'], 'c')).toBe('a b c');
  });

  it('handles nested arrays', () => {
    expect(cx(['a', ['b', 'c']], 'd')).toBe('a b c d');
  });

  it('filters falsy inside arrays', () => {
    expect(cx(['a', undefined, false, 'b'])).toBe('a b');
  });

  it('returns empty string for no input', () => {
    expect(cx()).toBe('');
  });

  it('returns empty string for all falsy', () => {
    expect(cx(undefined, null, false)).toBe('');
  });

  it('handles empty strings', () => {
    expect(cx('', 'a', '', 'b')).toBe('a b');
  });
});

// ─── tv: no-slot mode ───────────────────────────────────────────────────────

describe('tv – no-slot mode', () => {
  it('returns base only when no variants', () => {
    const component = tv({ base: 'flex items-center' });
    expect(component()).toBe('flex items-center');
  });

  it('accepts base as array', () => {
    const component = tv({ base: ['flex', 'items-center'] });
    expect(component()).toBe('flex items-center');
  });

  it('resolves variant value', () => {
    const component = tv({
      base: 'base',
      variants: {
        size: { sm: 'text-sm', md: 'text-md', lg: 'text-lg' }
      }
    });
    expect(component({ size: 'lg' })).toBe('base text-lg');
  });

  it('applies default variants', () => {
    const component = tv({
      base: 'base',
      variants: {
        size: { sm: 'text-sm', md: 'text-md' }
      },
      defaultVariants: { size: 'md' }
    });
    expect(component()).toBe('base text-md');
    expect(component({})).toBe('base text-md');
  });

  it('overrides default with explicit prop', () => {
    const component = tv({
      base: 'base',
      variants: {
        size: { sm: 'text-sm', md: 'text-md' }
      },
      defaultVariants: { size: 'md' }
    });
    expect(component({ size: 'sm' })).toBe('base text-sm');
  });

  it('resolves boolean variant with true', () => {
    const component = tv({
      base: 'base',
      variants: {
        loading: { true: 'opacity-50', false: 'opacity-100' }
      }
    });
    expect(component({ loading: true })).toBe('base opacity-50');
    expect(component({ loading: false })).toBe('base opacity-100');
  });

  it('resolves boolean default variants', () => {
    const component = tv({
      base: 'base',
      variants: {
        disabled: { true: 'pointer-events-none', false: '' }
      },
      defaultVariants: { disabled: false }
    });
    expect(component()).toBe('base');
    expect(component({ disabled: true })).toBe('base pointer-events-none');
  });

  it('handles variant value as array', () => {
    const component = tv({
      base: 'base',
      variants: {
        intent: {
          primary: ['bg-primary', 'text-white']
        }
      }
    });
    expect(component({ intent: 'primary' })).toBe('base bg-primary text-white');
  });

  it('handles empty string variant value', () => {
    const component = tv({
      base: 'base',
      variants: {
        size: { sm: '', md: 'p-4' }
      }
    });
    expect(component({ size: 'sm' })).toBe('base');
    expect(component({ size: 'md' })).toBe('base p-4');
  });

  it('appends class override', () => {
    const component = tv({
      base: 'base',
      variants: { size: { sm: 'text-sm' } }
    });
    expect(component({ size: 'sm', class: 'mt-4' })).toBe('base text-sm mt-4');
  });

  it('appends class override as array', () => {
    const component = tv({ base: 'base' });
    expect(component({ class: ['mt-4', undefined, 'mb-2'] })).toBe('base mt-4 mb-2');
  });

  it('handles multiple variants', () => {
    const component = tv({
      base: 'btn',
      variants: {
        size: { sm: 'h-8', md: 'h-10', lg: 'h-12' },
        intent: { primary: 'bg-blue', danger: 'bg-red' }
      }
    });
    expect(component({ size: 'lg', intent: 'primary' })).toBe('btn h-12 bg-blue');
  });
});

// ─── tv: compound variants ──────────────────────────────────────────────────

describe('tv – compound variants', () => {
  it('applies matching compound variant', () => {
    const component = tv({
      base: 'base',
      variants: {
        orientation: { horizontal: 'h-px', vertical: 'w-px' },
        size: { sm: '', md: '', lg: '' }
      },
      compoundVariants: [
        { orientation: 'horizontal', size: 'sm', class: 'my-2' },
        { orientation: 'horizontal', size: 'md', class: 'my-4' },
        { orientation: 'vertical', size: 'sm', class: 'mx-2' }
      ],
      defaultVariants: { orientation: 'horizontal', size: 'md' }
    });
    expect(component({ orientation: 'horizontal', size: 'sm' })).toBe('base h-px my-2');
    expect(component()).toBe('base h-px my-4');
  });

  it('supports array value matching in compound conditions', () => {
    const component = tv({
      base: 'base',
      variants: {
        placement: {
          top: 'top',
          bottom: 'bottom',
          left: 'left',
          right: 'right'
        }
      },
      compoundVariants: [
        { placement: ['top', 'bottom'], class: 'vertical' },
        { placement: ['left', 'right'], class: 'horizontal' }
      ]
    });
    expect(component({ placement: 'top' })).toBe('base top vertical');
    expect(component({ placement: 'left' })).toBe('base left horizontal');
  });

  it('uses defaults for compound matching', () => {
    const component = tv({
      base: 'base',
      variants: {
        intent: { primary: 'p', danger: 'd' },
        variant: { filled: 'f', outlined: 'o' }
      },
      compoundVariants: [{ intent: 'primary', variant: 'filled', class: 'primary-filled' }],
      defaultVariants: { intent: 'primary', variant: 'filled' }
    });
    expect(component()).toBe('base p f primary-filled');
  });

  it('boolean compound conditions', () => {
    const component = tv({
      base: 'base',
      variants: {
        loading: { true: 'loading', false: '' },
        size: { sm: 'sm', md: 'md' }
      },
      compoundVariants: [{ loading: true, size: 'sm', class: 'loading-sm' }]
    });
    expect(component({ loading: true, size: 'sm' })).toBe('base loading sm loading-sm');
    expect(component({ loading: false, size: 'sm' })).toBe('base sm');
  });

  it('no match when condition fails', () => {
    const component = tv({
      base: 'base',
      variants: {
        a: { x: 'ax', y: 'ay' },
        b: { x: 'bx', y: 'by' }
      },
      compoundVariants: [{ a: 'x', b: 'x', class: 'match' }]
    });
    expect(component({ a: 'x', b: 'y' })).toBe('base ax by');
  });
});

// ─── tv: slot mode ──────────────────────────────────────────────────────────

describe('tv – slot mode', () => {
  it('returns slot functions', () => {
    const component = tv({
      slots: {
        base: 'flex',
        content: 'text-sm',
        icon: 'w-4 h-4'
      }
    });
    const styles = component();
    expect(styles.base()).toBe('flex');
    expect(styles.content()).toBe('text-sm');
    expect(styles.icon()).toBe('w-4 h-4');
  });

  it('resolves per-slot variant values', () => {
    const component = tv({
      slots: { base: 'btn', content: 'inner' },
      variants: {
        size: {
          sm: { base: 'h-8', content: 'text-xs' },
          lg: { base: 'h-12', content: 'text-lg' }
        }
      }
    });
    const styles = component({ size: 'lg' });
    expect(styles.base()).toBe('btn h-12');
    expect(styles.content()).toBe('inner text-lg');
  });

  it('string variant value goes to base slot only', () => {
    const component = tv({
      slots: { base: 'btn', content: 'inner' },
      variants: {
        intent: {
          primary: 'bg-primary'
        }
      }
    });
    const styles = component({ intent: 'primary' });
    expect(styles.base()).toBe('btn bg-primary');
    expect(styles.content()).toBe('inner');
  });

  it('handles empty object variant value', () => {
    const component = tv({
      slots: { base: 'btn', content: 'inner' },
      variants: {
        intent: {
          neutral: {},
          primary: { base: 'bg-primary', content: 'text-white' }
        }
      }
    });
    const styles = component({ intent: 'neutral' });
    expect(styles.base()).toBe('btn');
    expect(styles.content()).toBe('inner');
  });

  it('applies default variants to slots', () => {
    const component = tv({
      slots: { base: 'btn', label: '' },
      variants: {
        size: {
          sm: { base: 'h-8', label: 'text-xs' },
          md: { base: 'h-10', label: 'text-sm' }
        }
      },
      defaultVariants: { size: 'md' }
    });
    const styles = component();
    expect(styles.base()).toBe('btn h-10');
    expect(styles.label()).toBe('text-sm');
  });

  it('slot function accepts class override', () => {
    const component = tv({
      slots: { base: 'btn', content: 'inner' }
    });
    const styles = component();
    expect(styles.base({ class: 'mt-4' })).toBe('btn mt-4');
    expect(styles.base({ class: ['mt-4', 'mb-2'] })).toBe('btn mt-4 mb-2');
  });

  it('slot function accepts class with undefined values', () => {
    const component = tv({
      slots: { base: 'btn' }
    });
    const styles = component();
    expect(styles.base({ class: [undefined, 'mt-4', undefined] })).toBe('btn mt-4');
  });

  it('reads each top-level array element as its own source, so the later one wins', () => {
    // The shape every call site writes for the override ladder's last two
    // rungs: `[slotClasses?.base, className]`. Without the split both land in
    // the attribute and the stylesheet decides which corner is painted.
    const component = tv({ slots: { base: 'rounded-md p-6' } });
    const styles = component();
    expect(styles.base({ class: ['py-8', 'py-4'] })).toBe('rounded-md p-6 py-4');
    expect(styles.base({ class: ['rounded-none', 'rounded-full'] })).toBe('p-6 rounded-full');
  });

  it('keeps a nested array as one source, so an author-paired set survives', () => {
    const component = tv({ slots: { base: 'btn' } });
    const styles = component();
    expect(styles.base({ class: [['rounded-md', 'rounded-t-none']] })).toBe(
      'btn rounded-md rounded-t-none'
    );
  });

  it('reads a no-slot class array the same way', () => {
    const component = tv({ base: 'rounded-md p-6' });
    expect(component({ class: ['py-8', 'py-4'] })).toBe('rounded-md p-6 py-4');
  });

  it('slot function accepts variant overrides', () => {
    const component = tv({
      slots: { base: 'btn', item: 'list-item' },
      variants: {
        size: {
          sm: { item: 'text-xs' },
          lg: { item: 'text-lg' }
        },
        selected: {
          true: { item: 'font-bold' },
          false: {}
        }
      },
      defaultVariants: { size: 'sm', selected: false }
    });
    const styles = component();
    expect(styles.item()).toBe('list-item text-xs');
    expect(styles.item({ size: 'lg', selected: true })).toBe('list-item text-lg font-bold');
  });

  it('slot function accepts overrides + class', () => {
    const component = tv({
      slots: { base: 'btn', item: 'list-item' },
      variants: {
        size: {
          sm: { item: 'h-6' },
          lg: { item: 'h-10' }
        }
      },
      defaultVariants: { size: 'sm' }
    });
    const styles = component();
    expect(styles.item({ size: 'lg', class: 'extra' })).toBe('list-item h-10 extra');
  });

  it('compound variants with slot map class', () => {
    const component = tv({
      slots: { base: 'btn', content: '' },
      variants: {
        intent: { primary: {}, danger: {} },
        variant: { filled: {}, outlined: {} }
      },
      compoundVariants: [
        {
          intent: 'primary',
          variant: 'filled',
          class: { base: 'bg-primary', content: 'text-white' }
        },
        {
          intent: 'danger',
          variant: 'filled',
          class: { base: 'bg-red', content: 'text-white' }
        }
      ],
      defaultVariants: { intent: 'primary', variant: 'filled' }
    });
    const styles = component();
    expect(styles.base()).toBe('btn bg-primary');
    expect(styles.content()).toBe('text-white');

    const dangerStyles = component({ intent: 'danger' });
    expect(dangerStyles.base()).toBe('btn bg-red');
  });

  it('compound variants with string class go to base slot only', () => {
    const component = tv({
      slots: { base: 'btn', label: 'lbl' },
      variants: {
        loading: { true: {}, false: {} }
      },
      compoundVariants: [{ loading: true, class: 'opacity-50' }]
    });
    const styles = component({ loading: true });
    expect(styles.base()).toBe('btn opacity-50');
    expect(styles.label()).toBe('lbl');
  });

  it('compound with array matching in slot mode', () => {
    const component = tv({
      slots: { base: '', content: '' },
      variants: {
        placement: {
          top: {},
          bottom: {},
          'bottom-start': {},
          'bottom-end': {}
        }
      },
      compoundVariants: [
        {
          placement: ['bottom', 'bottom-start', 'bottom-end'],
          class: { base: 'origin-top' }
        }
      ]
    });
    const styles = component({ placement: 'bottom-start' });
    expect(styles.base()).toBe('origin-top');
    expect(styles.content()).toBe('');
  });

  it('variant value as array in slot map', () => {
    const component = tv({
      slots: { base: 'btn' },
      variants: {
        intent: {
          primary: { base: ['bg-primary', 'text-white'] }
        }
      }
    });
    const styles = component({ intent: 'primary' });
    expect(styles.base()).toBe('btn bg-primary text-white');
  });

  it('rejects a top-level base alongside slots (declare slots.base instead)', () => {
    // Historically `config.base` merged into a slot literally named 'base'
    // and was silently dropped otherwise — a silent-failure trap. The
    // combination is now a config-time error (and a type error).
    expect(() => tv({ base: 'global-base', slots: { base: 'slot-base' } } as never)).toThrowError(
      /mutually exclusive/
    );
    expect(() =>
      tv({ base: 'global-base', slots: { content: 'content-slot' } } as never)
    ).toThrowError(/mutually exclusive/);
  });
});

// ─── tv: regression tests with real-world patterns ──────────────────────────

describe('tv – real-world patterns', () => {
  it('separator pattern (no-slot + compound)', () => {
    const separatorVariants = tv({
      base: ['shrink-0 bg-border-subtle'],
      variants: {
        orientation: {
          horizontal: 'h-px w-full',
          vertical: 'w-px h-full'
        },
        size: { sm: '', md: '', lg: '' }
      },
      compoundVariants: [
        { orientation: 'horizontal', size: 'sm', class: 'my-2' },
        { orientation: 'horizontal', size: 'md', class: 'my-4' },
        { orientation: 'horizontal', size: 'lg', class: 'my-6' },
        { orientation: 'vertical', size: 'sm', class: 'mx-2' },
        { orientation: 'vertical', size: 'md', class: 'mx-4' },
        { orientation: 'vertical', size: 'lg', class: 'mx-6' }
      ],
      defaultVariants: { orientation: 'horizontal', size: 'md' }
    });

    expect(separatorVariants()).toBe('shrink-0 bg-border-subtle h-px w-full my-4');
    expect(separatorVariants({ orientation: 'vertical', size: 'lg' })).toBe(
      'shrink-0 bg-border-subtle w-px h-full mx-6'
    );
  });

  it('button pattern (slots + compound with slot maps)', () => {
    const buttonVariants = tv({
      slots: {
        base: 'inline-flex items-center rounded',
        content: 'flex items-center gap-1',
        spinner: 'absolute inset-0'
      },
      variants: {
        intent: {
          neutral: {},
          primary: {}
        },
        variant: {
          filled: {},
          outlined: { base: 'border' }
        },
        size: {
          sm: { base: 'h-8 px-3 text-sm', content: 'text-sm' },
          md: { base: 'h-10 px-4 text-base', content: 'text-base' },
          lg: { base: 'h-12 px-6 text-lg', content: 'text-lg' }
        },
        loading: {
          true: { base: 'pointer-events-none' },
          false: {}
        }
      },
      compoundVariants: [
        {
          intent: 'primary',
          variant: 'filled',
          class: { base: 'bg-primary text-white' }
        },
        {
          intent: 'neutral',
          variant: 'outlined',
          class: { base: 'border-neutral text-neutral' }
        }
      ],
      defaultVariants: {
        intent: 'neutral',
        variant: 'filled',
        size: 'md',
        loading: false
      }
    });

    const defaultStyles = buttonVariants();
    expect(defaultStyles.base()).toBe('inline-flex items-center rounded h-10 px-4 text-base');
    expect(defaultStyles.content()).toBe('flex items-center gap-1 text-base');
    expect(defaultStyles.spinner()).toBe('absolute inset-0');

    const primaryStyles = buttonVariants({ intent: 'primary', size: 'lg' });
    expect(primaryStyles.base()).toContain('bg-primary text-white');
    expect(primaryStyles.base()).toContain('h-12 px-6 text-lg');

    const outlinedStyles = buttonVariants({ variant: 'outlined' });
    expect(outlinedStyles.base()).toContain('border');
    expect(outlinedStyles.base()).toContain('border-neutral text-neutral');
  });

  it('menu item pattern (slot fn with per-call variant overrides)', () => {
    const menuPatternVariants = tv({
      slots: {
        base: 'menu',
        item: 'menu-item',
        trigger: 'menu-trigger'
      },
      variants: {
        itemSize: {
          sm: { item: 'py-1 text-sm' },
          md: { item: 'py-2 text-base' },
          lg: { item: 'py-3 text-lg' }
        },
        selected: {
          true: { item: 'font-semibold bg-selected' },
          false: {}
        },
        disabled: {
          true: { item: 'opacity-50 pointer-events-none' },
          false: {}
        }
      },
      defaultVariants: { itemSize: 'md', selected: false, disabled: false }
    });

    const styles = menuPatternVariants();

    expect(styles.item()).toBe('menu-item py-2 text-base');
    expect(styles.item({ itemSize: 'sm', selected: true })).toBe(
      'menu-item py-1 text-sm font-semibold bg-selected'
    );
    expect(styles.item({ disabled: true })).toBe(
      'menu-item py-2 text-base opacity-50 pointer-events-none'
    );
    expect(styles.item({ itemSize: 'lg', selected: true, class: 'custom' })).toBe(
      'menu-item py-3 text-lg font-semibold bg-selected custom'
    );
  });
});

// ─── VariantProps type tests ────────────────────────────────────────────────

describe('VariantProps', () => {
  it('extracts variant props from no-slot tv (type-level)', () => {
    const component = tv({
      base: 'base',
      variants: {
        size: { sm: 'sm', md: 'md', lg: 'lg' },
        intent: { primary: 'p', danger: 'd' }
      }
    });
    type Props = VariantProps<typeof component>;

    const valid: Props = { size: 'sm', intent: 'primary' };
    const empty: Props = {};
    expect(valid).toBeDefined();
    expect(empty).toBeDefined();
  });

  it('extracts variant props from slot tv (type-level)', () => {
    const component = tv({
      slots: { base: '', content: '' },
      variants: {
        size: { sm: {}, md: {} },
        loading: { true: {}, false: {} }
      }
    });
    type Props = VariantProps<typeof component>;

    const valid: Props = { size: 'sm', loading: true };
    const empty: Props = {};
    expect(valid).toBeDefined();
    expect(empty).toBeDefined();
  });
});

// ─── tv: tailwind conflict resolver (XC-3) ──────────────────────────────────

describe('tv – tailwind conflict resolver', () => {
  describe('pipeline: variant strips base, compound strips variant, override strips all', () => {
    it('BGR-3: ButtonGroup outlined-active-neutral — compound bg-neutral wins over variant bg-transparent', () => {
      // Browser-verified 2026-05-11: pre-fix the source-order cascade let
      // `bg-transparent` win against the active-compound's `bg-neutral`,
      // rendering active buttons as white-on-white. Tests against the real
      // `buttonVariants` so a future refactor breaking this would fail loudly.
      const styles = buttonVariants({
        variant: 'outlined',
        intent: 'neutral',
        active: true,
        size: 'md'
      });
      const cls = styles.base();
      const tokens = cls.split(/\s+/);
      expect(tokens).not.toContain('bg-transparent');
      expect(tokens).toContain('bg-neutral');
      expect(tokens).toContain('border-neutral');
      // `neutral` is a non-primary solid fill, so its label rides the shared
      // `--color-text-on-fill` (2026-07-31). What this case is actually about is
      // the compound-vs-variant cascade, not which on-colour — but pinning the
      // real token keeps it honest if the pairing moves again.
      expect(tokens).toContain('text-text-on-fill');
      // `border-1` (width) and `border-neutral` (color) are orthogonal CSS
      // properties — both should survive. Pre-bucket-split they shared a
      // bucket and `border-1` was wrongly stripped.
      expect(tokens).toContain('border-1');
    });

    it('SBR-1: Sidebar branded panel — slotProps strip slot-base bg', () => {
      // Browser-verified: sidebar branded example needs `bg-neutral-900` to
      // defeat slot-base `bg-surface-elevated`.
      const styles = sidebarVariants();
      const branded = styles.panel({ class: 'bg-neutral-900 border-neutral-800' });
      const tokens = branded.split(/\s+/);
      expect(tokens).not.toContain('bg-surface-elevated');
      expect(tokens).not.toContain('border-border-subtle');
      expect(tokens).toContain('bg-neutral-900');
      expect(tokens).toContain('border-neutral-800');
    });

    it('CHK-7: Checkbox slotClasses.box rounded-full wins over slot-base rounded-sm', () => {
      const styles = checkboxVariants({ size: 'md' });
      const rounded = styles.box({ class: 'rounded-full' });
      const tokens = rounded.split(/\s+/);
      expect(tokens).not.toContain('rounded-sm');
      expect(tokens).toContain('rounded-full');
    });

    it('CHK-7: Checkbox slotClasses.box w-7 h-7 wins over size=md slot-variant w-5 h-5', () => {
      const styles = checkboxVariants({ size: 'md' });
      const resized = styles.box({ class: 'w-7 h-7' });
      const tokens = resized.split(/\s+/);
      expect(tokens).not.toContain('w-5');
      expect(tokens).not.toContain('h-5');
      expect(tokens).toContain('w-7');
      expect(tokens).toContain('h-7');
    });

    it('CHK-3: Checkbox error-state message wins text-color vs. slot-base text-text-tertiary', () => {
      // Real-world: helper-text slot defaults to `text-text-tertiary`; the
      // error-variant adds `text-danger-text`. Browser-verified that pre-fix the
      // tertiary color won the cascade.
      const styles = checkboxVariants({ error: true });
      const cls = styles.message();
      const tokens = cls.split(/\s+/);
      expect(tokens).not.toContain('text-text-tertiary');
      expect(tokens).toContain('text-danger-text');
      expect(tokens).toContain('text-xs'); // text-size bucket different — kept
    });

    it('MNU-2: Menu open+fade chevron opacity-30 wins over base opacity-70', () => {
      const styles = menuVariants({ open: true, chevronAnimation: 'fade' });
      const cls = styles.chevron();
      const tokens = cls.split(/\s+/);
      expect(tokens).not.toContain('opacity-70');
      expect(tokens).toContain('opacity-30');
    });

    it('no-slot mode applies the same pipeline strip', () => {
      // Same conflict idea, in a non-slot tv().
      const badge = tv({
        base: 'inline-flex bg-neutral',
        variants: {
          intent: { primary: 'bg-primary', danger: 'bg-danger' }
        }
      });
      expect(badge({ intent: 'primary' })).not.toContain('bg-neutral');
      expect(badge({ intent: 'primary' })).toContain('bg-primary');
    });

    it('multi-stage override strips both base and variant', () => {
      const card = tv({
        slots: { base: 'rounded-sm bg-surface-base shadow-sm' },
        variants: {
          variant: { filled: { base: 'rounded-md bg-surface-subtle' } }
        },
        defaultVariants: { variant: 'filled' }
      });
      const styles = card();
      // Override carries both
      const out = styles.base({ class: 'rounded-full bg-neutral-900' });
      expect(out).not.toContain('rounded-sm');
      expect(out).not.toContain('rounded-md');
      expect(out).not.toContain('bg-surface-base');
      expect(out).not.toContain('bg-surface-subtle');
      expect(out).toContain('rounded-full');
      expect(out).toContain('bg-neutral-900');
      expect(out).toContain('shadow-sm'); // untouched
    });
  });

  describe('non-conflicts pass through untouched', () => {
    it('modifier prefixes form distinct buckets (hover:bg vs bg)', () => {
      // `hover:bg-red` and `bg-blue` target different states — the prefixed
      // class must survive. The plain-state `bg-red` is in the same bucket
      // as the override `bg-blue` and is correctly stripped.
      const styles = tv({ slots: { base: 'bg-red hover:bg-red' } })();
      const out = styles.base({ class: 'bg-blue' });
      const tokens = out.split(/\s+/);
      expect(tokens).not.toContain('bg-red');
      expect(tokens).toContain('hover:bg-red');
      expect(tokens).toContain('bg-blue');
    });

    it('padding shorthand does not strip per-side padding', () => {
      // `p-4` and `px-2` are different buckets — both stay; Tailwind's own
      // cascade then lets `px-2` override horizontal padding only.
      const styles = tv({ slots: { base: 'p-4' } })();
      const out = styles.base({ class: 'px-2' });
      expect(out).toContain('p-4');
      expect(out).toContain('px-2');
    });

    it('border-width and border-color coexist', () => {
      const styles = tv({ slots: { base: 'border-2' } })();
      const out = styles.base({ class: 'border-red-500' });
      expect(out).toContain('border-2');
      expect(out).toContain('border-red-500');
    });

    it('border-1 (Tailwind v4 integer width) is a width, not a color', () => {
      // Pre-review: `border-1` mis-bucketed as border-color and was wrongly
      // stripped when override added `border-red-500`. Audit anchor.
      const styles = tv({ slots: { base: 'border-1' } })();
      const out = styles.base({ class: 'border-red-500' });
      const tokens = out.split(/\s+/);
      expect(tokens).toContain('border-1');
      expect(tokens).toContain('border-red-500');

      // And another `border-N` width override correctly strips.
      const out2 = styles.base({ class: 'border-4' });
      const tokens2 = out2.split(/\s+/);
      expect(tokens2).not.toContain('border-1');
      expect(tokens2).toContain('border-4');
    });

    it('decoration: style, thickness, color are three orthogonal buckets', () => {
      // Pre-review: all `decoration-*` shared one bucket. A color override
      // wrongly stripped thickness/style. Real-world: Button active-text
      // variant sets `decoration-2`.
      const styles = tv({
        slots: { base: 'decoration-2 decoration-dashed decoration-blue-500' }
      })();
      const out = styles.base({ class: 'decoration-red-500' });
      const tokens = out.split(/\s+/);
      expect(tokens).toContain('decoration-2');
      expect(tokens).toContain('decoration-dashed');
      expect(tokens).not.toContain('decoration-blue-500');
      expect(tokens).toContain('decoration-red-500');

      // Thickness override only strips thickness.
      const out2 = styles.base({ class: 'decoration-4' });
      const tokens2 = out2.split(/\s+/);
      expect(tokens2).not.toContain('decoration-2');
      expect(tokens2).toContain('decoration-4');
      expect(tokens2).toContain('decoration-dashed');
      expect(tokens2).toContain('decoration-blue-500');
    });

    it('unknown / custom classes never conflict', () => {
      // `blocks-menu--open` is a component-internal hook — must pass
      // through; consumers must be able to override anything else.
      const styles = tv({ slots: { base: 'blocks-menu--open custom-thing' } })();
      const out = styles.base({ class: 'another-hook bg-red' });
      expect(out).toContain('blocks-menu--open');
      expect(out).toContain('custom-thing');
      expect(out).toContain('another-hook');
      expect(out).toContain('bg-red');
    });

    it('text-size, text-align, text-color are separate buckets', () => {
      // All three should coexist after one override targets just `text-size`.
      const styles = tv({ slots: { base: 'text-sm text-center text-text-primary' } })();
      const out = styles.base({ class: 'text-lg' });
      expect(out).not.toContain('text-sm');
      expect(out).toContain('text-lg');
      expect(out).toContain('text-center');
      expect(out).toContain('text-text-primary');
    });

    it('sub-xs scale (text-2xs/3xs) is text-size, not text-color', () => {
      // `2xs` matches neither `xs` nor `\d+xl`, so before the `\d+xs` alternative
      // these fell through to the text-color catch-all: a color override would
      // have silently stripped the font size.
      const styles = tv({ slots: { base: 'text-2xs text-text-secondary' } })();
      const out = styles.base({ class: 'text-text-primary' });
      expect(out).toContain('text-2xs');
      expect(out).toContain('text-text-primary');
      expect(out).not.toContain('text-text-secondary');
    });

    it('sub-xs scale collapses with the rest of the type scale to one winner', () => {
      // Two font sizes surviving together would leave CSS source order to decide.
      const styles = tv({ slots: { base: 'text-3xs' } })();
      const out = styles.base({ class: 'text-lg' });
      expect(out).toContain('text-lg');
      expect(out).not.toContain('text-3xs');

      const back = tv({ slots: { base: 'text-lg' } })().base({ class: 'text-2xs' });
      expect(back).toContain('text-2xs');
      expect(back).not.toContain('text-lg');

      // …and the two sub-scale steps collapse against each other.
      const within = tv({ slots: { base: 'text-2xs' } })().base({ class: 'text-3xs' });
      expect(within).toContain('text-3xs');
      expect(within).not.toContain('text-2xs');
    });

    it('sub-xs scale keeps the v4 leading-shorthand in the text-size bucket', () => {
      const styles = tv({ slots: { base: 'text-2xs/4 text-text-secondary' } })();
      const out = styles.base({ class: 'text-text-primary' });
      expect(out).toContain('text-2xs/4');
      expect(out).toContain('text-text-primary');
    });

    it('text-shadow-2xs is still text-shadow, not the sub-xs type scale', () => {
      // The `\d+xs` alternative must not reach past the text-shadow- prefix rules.
      const styles = tv({ slots: { base: 'text-shadow-2xs text-2xs' } })();
      const out = styles.base({ class: 'text-shadow-lg' });
      expect(out).toContain('text-shadow-lg');
      expect(out).not.toContain('text-shadow-2xs');
      expect(out).toContain('text-2xs');
    });

    it('font-weight does not strip font-family', () => {
      const styles = tv({ slots: { base: 'font-medium font-mono' } })();
      const out = styles.base({ class: 'font-bold' });
      expect(out).not.toContain('font-medium');
      expect(out).toContain('font-bold');
      expect(out).toContain('font-mono');
    });

    it('negative-sign spacing shares bucket with positive', () => {
      // `mt-2` and `-mt-2` would otherwise produce two competing top-margin
      // rules in source order; treating them as one bucket lets the later
      // stage win deterministically.
      const styles = tv({ slots: { base: 'mt-2' } })();
      const out = styles.base({ class: '-mt-4' });
      expect(out).not.toContain('mt-2');
      expect(out).toContain('-mt-4');
    });

    it('responsive modifier prefixes are isolated', () => {
      const styles = tv({ slots: { base: 'w-5 md:w-10 lg:w-20' } })();
      const out = styles.base({ class: 'w-7' });
      expect(out).not.toMatch(/\bw-5\b/);
      expect(out).toContain('md:w-10');
      expect(out).toContain('lg:w-20');
      expect(out).toContain('w-7');
    });

    it('!-important is normalized — bang position does not affect bucket', () => {
      // Tailwind v3 leading `!bg-red`, v4 trailing `bg-red!`, and modifier
      // forms `hover:!bg-red` / `hover:bg-red!` all share their non-`!` bucket.
      const styles = tv({ slots: { base: 'bg-red' } })();
      expect(styles.base({ class: '!bg-blue' }).split(/\s+/)).not.toContain('bg-red');
      expect(styles.base({ class: 'bg-blue!' }).split(/\s+/)).not.toContain('bg-red');

      const hoverStyles = tv({ slots: { base: 'hover:bg-red' } })();
      expect(hoverStyles.base({ class: 'hover:!bg-blue' }).split(/\s+/)).not.toContain(
        'hover:bg-red'
      );
      expect(hoverStyles.base({ class: 'hover:bg-blue!' }).split(/\s+/)).not.toContain(
        'hover:bg-red'
      );
    });

    it('arbitrary-value classes share bucket with their family', () => {
      const styles = tv({ slots: { base: 'w-5' } })();
      const out = styles.base({ class: 'w-[37px]' });
      expect(out.split(/\s+/)).not.toContain('w-5');
      expect(out.split(/\s+/)).toContain('w-[37px]');
    });

    it('text-size with v4 leading-shorthand stays in text-size bucket', () => {
      // Pre-review: `text-base/6` (Tailwind v4 size+line-height) fell to
      // text-color catch-all.
      const styles = tv({ slots: { base: 'text-sm' } })();
      const out = styles.base({ class: 'text-base/6' });
      const tokens = out.split(/\s+/);
      expect(tokens).not.toContain('text-sm');
      expect(tokens).toContain('text-base/6');
    });
  });

  describe('bucket classification — arbitrary properties & overloaded families', () => {
    it('[gap:inherit] is stripped by a later gap utility (Codeberg #21 follow-up)', () => {
      const styles = tv({ slots: { base: 'flex [gap:inherit]' } })();
      const tokens = styles.base({ class: 'gap-4' }).split(/\s+/);
      expect(tokens).not.toContain('[gap:inherit]');
      expect(tokens).toContain('gap-4');
      expect(tokens).toContain('flex');
    });

    it('same-property arbitraries conflict; different properties pass through', () => {
      const styles = tv({
        slots: { base: '[--spinner-speed:1s] [animation-duration:var(--spinner-speed)]' }
      })();
      const tokens = styles.base({ class: '[--spinner-speed:2s]' }).split(/\s+/);
      expect(tokens).not.toContain('[--spinner-speed:1s]');
      expect(tokens).toContain('[--spinner-speed:2s]');
      expect(tokens).toContain('[animation-duration:var(--spinner-speed)]');
    });

    it('modifier prefixes isolate arbitrary properties too', () => {
      const styles = tv({ slots: { base: 'hover:[transform:rotate(3deg)]' } })();
      const out = styles.base({ class: '[transform:none]' });
      expect(out).toContain('hover:[transform:rotate(3deg)]');
      expect(out).toContain('[transform:none]');
    });

    it('arbitrary transform property shares the transform utility bucket', () => {
      const styles = tv({ slots: { base: '[transform:translateZ(0)]' } })();
      const tokens = styles.base({ class: 'transform-none' }).split(/\s+/);
      expect(tokens).not.toContain('[transform:translateZ(0)]');
      expect(tokens).toContain('transform-none');
    });

    it('v4 gradients and bg-size are bg-image/bg-size, never stripping bg-color (Skeleton wave)', () => {
      // Pre-fix `bg-linear-to-r` and `bg-size-[…]` bucketed as bg-color and
      // stripped the slot-base `bg-surface-interactive` — the shimmer floated
      // on a transparent skeleton.
      const styles = skeletonVariants({ animation: 'wave' });
      const tokens = styles.base().split(/\s+/);
      expect(tokens).toContain('bg-surface-interactive');
      expect(tokens).toContain('bg-linear-to-r');
      expect(tokens).toContain('bg-size-[200%_100%]');
    });

    it('arbitrary gradient values are bg-image too (Progress striped fill)', () => {
      const styles = tv({ slots: { base: 'bg-primary' } })();
      const out = styles.base({
        class: 'bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%)]'
      });
      expect(out).toContain('bg-primary');
      expect(out).toContain('bg-[linear-gradient(');
    });

    it('bg data-type hints do not collide with bg-color (Progress striped)', () => {
      const styles = tv({ slots: { base: 'bg-primary' } })();
      const out = styles.base({ class: 'bg-[length:1rem_1rem]' });
      expect(out).toContain('bg-primary');
      expect(out).toContain('bg-[length:1rem_1rem]');
    });

    it('shadow-<semantic-color> is a color, not a named size', () => {
      const styles = tv({ slots: { base: 'shadow-md shadow-primary' } })();
      const tokens = styles.base({ class: 'shadow-danger' }).split(/\s+/);
      expect(tokens).toContain('shadow-md');
      expect(tokens).not.toContain('shadow-primary');
      expect(tokens).toContain('shadow-danger');
    });

    it('col-span, col-start and col-end are orthogonal grid properties', () => {
      const styles = tv({ slots: { base: 'col-span-2 col-start-1' } })();
      const tokens = styles.base({ class: 'col-end-3' }).split(/\s+/);
      expect(tokens).toContain('col-span-2');
      expect(tokens).toContain('col-start-1');
      expect(tokens).toContain('col-end-3');
      const tokens2 = styles.base({ class: 'col-span-4' }).split(/\s+/);
      expect(tokens2).not.toContain('col-span-2');
      expect(tokens2).toContain('col-start-1');
    });

    it('divide width and color are orthogonal; widths conflict (Accordion card)', () => {
      const card = accordionVariants({ variant: 'card' }).base().split(/\s+/);
      expect(card).not.toContain('divide-y');
      expect(card).toContain('divide-y-0');
      // Color stays untouched by the width swap.
      expect(card).toContain('divide-border-hairline');
    });

    it('border-collapse / border-spacing are not border colors', () => {
      const styles = tv({ slots: { base: 'border-collapse border-spacing-2' } })();
      const tokens = styles.base({ class: 'border-danger' }).split(/\s+/);
      expect(tokens).toContain('border-collapse');
      expect(tokens).toContain('border-spacing-2');
      expect(tokens).toContain('border-danger');
    });

    it('transition-behavior composes with transition-property (v4)', () => {
      const styles = tv({ slots: { base: 'transition-colors' } })();
      const out = styles.base({ class: 'transition-discrete' });
      expect(out).toContain('transition-colors');
      expect(out).toContain('transition-discrete');
    });

    it('text-wrap and text-overflow are separate buckets', () => {
      const styles = tv({ slots: { base: 'text-ellipsis text-nowrap' } })();
      const tokens = styles.base({ class: 'text-wrap' }).split(/\s+/);
      expect(tokens).toContain('text-ellipsis');
      expect(tokens).not.toContain('text-nowrap');
      expect(tokens).toContain('text-wrap');
    });

    it('bare outline is the 1px width step, so it replaces outline-2 and not outline-dashed', () => {
      // Measured against the compiler: `outline` writes `outline-width: 1px`
      // beside `outline-style: var(--tw-outline-style)`, the identical property
      // set `outline-2` writes. `outline-dashed` writes no width at all, so the
      // pair Tailwind's docs spell for a 1px dashed outline has to survive.
      const width = tv({ slots: { base: 'outline-2' } })();
      const widthTokens = width.base({ class: 'outline' }).split(/\s+/);
      expect(widthTokens).not.toContain('outline-2');
      expect(widthTokens).toContain('outline');

      const style = tv({ slots: { base: 'outline' } })();
      const styleTokens = style.base({ class: 'outline-dashed' }).split(/\s+/);
      expect(styleTokens).toContain('outline');
      expect(styleTokens).toContain('outline-dashed');

      // The price, pinned so the trade-off is a decision and not a drift: the
      // library writes `outline-none` at 113 slot sites and a consumer `outline`
      // no longer strips it. A DOMINANCE edge would buy that back and re-break
      // the pairing above, so it stays unresolved.
      const none = tv({ slots: { base: 'outline-none' } })();
      const bothSurvive = none.base({ class: 'outline' }).split(/\s+/);
      expect(bothSurvive).toContain('outline-none');
      expect(bothSurvive).toContain('outline');
    });

    it('break-words is overflow-wrap, so word-break overrides leave it alone', () => {
      // `break-words` writes `overflow-wrap` alone and `break-all` writes
      // `word-break` alone (measured); two properties under one prefix. The v4
      // spellings of the first are the `wrap-*` trio.
      const slot = tv({ slots: { base: 'break-words' } })();
      expect(slot.base({ class: 'break-all' }).split(/\s+/)).toContain('break-words');
      expect(slot.base({ class: 'wrap-anywhere' }).split(/\s+/)).not.toContain('break-words');
    });

    it('break-normal is the reset and strips both longhands, in both spellings', () => {
      // `break-normal` writes `overflow-wrap` AND `word-break`, so DOMINANCE
      // carries it. Leaving it in `word-break` handed the reset to the cascade,
      // which decides against it: `.break-normal` is emitted before
      // `.break-words` at equal specificity, so the pair renders
      // `overflow-wrap: break-word` (measured in Chromium). The library ships
      // `break-words` at 13 slot sites, so this is the pairing a consumer hits.
      const wrap = tv({ slots: { base: 'break-words' } })();
      expect(wrap.base({ class: 'break-normal' }).split(/\s+/)).not.toContain('break-words');

      const axis = tv({ slots: { base: 'break-all' } })();
      expect(axis.base({ class: 'break-normal' }).split(/\s+/)).not.toContain('break-all');

      // The reverse never strips — a longhand refines the reset it follows.
      const reset = tv({ slots: { base: 'break-normal' } })();
      const refined = reset.base({ class: 'break-all' }).split(/\s+/);
      expect(refined).toContain('break-normal');
      expect(refined).toContain('break-all');
    });

    it('the logical axes are their own buckets, and start-* is the inline one', () => {
      // Tailwind 4.2 added `border-bs/be-*` and `inset-bs/be/s/e-*`; each writes
      // a block/inline property of its own (measured), so a colour catch-all
      // must not swallow them. `start-*` is the shorter spelling of `inset-s-*`
      // and writes the same property, so the two share a bucket.
      const border = tv({ slots: { base: 'border-primary' } })();
      expect(border.base({ class: 'border-be-2' }).split(/\s+/)).toContain('border-primary');

      const inset = tv({ slots: { base: 'inset-0' } })();
      expect(inset.base({ class: '-inset-s-4' }).split(/\s+/)).toContain('inset-0');

      const start = tv({ slots: { base: 'start-4' } })();
      expect(start.base({ class: 'inset-s-8' }).split(/\s+/)).not.toContain('start-4');
    });

    it('a gradient stop position does not strip the stop colour', () => {
      // `from-50%` writes `--tw-gradient-from-position`, `from-primary` writes
      // `--tw-gradient-from` (measured) — two properties under one prefix, the
      // shape `stroke-` already carries.
      const slot = tv({ slots: { base: 'from-primary via-primary to-primary' } })();
      const tokens = slot.base({ class: 'from-50% via-50% to-50%' }).split(/\s+/);
      expect(tokens).toContain('from-primary');
      expect(tokens).toContain('via-primary');
      expect(tokens).toContain('to-primary');
      expect(tokens).toContain('from-50%');
    });

    it('a blend mode does not strip the background colour', () => {
      const slot = tv({ slots: { base: 'bg-primary' } })();
      const tokens = slot.base({ class: 'bg-blend-multiply' }).split(/\s+/);
      expect(tokens).toContain('bg-primary');
      expect(tokens).toContain('bg-blend-multiply');
    });
  });

  describe('within-stage fold — later axis / later compound wins', () => {
    it('a later variant axis strips an earlier axis in the same bucket', () => {
      const component = tv({
        slots: { base: '' },
        variants: {
          a: { one: { base: 'bg-red' } },
          b: { two: { base: 'bg-blue' } }
        }
      });
      const tokens = component({ a: 'one', b: 'two' }).base().split(/\s+/);
      expect(tokens).not.toContain('bg-red');
      expect(tokens).toContain('bg-blue');
    });

    it('XC-10: the underline variant beats the tier radius deterministically', () => {
      // Pre-fold both `rounded-modify` (tier axis) and `rounded-none`
      // (variant axis) were emitted and stylesheet order decided the winner.
      const tokens = inputVariants({ variant: 'underline' }).base().split(/\s+/);
      expect(tokens).not.toContain('rounded-modify');
      expect(tokens).toContain('rounded-none');
    });

    it('a later matching compound strips an earlier matching compound (Button active)', () => {
      const styles = buttonVariants({
        intent: 'primary',
        variant: 'filled',
        active: true,
        size: 'md'
      });
      const tokens = styles.base().split(/\s+/);
      expect(tokens).not.toContain('bg-primary');
      expect(tokens).toContain('bg-primary-active');
      expect(tokens).not.toContain('hover:bg-primary-hover');
      expect(tokens).toContain('hover:bg-primary-active');
    });

    it('flat variants (ghost) beat the pressed depth cue; filled keeps it', () => {
      // `pressed` is declared before `variant` for exactly this.
      const ghost = buttonVariants({ variant: 'ghost', pressed: true, size: 'md' })
        .base()
        .split(/\s+/);
      expect(ghost).toContain('shadow-none');
      expect(ghost).not.toContain('shadow-[var(--blocks-shadow-xs)]');

      const filled = buttonVariants({ variant: 'filled', pressed: true, size: 'md' })
        .base()
        .split(/\s+/);
      expect(filled).toContain('shadow-[var(--blocks-shadow-xs)]');
      expect(filled).not.toContain('shadow-[var(--blocks-shadow-sm)]');
    });

    it('error tone wins the message color in every call shape', () => {
      // `messageType` is declared before `error` for exactly this — a direct
      // `{ error: true }` call (public variants() API) must read red even
      // though the component couples `messageType: error ? 'error' : 'helper'`.
      const message = inputVariants({ error: true }).message().split(/\s+/);
      expect(message).toContain('text-danger-text');
      expect(message).not.toContain('text-text-tertiary');
    });

    it('pagination layout gap beats the per-size default gap', () => {
      // `size` is declared before `layout` for exactly this.
      const tokens = paginationVariants({ layout: 'table', size: 'md' }).base().split(/\s+/);
      expect(tokens).toContain('gap-4');
      expect(tokens).not.toContain('gap-1');
    });

    it('segmentgroup text variant zeroes the track via compound', () => {
      const styles = segmentGroupVariants({ variant: 'text', size: 'md' });
      const tokens = styles.base().split(/\s+/);
      expect(tokens).toContain('p-0');
      expect(tokens).not.toContain('p-1');
      expect(tokens).toContain('rounded-none');
      expect(tokens).not.toContain('rounded-commit');
    });

    it('intra-source pairings stay intact (no fold within one source)', () => {
      const styles = tv({ slots: { base: 'rounded-md rounded-t-none' } })();
      const tokens = styles.base().split(/\s+/);
      expect(tokens).toContain('rounded-md');
      expect(tokens).toContain('rounded-t-none');
    });
  });

  describe('shorthand dominance — a later shorthand strips earlier longhands', () => {
    it('a consumer p-0 override defeats library px/pl paddings (Input)', () => {
      // Pre-dominance all three classes were emitted and Tailwind's own
      // cascade let the longhands win — the override silently failed.
      const styles = inputVariants({ size: 'md', hasLeftIcon: true });
      const tokens = styles.base({ class: 'p-0' }).split(/\s+/);
      expect(tokens).not.toContain('px-4');
      expect(tokens).not.toContain('pl-10');
      expect(tokens).toContain('p-0');
    });

    it('a later longhand refines an earlier shorthand (no reverse dominance)', () => {
      const styles = tv({ slots: { base: 'p-4' } })();
      const tokens = styles.base({ class: 'pl-2' }).split(/\s+/);
      expect(tokens).toContain('p-4');
      expect(tokens).toContain('pl-2');
    });

    it('rounded-none strips per-side radii (Dialog fullscreen)', () => {
      // Shipped bug: on mobile (below sm:) the fullscreen panel kept
      // rounded-t-contain because the corner-specific class won stylesheet
      // order against the size variant's explicit rounded-none.
      const tokens = dialogVariants({ size: 'fullscreen' }).panel().split(/\s+/);
      expect(tokens).not.toContain('rounded-t-contain');
      expect(tokens).toContain('rounded-none');
      expect(tokens).not.toContain('sm:rounded-contain');
      expect(tokens).toContain('sm:rounded-none');
    });

    it('modifier prefixes bound dominance (hover:p-0 spares plain px-4)', () => {
      const styles = tv({ slots: { base: 'px-4' } })();
      const tokens = styles.base({ class: 'hover:p-0' }).split(/\s+/);
      expect(tokens).toContain('px-4');
      expect(tokens).toContain('hover:p-0');
    });

    it('size-* strips w/h when later; w/h never strip size-*', () => {
      const a = tv({ slots: { base: 'w-5 h-5' } })()
        .base({ class: 'size-8' })
        .split(/\s+/);
      expect(a).not.toContain('w-5');
      expect(a).not.toContain('h-5');
      expect(a).toContain('size-8');

      const b = tv({ slots: { base: 'size-5' } })()
        .base({ class: 'w-7' })
        .split(/\s+/);
      expect(b).toContain('size-5');
      expect(b).toContain('w-7');
    });

    it('badge removable pr-2 survives the counter px compounds', () => {
      const tokens = badgeVariants({ counter: true, removable: true, size: 'md' })
        .base()
        .split(/\s+/);
      expect(tokens).toContain('pr-2');
      expect(tokens).toContain('px-1.5');
    });

    it('leading-* deliberately survives a later text-size (no font-size dominance)', () => {
      // The library pairs slot-base leading with axis text sizes across
      // sources by design — see the DOMINANCE comment in variants.ts.
      const component = tv({
        slots: { base: 'leading-tight' },
        variants: { size: { md: { base: 'text-sm' } } }
      });
      const tokens = component({ size: 'md' }).base().split(/\s+/);
      expect(tokens).toContain('leading-tight');
      expect(tokens).toContain('text-sm');
    });
  });

  // Families that had no bucket until the compiler was asked. Each pair is one
  // the resolver used to leave both alive, so the compiled stylesheet's emit
  // order decided which of the two rendered.
  describe('families the compiler named and the table was missing', () => {
    const overrides: [string, string, string][] = [
      ['fill-primary', 'fill-danger', 'SVG paint — Sankey nodes, the Spinner arc'],
      ['stroke-current', 'stroke-danger', 'SVG stroke colour'],
      ['stroke-2', 'stroke-[2px]', 'a stroke width in the unit spelling'],
      ['stroke-[1.5]', 'stroke-(length:--w)', 'a stroke width through a custom property'],
      ['box-border', 'box-content', 'box-sizing'],
      ['box-decoration-clone', 'box-decoration-slice', 'box-decoration-break'],
      ['list-disc', 'list-none', 'list-style-type'],
      ['overscroll-contain', 'overscroll-auto', 'overscroll-behavior'],
      ['scheme-light', 'scheme-dark', 'color-scheme'],
      ['scroll-pl-10', 'scroll-pl-0', "Calendar's time-grid scroll gutter"],
      ['snap-x', 'snap-none', 'scroll-snap-type'],
      ['sr-only', 'not-sr-only', 'the visually-hidden pair'],
      ['tabular-nums', 'proportional-nums', 'the numeric-spacing sub-axis'],
      ['touch-none', 'touch-auto', 'touch-action'],
      ['@container', '@container-normal', 'container-type'],
      ['blur-sm', 'blur-[2px]', 'an arbitrary filter value'],
      ['backdrop-blur-sm', 'backdrop-blur-[2px]', 'the same, on the backdrop'],
      ['grayscale', 'grayscale-[30%]', 'an arbitrary filter value'],
      ['[-ms-overflow-style:none]', '[-ms-overflow-style:auto]', 'a vendor-prefixed property'],
      ["before:content-['']", "before:content-['x']", 'the pseudo-element content']
    ];
    for (const [libraryClass, consumerClass, why] of overrides) {
      it(`a consumer ${consumerClass} replaces ${libraryClass} (${why})`, () => {
        const tokens = tv({ slots: { base: libraryClass } })()
          .base({ class: consumerClass })
          .split(/\s+/);
        expect(tokens).not.toContain(libraryClass);
        expect(tokens).toContain(consumerClass);
      });
    }

    it('keeps classes that compose rather than replace', () => {
      // Each pair writes a DIFFERENT property (measured): the shorthand and its
      // axis, the snap type and its strictness, two numeric sub-axes, the
      // touch-action keyword and a pan variable, the SVG paint and its width,
      // an alignment and a pseudo-element's content. Bucketing them together
      // would make a composition strip itself.
      const compositions: [string, string][] = [
        ['overscroll-contain', 'overscroll-x-auto'],
        ['snap-x', 'snap-mandatory'],
        ['tabular-nums', 'ordinal'],
        ['touch-none', 'touch-pan-x'],
        // `stroke-current` is live on Progress's circular track and indicator
        // and on the table's loading spinner. An SVG's initial `stroke` is
        // `none`, so reading a width as a paint does not shift the mark — it
        // deletes it.
        ['stroke-current', 'stroke-[3px]'],
        ['stroke-primary', 'stroke-[length:2px]'],
        // Tailwind 4.1 safe alignment. `content-center-safe` is align-content;
        // a value-exact list did not know the suffix and dropped it into the
        // pseudo-element `content` bucket, where each stripped the other.
        ['content-center-safe', "content-['×']"],
        ["content-['×']", 'content-end-safe']
      ];
      for (const [a, b] of compositions) {
        const tokens = tv({ slots: { base: a } })()
          .base({ class: b })
          .split(/\s+/);
        expect(tokens).toContain(a);
        expect(tokens).toContain(b);
      }
    });

    it('flex-shrink-0 and shrink-0 are one bucket, not two spellings of nothing', () => {
      // Tailwind 4 compiles both to the same declaration, so a slot writing one
      // and an override writing the other must resolve.
      const tokens = tv({ slots: { base: 'flex-shrink-0' } })()
        .base({ class: 'shrink' })
        .split(/\s+/);
      expect(tokens).not.toContain('flex-shrink-0');
      expect(tokens).toContain('shrink');
    });

    it('scale-z-* refines scale-* instead of replacing it', () => {
      // `scale-110` sets all three factor variables, `scale-z-150` only the z
      // one — reading them as one bucket dropped the x/y scaling back to 1.
      const refine = tv({ slots: { base: 'scale-110' } })()
        .base({ class: 'scale-z-150' })
        .split(/\s+/);
      expect(refine).toContain('scale-110');
      expect(refine).toContain('scale-z-150');

      // The other direction still replaces: `scale: x y` sets z implicitly.
      const replace = tv({ slots: { base: 'scale-z-150' } })()
        .base({ class: 'scale-110' })
        .split(/\s+/);
      expect(replace).not.toContain('scale-z-150');
      expect(replace).toContain('scale-110');
    });

    it('skew-* without an axis strips the axis forms, as translate-* does', () => {
      const tokens = tv({ slots: { base: 'skew-x-3 skew-y-3' } })()
        .base({ class: 'skew-6' })
        .split(/\s+/);
      expect(tokens).not.toContain('skew-x-3');
      expect(tokens).not.toContain('skew-y-3');
      expect(tokens).toContain('skew-6');
    });
  });

  describe('the inline shorthands reach both spellings of their axis', () => {
    // `px-*` writes `padding-inline`, the shorthand of the two properties
    // `ps-*`/`pe-*` write — so a consumer's px override must strip them, and
    // did not while the table listed only the physical `pr`/`pl`.
    const pairs: [string, string[], string][] = [
      ['px-8', ['ps-4', 'pe-4', 'pl-4', 'pr-4'], 'padding-inline'],
      ['mx-8', ['ms-4', 'me-4', 'ml-4', 'mr-4'], 'margin-inline'],
      ['inset-x-0', ['start-4', 'end-4', 'left-4', 'right-4'], 'inset-inline'],
      [
        'border-x-4',
        ['border-s-2', 'border-e-2', 'border-l-2', 'border-r-2'],
        'border-inline-width'
      ],
      [
        'border-x-danger',
        ['border-s-primary', 'border-e-primary', 'border-l-primary', 'border-r-primary'],
        'border-inline-color'
      ],
      ['scroll-p-0', ['scroll-ps-4', 'scroll-pe-4', 'scroll-pl-4', 'scroll-pr-4'], 'scroll-padding']
    ];
    for (const [shorthand, longhands, property] of pairs) {
      it(`${shorthand} strips every ${property} longhand`, () => {
        const tokens = tv({ slots: { base: longhands.join(' ') } })()
          .base({ class: shorthand })
          .split(/\s+/);
        for (const longhand of longhands) expect(tokens).not.toContain(longhand);
        expect(tokens).toContain(shorthand);
      });
    }
  });
});

// ─── tv: documented edge-cases ──────────────────────────────────────────────

describe('tv – edge-cases (documented behaviour)', () => {
  it('throws on config.base in slot mode instead of dropping it silently', () => {
    expect(() =>
      tv({
        base: 'no-slot-to-attach-to',
        slots: { wrapper: 'wrapper-class', icon: 'icon-class' }
      } as never)
    ).toThrowError(/mutually exclusive/);
  });

  it('throws on variant slot keys that do not match any declared slot', () => {
    // Slot-name typos are a config-time error now — compile-time via
    // ValidSlotVariants for literal configs, runtime via validateTvConfig
    // for everything else. Historically `wrapeer` was silently dropped.
    expect(() =>
      tv({
        slots: { base: 'base-class', icon: 'icon-class' },
        variants: {
          size: {
            md: { base: 'base-md', wrapeer: 'typo-md' } as never
          }
        }
      })
    ).toThrowError(/unknown slot 'wrapeer'/);
  });

  it('throws on compound conditions referencing unknown axes or values', () => {
    expect(() =>
      tv({
        slots: { base: '' },
        variants: { size: { sm: {}, md: {} } },
        compoundVariants: [{ sise: 'md', class: { base: 'x' } } as never]
      })
    ).toThrowError(/unknown variant axis 'sise'/);

    expect(() =>
      tv({
        slots: { base: '' },
        variants: { size: { sm: {}, md: {} } },
        compoundVariants: [{ size: 'xxl' as never, class: { base: 'x' } }]
      })
    ).toThrowError(/no such value/);
  });

  it('accepts half-declared boolean axes in compounds and defaults', () => {
    // `loading: { true: … }` + compound/default on `loading: false` is
    // idiomatic — false simply contributes no classes.
    expect(() =>
      tv({
        slots: { base: '' },
        variants: { loading: { true: { base: 'opacity-50' } } },
        compoundVariants: [{ loading: false, class: { base: 'cursor-pointer' } }],
        defaultVariants: { loading: false }
      })
    ).not.toThrow();
  });

  it('throws on defaultVariants referencing unknown axes or values', () => {
    expect(() =>
      tv({
        slots: { base: '' },
        variants: { size: { sm: {}, md: {} } },
        defaultVariants: { size: 'xl' as never }
      })
    ).toThrowError(/not a declared value/);
  });

  it('the true/false escape only applies to boolean-ish axes', () => {
    // `size: true` on a string axis is a config error, not a silent no-op.
    expect(() =>
      tv({
        slots: { base: '' },
        variants: { size: { sm: {}, md: {} } },
        defaultVariants: { size: true as never }
      })
    ).toThrowError(/not a declared value/);
    expect(() =>
      tv({
        slots: { base: '' },
        variants: { size: { sm: {}, md: {} } },
        compoundVariants: [{ size: true as never, class: { base: 'x' } }]
      })
    ).toThrowError(/no such value/);
  });

  it('validation recurses into arrays and slot-map values (no silent garbage)', () => {
    // A slot map nested inside a class array would route wholesale to the
    // 'base' slot and leak its KEYS as literal classes through cx()'s
    // record form — must throw at init instead.
    expect(() =>
      tv({
        slots: { base: 'b', label: 'l' },
        variants: { size: { sm: {} } },
        compoundVariants: [{ size: 'sm', class: [{ label: 'text-xs' }] as never }]
      })
    ).toThrowError(/must be a class string/);
    // Record nested in a no-slot variant-value array.
    expect(() =>
      tv({
        base: 'x',
        variants: { on: { true: ['a', { active: 1 }] as never } }
      })
    ).toThrowError(/must be a class string/);
    // Slot-map VALUES must bottom out in strings.
    expect(() =>
      tv({
        slots: { base: 'b' },
        variants: { size: { sm: { base: { oops: 'x' } } as never } }
      })
    ).toThrowError(/must be a class string/);
    // Scalar garbage.
    expect(() =>
      tv({
        slots: { base: 'b' },
        variants: { size: { sm: 4 as never } }
      })
    ).toThrowError(/must be a class string/);
  });

  it('text-shadow and inset-shadow split size from color', () => {
    const styles = tv({ slots: { base: 'text-shadow-lg text-shadow-black' } })();
    const tokens = styles.base({ class: 'text-shadow-white' }).split(/\s+/);
    expect(tokens).toContain('text-shadow-lg');
    expect(tokens).not.toContain('text-shadow-black');
    expect(tokens).toContain('text-shadow-white');

    const inset = tv({ slots: { base: 'inset-shadow-sm' } })();
    const insetTokens = inset.base({ class: 'inset-shadow-blue-500' }).split(/\s+/);
    expect(insetTokens).toContain('inset-shadow-sm');
    expect(insetTokens).toContain('inset-shadow-blue-500');
  });

  it('exposes the config for tooling via .config', () => {
    const component = tv({ slots: { base: 'x' }, variants: { size: { md: { base: 'y' } } } });
    expect(component.config.slots).toEqual({ base: 'x' });
    expect(Object.keys(component.config.variants ?? {})).toEqual(['size']);
  });

  it('class overrides accept the Svelte 5 ClassValue record form (clsx shape)', () => {
    // Keys are class names, values are conditions — NOT a slot map. Slot
    // maps only exist config-side (variants / compound classes).
    const component = tv({
      slots: { base: 'base-class', icon: 'icon-class' }
    });
    const styles = component();
    const out = styles.base({ class: { active: true, hidden: false } });
    expect(out).toContain('base-class');
    expect(out).toContain('active');
    expect(out).not.toContain('hidden');
  });
});

// ─── cx: ClassValue record form ─────────────────────────────────────────────

describe('cx – record form (Svelte 5 ClassValue parity)', () => {
  it('includes keys with truthy values, drops falsy ones', () => {
    expect(cx({ a: true, b: false, c: undefined, d: null })).toBe('a');
  });

  it('composes records with strings and nested arrays', () => {
    expect(cx('x', [{ y: true }, 'z'], { w: true })).toBe('x y z w');
  });

  it('record classes participate in conflict resolution like any class', () => {
    const styles = tv({ slots: { base: 'bg-red' } })();
    const tokens = styles.base({ class: { 'bg-blue': true } }).split(/\s+/);
    expect(tokens).not.toContain('bg-red');
    expect(tokens).toContain('bg-blue');
  });
});

// ─── resolveClassChain ──────────────────────────────────────────────────────

describe('resolveClassChain', () => {
  it('returns empty string for no / falsy sources', () => {
    expect(resolveClassChain()).toBe('');
    expect(resolveClassChain(undefined, null, '')).toBe('');
  });

  it('concatenates non-conflicting classes in source order', () => {
    expect(resolveClassChain('flex gap-2', 'rounded-md')).toBe('flex gap-2 rounded-md');
  });

  it('a later source strips an earlier class in the same bucket (later wins)', () => {
    expect(resolveClassChain('border-4', 'border')).toBe('border');
    expect(resolveClassChain('p-2 text-sm', 'p-4')).toBe('text-sm p-4');
  });

  it('orthogonal buckets coexist (border-width vs border-color)', () => {
    const tokens = resolveClassChain('border-2', 'border-red-500').split(/\s+/);
    expect(tokens).toContain('border-2');
    expect(tokens).toContain('border-red-500');
  });

  it('preserves conflicts within a single source (CSS cascade, like one tv() stage)', () => {
    expect(resolveClassChain('border-2 border-4')).toBe('border-2 border-4');
  });
});

// ─── matchesCompound (exported for the BlocksProvider override resolver) ─────

describe('matchesCompound', () => {
  it('matches on string equality and ignores class/className keys', () => {
    expect(
      matchesCompound({ variant: 'outlined', class: { base: 'x' } }, { variant: 'outlined' })
    ).toBe(true);
    expect(matchesCompound({ variant: 'outlined' }, { variant: 'filled' })).toBe(false);
  });

  it('treats an array constraint as "one of"', () => {
    expect(matchesCompound({ size: ['sm', 'md'] }, { size: 'md' })).toBe(true);
    expect(matchesCompound({ size: ['sm', 'md'] }, { size: 'lg' })).toBe(false);
  });

  it('normalizes booleans (true vs undefined do not match)', () => {
    expect(matchesCompound({ interactive: true }, { interactive: true })).toBe(true);
    expect(matchesCompound({ interactive: true }, { interactive: undefined })).toBe(false);
  });

  it('requires every condition to match (AND semantics)', () => {
    const cond = { variant: 'outlined', intent: 'primary' };
    expect(matchesCompound(cond, { variant: 'outlined', intent: 'primary' })).toBe(true);
    expect(matchesCompound(cond, { variant: 'outlined', intent: 'danger' })).toBe(false);
  });
});
