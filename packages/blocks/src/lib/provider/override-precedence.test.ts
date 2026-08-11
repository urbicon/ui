import { describe, expect, it } from 'vitest';
import { tv } from '$lib/utils/variants';
import { type BlocksConfig, resolveSlotClasses } from './blocks-context';

/**
 * What an instance `class` prop actually outranks — the whole cascade, run end
 * to end, from provider config to the final class string.
 *
 * This exists because the docs said it wrong twice in the same direction
 * ("class beats everything BlocksProvider set"), and the reason it kept coming
 * back is that the seven-step ladder reads like seven stages and is two:
 * `resolveSlotClasses` folds steps 2–6 into ONE string, and that string plus
 * the instance `class` reach `tv()` together as a single source. Within one
 * source the engine deliberately does not pick a winner — an author writing
 * `rounded-md rounded-t-none` means both — so `class` reliably defeats only the
 * library's own defaults.
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
 * `styles.base({ class: [slotClasses?.base, className] })`. */
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

  it('does NOT defeat a provider default — both survive, the cascade decides', () => {
    // `class` and the folded provider string are one source by the time `tv()`
    // sees them, so neither strips the other and the rendered corner depends on
    // stylesheet order rather than on this call.
    const result = render({ providerDefault: 'rounded-none', className: 'rounded-full' });
    expect(result).toContain('rounded-none');
    expect(result).toContain('rounded-full');
  });

  it('is instance slotClasses that defeats a provider default, deterministically', () => {
    const result = render({ providerDefault: 'rounded-none', instanceSlotClasses: 'rounded-full' });
    expect(result).toContain('rounded-full');
    expect(result).not.toContain('rounded-none');
  });
});

describe('the folded stages below it', () => {
  it('resolve in order, each stripping the previous one bucket by bucket', () => {
    // Steps 2–6 ARE a ladder: only the last radius in the chain survives. That
    // is what makes step 7 — `class` — the odd one out rather than the top.
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
