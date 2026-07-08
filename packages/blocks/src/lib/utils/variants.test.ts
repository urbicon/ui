import { describe, expect, it } from 'vitest';
import { accordionVariants } from '../primitives/Accordion/accordion.variants';
import { buttonVariants } from '../primitives/Button/button.variants';
import { checkboxVariants } from '../primitives/Checkbox/checkbox.variants';
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

  it('merges config.base into base slot when both exist', () => {
    const component = tv({
      base: 'global-base',
      slots: { base: 'slot-base', other: 'other-slot' }
    });
    const styles = component();
    expect(styles.base()).toBe('global-base slot-base');
    expect(styles.other()).toBe('other-slot');
  });

  it('creates base slot from config.base when no base slot defined', () => {
    const component = tv({
      base: 'global-base',
      slots: { content: 'content-slot' }
    });
    const styles = component();
    expect(styles.content()).toBe('content-slot');
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
      expect(tokens).toContain('text-text-on-primary');
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
      // error-variant adds `text-danger`. Browser-verified that pre-fix the
      // tertiary color won the cascade.
      const styles = checkboxVariants({ error: true });
      const cls = styles.message();
      const tokens = cls.split(/\s+/);
      expect(tokens).not.toContain('text-text-tertiary');
      expect(tokens).toContain('text-danger');
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

    it('divide width and color are orthogonal; widths conflict (Accordion separated)', () => {
      const separated = accordionVariants({ variant: 'separated' }).base().split(/\s+/);
      expect(separated).not.toContain('divide-y');
      expect(separated).toContain('divide-y-0');
      // Color stays untouched by the width swap.
      expect(separated).toContain('divide-border-hairline');
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

    it('bare outline is a style (v4), so outline-2 survives it', () => {
      const styles = tv({ slots: { base: 'outline-2' } })();
      const tokens = styles.base({ class: 'outline' }).split(/\s+/);
      expect(tokens).toContain('outline-2');
      expect(tokens).toContain('outline');
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
      expect(message).toContain('text-danger');
      expect(message).not.toContain('text-text-tertiary');
    });

    it('pagination layout gap beats the per-size default gap', () => {
      // `size` is declared before `layout` for exactly this.
      const tokens = paginationVariants({ layout: 'table', size: 'md' }).base().split(/\s+/);
      expect(tokens).toContain('gap-4');
      expect(tokens).not.toContain('gap-1');
    });

    it('segmentgroup text appearance zeroes the track via compound', () => {
      const styles = segmentGroupVariants({ appearance: 'text', size: 'md' });
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
});

// ─── tv: documented edge-cases ──────────────────────────────────────────────

describe('tv – edge-cases (documented behaviour)', () => {
  it('drops config.base when no slot is named "base" (slot-mode)', () => {
    const component = tv({
      base: 'should-be-dropped',
      slots: { wrapper: 'wrapper-class', icon: 'icon-class' },
      variants: {
        size: { md: { wrapper: 'wrapper-md' } }
      }
    });
    const styles = component({ size: 'md' });
    // `config.base` only attaches to a slot literally named "base".
    // When the only slots are `wrapper` and `icon`, the base value is
    // silently discarded — see variants.ts comment above part 1.
    expect(styles.wrapper()).not.toContain('should-be-dropped');
    expect(styles.icon()).not.toContain('should-be-dropped');
    expect(styles.wrapper()).toBe('wrapper-class wrapper-md');
  });

  it('ignores variant slot keys that do not match any declared slot', () => {
    // Slot-name typos in `variants` are silently dropped — the engine
    // has no way to know the author meant a real slot. Slot-name
    // type-safety is one of the documented trade-offs of this engine.
    const component = tv({
      slots: { base: 'base-class', icon: 'icon-class' },
      variants: {
        size: {
          md: { base: 'base-md', wrapeer: 'typo-md' as never }
        }
      }
    });
    const styles = component({ size: 'md' });
    expect(styles.base()).toBe('base-class base-md');
    expect(styles.icon()).toBe('icon-class');
    // The typo'd "wrapeer" entry is ignored — no slot by that name.
  });

  it('ignores class-override keys for non-existent slots in slot-mode', () => {
    const component = tv({
      slots: { base: 'base-class', icon: 'icon-class' }
    });
    const styles = component();
    // A consumer-side override targeting a slot that does not exist
    // (`{ class: { nonexistent: '...' } }`) is silently dropped. The
    // existing slots still receive their declared classes intact.
    const baseOutput = styles.base({ class: { base: 'override', nonexistent: 'ghost' } as never });
    expect(baseOutput).toContain('base-class');
    expect(baseOutput).not.toContain('ghost');
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
