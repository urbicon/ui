import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveClassChain, tv } from '../../../../packages/blocks/src/lib/utils/variants';
import { precedenceChain } from './customization-data';

/**
 * What the override-precedence prose on /customization and
 * /customization/blocks-provider is allowed to say, measured against the engine
 * rather than reasoned about.
 *
 * It had been wrong twice in the same direction — "class beats everything
 * BlocksProvider set" — because the seven-step ladder reads like seven stages
 * and is two: `resolveSlotClasses` folds steps 2–6 into ONE string with
 * `resolveClassChain`, and that string plus the instance `class` reach `tv()`
 * together as a single source. Within one source the engine deliberately does
 * not pick a winner (an author writing `rounded-md rounded-t-none` means both),
 * so `class` reliably defeats only the library's own defaults — step 1.
 *
 * The call shape mirrors a real component: Button.svelte does
 * `styles.base({ class: [slotClasses?.base, className] })`.
 */

const styles = tv({
  slots: { base: 'rounded-md px-4' },
  variants: { intent: { primary: 'bg-primary', neutral: 'bg-neutral' } },
  defaultVariants: { intent: 'primary' }
});

/**
 * One component instance. `provider` stands for anything `resolveSlotClasses`
 * folds — defaults, its conditional overrides, a preset and its overrides — and
 * `instanceSlotClasses` for the last fold before `tv()`; the wiring test below
 * pins that this is the shape blocks-context.ts still has.
 */
function render(options: { provider?: string; instanceSlotClasses?: string; className?: string }) {
  const folded = resolveClassChain(options.provider, options.instanceSlotClasses);
  return styles({}).base({ class: [folded, options.className] });
}

describe('what an instance class prop actually outranks', () => {
  it('defeats the library default: only the instance radius survives', () => {
    const result = render({ className: 'rounded-full' });
    expect(result).toContain('rounded-full');
    expect(result).not.toContain('rounded-md');
  });

  it('does NOT defeat a provider default — both survive, the cascade decides', () => {
    // The failure the prose hid: `class` and the folded provider string are one
    // source by the time `tv()` sees them, so neither strips the other and the
    // rendered corner depends on stylesheet order, not on this call.
    const result = render({ provider: 'rounded-none', className: 'rounded-full' });
    expect(result).toContain('rounded-none');
    expect(result).toContain('rounded-full');
  });

  it('is instance slotClasses that defeats a provider default, deterministically', () => {
    const result = render({ provider: 'rounded-none', instanceSlotClasses: 'rounded-full' });
    expect(result).toContain('rounded-full');
    expect(result).not.toContain('rounded-none');
  });
});

describe('the wiring these measurements assume', () => {
  const blocksLib = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../packages/blocks/src/lib'
  );

  it('still folds the provider stages with resolveClassChain, instance last', () => {
    // Read as text rather than imported: blocks-context.ts resolves through the
    // `$lib` alias, which this suite deliberately does not carry. If the fold
    // ever moves into `tv()` as its own source, `class` would start winning
    // against it and the prose below would have to change with it.
    const source = readFileSync(resolve(blocksLib, 'provider/blocks-context.ts'), 'utf8');
    expect(source).toContain('resolveClassChain(result[slot], value)');
    const start = source.indexOf('const sources:');
    expect(start, 'resolveSlotClasses no longer builds a `sources` list').toBeGreaterThan(-1);
    const sources = source.slice(start, source.indexOf('];', start));
    expect(sources, 'the fold order the ladder describes').toContain('defaults?.slotClasses');
    // Instance slotClasses is the last thing folded before `tv()` — steps 6
    // and 7 of the ladder meet there, which is the whole point below.
    expect(sources.indexOf('instanceSlotClasses')).toBeGreaterThan(
      sources.indexOf('presetDef?.overrides')
    );
  });

  it('still hands tv() the folded string and class as ONE source', () => {
    const button = readFileSync(resolve(blocksLib, 'primitives/button/Button.svelte'), 'utf8');
    expect(button).toContain('class: [slotClasses?.base, className]');
  });
});

describe('the ladder the pages render', () => {
  it('names step 1 as the one a class prop beats, and step 7 as its peer', () => {
    // The two ends carry the whole caveat: `class` wins against the library
    // default and shares its stage with everything the provider folded.
    expect(precedenceChain).toHaveLength(7);
    expect(precedenceChain[0]).toContain('the only stage a class prop reliably beats');
    expect(precedenceChain[5]).toContain('slotClasses');
    expect(precedenceChain[6]).toContain('same stage as slotClasses');
  });
});
