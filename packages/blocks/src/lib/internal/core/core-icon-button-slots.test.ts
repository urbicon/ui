import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'tinyglobby';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * CoreIconButton supplies the interaction plumbing itself and runs NO variant
 * engine, so it does not tw-merge the incoming `class`. A call-site slot that
 * repeats one of those buckets is therefore resolved by stylesheet order rather
 * than by the override ladder — it looks intentional and behaves arbitrarily.
 *
 * This test discovers the call sites from source instead of hard-coding them, so
 * a component adopting CoreIconButton later is covered without anyone
 * remembering to extend a list.
 */

const LIB = join(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The buckets CoreIconButton owns. Anchored to class boundaries so `size-5`
 * doesn't trip the `select-none` probe and `disabled:hover:bg-x` is matched as
 * its own class.
 */
const PLUMBING: { label: string; pattern: RegExp }[] = [
  { label: 'inline-flex (core centres its content)', pattern: /(^|\s)inline-flex(\s|$)/ },
  { label: 'items-center', pattern: /(^|\s)items-center(\s|$)/ },
  { label: 'justify-center', pattern: /(^|\s)justify-center(\s|$)/ },
  { label: 'cursor-pointer', pattern: /(^|\s)cursor-pointer(\s|$)/ },
  { label: 'select-none', pattern: /(^|\s)select-none(\s|$)/ },
  { label: 'focus-visible:outline-none', pattern: /(^|\s)focus-visible:outline-none(\s|$)/ },
  { label: 'disabled:cursor-not-allowed', pattern: /(^|\s)disabled:cursor-not-allowed(\s|$)/ },
  { label: 'disabled:opacity-*', pattern: /(^|\s)disabled:opacity-[\w.[\]/%-]+(\s|$)/ },
  {
    label: 'disabled:pointer-events-none',
    pattern: /(^|\s)disabled:pointer-events-none(\s|$)/
  },
  // Redundant rather than conflicting: the core's disabled:pointer-events-none
  // already prevents hover from firing at all.
  { label: 'disabled:hover:* (hover cannot fire when disabled)', pattern: /(^|\s)disabled:hover:/ }
];

/** `<CoreIconButton … class={cls('slotName')}` — the shape every call site uses. */
const CALL_SITE = /<CoreIconButton\b[^>]*?class=\{cls\(\s*'([A-Za-z0-9_]+)'/gs;

type CallSite = { file: string; slot: string; resolved: string };

const sites: CallSite[] = [];

/**
 * Finds whichever tv() config in the component's directory owns the slot. The
 * export names differ per component (badgeVariants, chatMessageVariants, …), so
 * the config is identified by the slot it actually produces.
 */
async function resolveSlot(svelteFile: string, slot: string): Promise<string | undefined> {
  const dir = dirname(svelteFile);
  const configs = await glob(['*.variants.ts'], { cwd: dir, absolute: true });
  for (const config of configs) {
    const mod: Record<string, unknown> = await import(config);
    for (const exported of Object.values(mod)) {
      if (typeof exported !== 'function') continue;
      let styles: unknown;
      try {
        styles = (exported as () => unknown)();
      } catch {
        continue; // not a tv() factory
      }
      const fn = (styles as Record<string, unknown> | null)?.[slot];
      if (typeof fn === 'function') return (fn as () => string)();
    }
  }
  return undefined;
}

beforeAll(async () => {
  const files = await glob(['**/*.svelte'], {
    cwd: LIB,
    absolute: true,
    ignore: ['**/__fixtures__/**']
  });

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('<CoreIconButton')) continue;
    for (const match of source.matchAll(CALL_SITE)) {
      const slot = match[1];
      const resolved = await resolveSlot(file, slot);
      if (resolved === undefined) continue;
      sites.push({ file: file.slice(LIB.length + 1), slot, resolved });
    }
  }
}, 30_000);

describe('CoreIconButton call sites', () => {
  it('discovers the call sites (glob sanity — a silent zero would pass everything)', () => {
    expect(sites.length).toBeGreaterThanOrEqual(6);
    // The chat family adopted it in the 2026-07 redesign; if these vanish the
    // discovery regex broke rather than the code improving.
    const slots = sites.map((s) => s.slot);
    expect(slots).toContain('actionButton');
    expect(slots).toContain('sendButton');
  });

  it('no call-site slot repeats a bucket CoreIconButton already owns', () => {
    const offences: string[] = [];
    for (const site of sites) {
      for (const { label, pattern } of PLUMBING) {
        if (pattern.test(site.resolved)) {
          offences.push(`${site.file} → slot '${site.slot}' repeats ${label}`);
        }
      }
    }
    expect(offences, offences.join('\n')).toEqual([]);
  });
});
