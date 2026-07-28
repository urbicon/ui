/**
 * The primer's whole value is that it is complete *and* bounded: everything a
 * task always needs, nothing a task only sometimes needs. Both halves of that
 * are asserted here, because both fail silently — a primer missing its token
 * half still prints something useful, and a primer that grew to include patterns
 * still works while quietly costing context on every call.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runPrimer } from './primer.js';

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const WITH_SELECTION = resolve(FIXTURES, 'content');
const WITHOUT_SELECTION = resolve(FIXTURES, 'content-no-selection');

let out: string[];
let err: string[];

beforeEach(() => {
  process.env.URBICON_CONTENT_DIR = WITH_SELECTION;
  out = [];
  err = [];
  vi.spyOn(console, 'log').mockImplementation((m?: unknown) => {
    out.push(String(m));
  });
  vi.spyOn(console, 'error').mockImplementation((m?: unknown) => {
    err.push(String(m));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  process.env.URBICON_CONTENT_DIR = WITH_SELECTION;
});

const stdout = (): string => out.join('\n');
const stderr = (): string => err.join('\n');

describe('runPrimer', () => {
  it('carries all three halves — component choice, layout, and what tokens are called', async () => {
    expect(await runPrimer([], {})).toBe(0);
    expect(stdout()).toContain('Component Selection');
    expect(stdout()).toContain('Combobox');
    // Layout joined the bundle on 2026-07-27: a recorded session called
    // `principles` zero times out of thirteen commands, so the section reached
    // nobody. Measured effect of the markup guidance: −24 % lines at equal
    // component count (n=8).
    expect(stdout()).toContain('Layout');
    expect(stdout()).toContain('Layout is markup');
    // The token half: one assertion per bundled family, so dropping a section
    // from CORE_SECTIONS fails here rather than surfacing as a hallucinated
    // token in someone's generated markup.
    for (const token of [
      'bg-surface-base',
      'text-text-primary',
      'border-border-default',
      'bg-primary',
      '--z-modal'
    ]) {
      expect(stdout(), `token reference is missing ${token}`).toContain(token);
    }
  });

  it('leaves out what is task-dependent — that is the point of the bundle', async () => {
    await runPrimer([], {});
    // Patterns and recipes exist in the fixture content dir; the primer must not
    // pull them in, or it becomes the llms-full.txt problem in miniature:
    // paying for context that most tasks never read.
    //
    // Asserted on pattern *bodies*, not their names: the layout section legitimately
    // points at `settings-page` ("see the pattern for the scale-based choice"), and a
    // pointer is the opposite of carrying the thing — it is how the bundle stays small.
    expect(stdout()).not.toContain('Two-column above');
    expect(stdout()).not.toContain('Grid of stat tiles');
    // Typography and theming are the two deliberately unbundled token sections.
    expect(stdout()).not.toContain('Font Families');
  });

  it('points at what it deliberately does not carry', async () => {
    await runPrimer([], {});
    expect(stdout()).toContain('get-component');
    expect(stdout()).toContain('urbicon pattern');
    expect(stdout()).toContain('validate');
  });

  it('fails loud when the selection half is missing, rather than printing half a primer', async () => {
    process.env.URBICON_CONTENT_DIR = WITHOUT_SELECTION;
    expect(await runPrimer([], {})).toBe(1);
    expect(stderr()).toContain('component-selection');
    expect(stdout()).toBe('');
  });

  it('reports an unreadable content bundle instead of throwing', async () => {
    process.env.URBICON_CONTENT_DIR = resolve(FIXTURES, 'does-not-exist');
    expect(await runPrimer([], {})).toBe(1);
    expect(stderr()).toContain('design principles');
  });
});
