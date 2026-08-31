import { describe, expect, it } from 'vitest';
import { tv } from '$lib/utils/variants';
import { type BlocksConfig, resolveSlotClasses } from './blocks-context';

/**
 * What an instance `class` prop actually outranks — the whole cascade, run end
 * to end, from provider config to the final class string.
 *
 * The ladder is seven rungs and every one of them resolves against the rung
 * below: `resolveSlotClasses` folds rungs 2–6 into one string, and `tv()` takes
 * that string and the instance `class` as two separate sources, because the
 * call sites hand it an ARRAY and the engine reads a top-level array element as
 * one source. Whichever rung is written last wins the bucket.
 *
 * The prose those measurements license lives in the docs app
 * (`apps/docs/src/lib/customization-data.ts`, one shared sentence, checked by
 * `precedence.test.ts` there). This file is the half that can be measured.
 */

const styles = tv({
  slots: { base: 'rounded-md px-4' },
  variants: { intent: { primary: 'bg-primary', neutral: 'bg-neutral' } },
  defaultVariants: { intent: 'primary' }
});

/** One Button instance. The call shape is Button.svelte's own:
 * `styles.base({ class: [slotClasses?.base, className] })` — two array
 * elements, so two sources. */
function render(options: {
  providerDefault?: string;
  providerOverride?: string;
  preset?: string;
  instanceSlotClasses?: string;
  className?: string;
}) {
  const config: BlocksConfig = {
    unstyled: false,
    defaults: {
      Button: {
        slotClasses: options.providerDefault ? { base: options.providerDefault } : undefined,
        overrides: options.providerOverride
          ? [{ intent: 'primary', class: { base: options.providerOverride } }]
          : undefined
      }
    },
    presets: { Button: { fancy: { slotClasses: { base: options.preset ?? '' } } } }
  };
  const slots = resolveSlotClasses(
    config,
    'Button',
    options.preset ? 'fancy' : undefined,
    { intent: 'primary' },
    options.instanceSlotClasses ? { base: options.instanceSlotClasses } : undefined
  );
  return styles({}).base({ class: [slots.base, options.className] });
}

describe('what an instance class prop outranks', () => {
  it('defeats the library default: only the instance radius survives', () => {
    const result = render({ className: 'rounded-full' });
    expect(result).toContain('rounded-full');
    expect(result).not.toContain('rounded-md');
  });

  it('defeats a provider default too — only the instance radius survives', () => {
    const result = render({ providerDefault: 'rounded-none', className: 'rounded-full' });
    expect(result).toContain('rounded-full');
    expect(result).not.toContain('rounded-none');
  });

  it('loses to nothing below it: the whole cascade under a colliding class prop', () => {
    const result = render({
      providerDefault: 'rounded-none',
      providerOverride: 'rounded-sm',
      preset: 'rounded-lg',
      instanceSlotClasses: 'rounded-xl',
      className: 'rounded-full'
    });
    expect(result).toContain('rounded-full');
    for (const beaten of ['rounded-none', 'rounded-sm', 'rounded-lg', 'rounded-xl', 'rounded-md']) {
      expect(result.split(/\s+/), beaten).not.toContain(beaten);
    }
  });

  it('is instance slotClasses that defeats a provider default, deterministically', () => {
    const result = render({ providerDefault: 'rounded-none', instanceSlotClasses: 'rounded-full' });
    expect(result).toContain('rounded-full');
    expect(result).not.toContain('rounded-none');
  });
});

describe('the folded stages below it', () => {
  it('resolve in order, each stripping the previous one bucket by bucket', () => {
    // Rungs 2–6, without a `class` prop on top: only the last radius survives.
    const result = render({
      providerDefault: 'rounded-none',
      providerOverride: 'rounded-sm',
      preset: 'rounded-lg',
      instanceSlotClasses: 'rounded-full'
    });
    expect(result).toContain('rounded-full');
    for (const beaten of ['rounded-none', 'rounded-sm', 'rounded-lg', 'rounded-md']) {
      expect(result.split(/\s+/), beaten).not.toContain(beaten);
    }
  });
});
