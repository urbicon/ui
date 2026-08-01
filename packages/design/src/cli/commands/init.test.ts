import { chmod, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit } from './init.js';

let dir: string;
let originalCwd: string;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  originalCwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), 'urbicon-init-'));
  process.chdir(dir);
  log = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(dir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const read = (p: string): Promise<string> => readFile(join(dir, p), 'utf-8');
const logged = (): string => log.mock.calls.map((call: unknown[]) => call.join(' ')).join('\n');

describe('runInit', () => {
  it('creates AGENTS.md with the context block and scaffolds the manifest', async () => {
    const code = await runInit([], {});
    expect(code).toBe(0);
    expect(await read('AGENTS.md')).toContain('urbicon:start');
    expect(await read('AGENTS.md')).toContain('Urbicon UI');
    expect(await read('design.manifest.md')).toContain('Product Intent');
  });

  it('appends the block to an existing AGENTS.md without destroying it', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Mine\n\nKeep me.\n');
    await runInit([], {});
    const agents = await read('AGENTS.md');
    expect(agents).toContain('Keep me.');
    expect(agents).toContain('urbicon:start');
  });

  it('is idempotent — a second run leaves AGENTS.md byte-identical', async () => {
    await runInit([], {});
    const first = await read('AGENTS.md');
    await runInit([], {});
    expect(await read('AGENTS.md')).toBe(first);
  });

  it('refreshes the block in place rather than duplicating it', async () => {
    await runInit([], {});
    await runInit([], {});
    expect(await read('AGENTS.md')).toMatch(/urbicon:start/);
    expect((await read('AGENTS.md')).match(/urbicon:start/g)).toHaveLength(1);
  });

  it('never overwrites an existing manifest', async () => {
    await writeFile(join(dir, 'design.manifest.md'), 'CUSTOM INTENT\n');
    await runInit([], {});
    expect(await read('design.manifest.md')).toBe('CUSTOM INTENT\n');
  });

  it('--hook merges the PostToolUse hook into .claude/settings.json', async () => {
    await runInit([], { hook: true });
    expect(await read('.claude/settings.json')).toContain('urbicon hook');
  });

  it('--hook preserves existing settings and merges exactly once', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(
      join(dir, '.claude/settings.json'),
      JSON.stringify({ model: 'opus', hooks: { PreToolUse: [{ matcher: 'Bash' }] } }, null, 2)
    );
    await runInit([], { hook: true });
    await runInit([], { hook: true }); // second run must not duplicate
    const settings = JSON.parse(await read('.claude/settings.json'));
    expect(settings.model).toBe('opus'); // unrelated key preserved
    expect(settings.hooks.PreToolUse).toHaveLength(1); // existing hook preserved
    expect(settings.hooks.PostToolUse).toHaveLength(1); // merged once, not twice
    expect(JSON.stringify(settings.hooks.PostToolUse)).toContain('urbicon hook');
  });

  it('--ci writes the design-gate workflow', async () => {
    await runInit([], { ci: true });
    expect(await read('.github/workflows/design-gate.yml')).toContain('urbicon validate');
  });

  it('fails loud on an unterminated urbicon:start marker instead of duplicating', async () => {
    await writeFile(join(dir, 'AGENTS.md'), '# Mine\n\n<!-- urbicon:start truncated, no end -->\n');
    const before = await read('AGENTS.md');
    const code = await runInit([], {});
    expect(code).toBe(1);
    expect(await read('AGENTS.md')).toBe(before); // never touched — no second block appended
  });

  it('--hook refuses a non-object settings.json instead of silently dropping the hook', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(join(dir, '.claude/settings.json'), '[]'); // valid JSON, wrong shape
    const code = await runInit([], { hook: true });
    expect(code).toBe(0); // init itself succeeds; only the hook step is skipped
    expect(await read('.claude/settings.json')).toBe('[]'); // left untouched, not rewritten
  });
});

/**
 * The primer step lives in `init`, not in the template, so that the template
 * stays a prompt base a harness can take verbatim. That split only holds if
 * both halves are asserted: the step must appear on the way into a consumer's
 * AGENTS.md, and it must be absent from the template that the harness reads.
 */
describe('runInit — the primer step', () => {
  it('adds the primer step by default, inside the loop', async () => {
    await runInit([], {});
    const agents = await read('AGENTS.md');
    expect(agents).toContain('bunx urbicon primer');
    // Placed as step 0, i.e. before the first numbered step — not appended
    // somewhere after it, where an agent would read it too late to act on.
    expect(agents.indexOf('urbicon primer')).toBeLessThan(agents.indexOf('1. **Read the intent**'));
  });

  it('omits it with --with-primer=false, for a harness that injects the primer itself', async () => {
    await runInit([], { 'with-primer': 'false' });
    const agents = await read('AGENTS.md');
    expect(agents).not.toContain('urbicon primer');
    // The rest of the block is unaffected — this is a subtraction, not a variant.
    expect(agents).toContain('1. **Read the intent**');
    expect(agents).toContain('urbicon:start');
  });

  it('keeps the step out of the shipped template', async () => {
    // The harness reads templates/AGENTS.md directly and must not find an
    // instruction it cannot act on. Guarding it here rather than in the harness
    // keeps the knowledge on the side that owns the template.
    const template = await readFile(
      new URL('../../../templates/AGENTS.md', import.meta.url),
      'utf-8'
    );
    expect(template).not.toContain('urbicon primer');
    expect(template).toContain('1. **Read the intent**');
  });

  it('stays idempotent with the step in place', async () => {
    await runInit([], {});
    const first = await read('AGENTS.md');
    await runInit([], {});
    expect(await read('AGENTS.md')).toBe(first);
  });

  it('switches an existing block from with-primer to without on re-run', async () => {
    await runInit([], {});
    expect(await read('AGENTS.md')).toContain('urbicon primer');
    await runInit([], { 'with-primer': 'false' });
    expect(await read('AGENTS.md')).not.toContain('urbicon primer');
  });
});

/**
 * The version stamp + block-location rules exist so that upgrades reach existing
 * projects: `context` compares the stamp against the installed CLI, and a plain
 * re-run must find the block wherever a previous run (or an `--agents-file`
 * choice) put it — on any filesystem, in any casing — instead of writing a
 * second copy that drifts.
 */
describe('runInit — version stamp & block location', () => {
  it('stamps the installed CLI version into the start marker', async () => {
    await runInit([], {});
    expect(await read('AGENTS.md')).toMatch(/<!-- urbicon:start v\d+\.\d+\.\d+(?:-[\w.]+)? /);
  });

  it('refreshes a block living in CLAUDE.md instead of writing a second copy into AGENTS.md', async () => {
    await runInit([], { 'agents-file': 'CLAUDE.md' });
    await runInit([], {}); // plain re-run — must follow the block
    expect(await readdir(dir)).not.toContain('AGENTS.md');
    expect((await read('CLAUDE.md')).match(/urbicon:start/g)).toHaveLength(1);
  });

  it('updates a differently-cased agents file in place instead of shadowing it', async () => {
    await writeFile(join(dir, 'Agents.md'), '# Mine\n');
    await runInit([], {});
    const agentsCased = (await readdir(dir)).filter((e) => /^agents\.md$/i.test(e));
    expect(agentsCased).toEqual(['Agents.md']); // updated in place, no second file
    expect(await read('Agents.md')).toContain('urbicon:start');
    expect(await read('Agents.md')).toContain('# Mine');
  });

  it('fails loud on more than one block instead of refreshing only the first', async () => {
    await runInit([], {});
    const one = await read('AGENTS.md');
    await writeFile(join(dir, 'AGENTS.md'), `${one}\n${one}`);
    const before = await read('AGENTS.md');
    expect(await runInit([], {})).toBe(1);
    expect(await read('AGENTS.md')).toBe(before); // untouched
  });

  it('reports a stray second block in another context file instead of leaving it to drift', async () => {
    await runInit([], {}); // block in AGENTS.md
    await writeFile(join(dir, 'CLAUDE.md'), await read('AGENTS.md')); // stray copy
    await runInit([], {});
    expect(logged()).toContain('also carries an urbicon block');
  });

  it('hints when a separate CLAUDE.md never mentions the agents file', async () => {
    await writeFile(join(dir, 'CLAUDE.md'), '# Project rules\n');
    await runInit([], {});
    expect(logged()).toContain('never mentions AGENTS.md');
  });

  it('stays quiet when CLAUDE.md already points at the agents file', async () => {
    await writeFile(join(dir, 'CLAUDE.md'), '# Rules\n\nSee AGENTS.md for the design loop.\n');
    await runInit([], {});
    expect(logged()).not.toContain('never mentions');
  });

  it('hints in the reverse direction too — AGENTS.md beside a CLAUDE.md carrier', async () => {
    await runInit([], { 'agents-file': 'CLAUDE.md' });
    await writeFile(join(dir, 'AGENTS.md'), '# Mine\n');
    await runInit([], {}); // plain re-run follows the block into CLAUDE.md
    expect(logged()).toContain('AGENTS.md never mentions CLAUDE.md');
  });

  it('keeps the duplicate report alive under an explicit --agents-file', async () => {
    await runInit([], { 'agents-file': 'CLAUDE.md' });
    await runInit([], { 'agents-file': 'AGENTS.md' });
    expect(logged()).toContain('also carries an urbicon block');
  });

  it('does not mistake a CLAUDE.md → AGENTS.md symlink for a second copy', async () => {
    await runInit([], {});
    await symlink('AGENTS.md', join(dir, 'CLAUDE.md'));
    await runInit([], {});
    expect(logged()).not.toContain('also carries');
    expect((await read('AGENTS.md')).match(/urbicon:start/g)).toHaveLength(1);
  });

  it('fails loud when the target is a directory', async () => {
    await mkdir(join(dir, 'AGENTS.md'));
    expect(await runInit([], {})).toBe(1);
    expect((await readdir(join(dir, 'AGENTS.md'))).length).toBe(0); // untouched
  });

  it.skipIf(process.getuid?.() === 0)(
    'fails loud on an unreadable existing target instead of clobbering it',
    async () => {
      await writeFile(join(dir, 'AGENTS.md'), '# Mine\n');
      await chmod(join(dir, 'AGENTS.md'), 0o200); // writable, not readable
      expect(await runInit([], {})).toBe(1);
      await chmod(join(dir, 'AGENTS.md'), 0o644);
      expect(await read('AGENTS.md')).toBe('# Mine\n'); // content survived
    }
  );
});

/**
 * A hook entry or workflow that no longer matches the template is either a
 * deliberate customisation or an outdated copy — indistinguishable, so init
 * keeps it. What it must NOT do is silently claim "already present": the report
 * is the only signal an outdated copy ever gets.
 */
describe('runInit — hook & ci divergence', () => {
  it('keeps a customised hook entry and reports it instead of claiming presence', async () => {
    await runInit([], { hook: true });
    const path = join(dir, '.claude/settings.json');
    const settings = JSON.parse(await readFile(path, 'utf-8'));
    settings.hooks.PostToolUse[0].matcher = 'Edit'; // user narrowed the matcher
    await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`);
    await runInit([], { hook: true });
    const after = JSON.parse(await read('.claude/settings.json'));
    expect(after.hooks.PostToolUse).toHaveLength(1); // not duplicated
    expect(after.hooks.PostToolUse[0].matcher).toBe('Edit'); // kept
    expect(logged()).toContain('customised');
  });

  it('recognises the canonical entry regardless of key order', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    const reordered = {
      hooks: {
        PostToolUse: [
          { hooks: [{ command: 'urbicon hook', type: 'command' }], matcher: 'Edit|MultiEdit|Write' }
        ]
      }
    };
    await writeFile(join(dir, '.claude/settings.json'), JSON.stringify(reordered, null, 2));
    await runInit([], { hook: true });
    expect(logged()).toContain('already has');
    expect(logged()).not.toContain('customised');
  });

  it('keeps a diverged design-gate.yml and reports how to adopt the update', async () => {
    await mkdir(join(dir, '.github/workflows'), { recursive: true });
    await writeFile(join(dir, '.github/workflows/design-gate.yml'), 'name: custom\n');
    await runInit([], { ci: true });
    expect(await read('.github/workflows/design-gate.yml')).toBe('name: custom\n'); // kept
    expect(logged()).toContain('differs from the current template');
  });

  it('reports an unchanged design-gate.yml as current', async () => {
    await runInit([], { ci: true });
    log.mockClear();
    await runInit([], { ci: true });
    expect(logged()).toContain('matches the current template');
  });

  it('treats whitespace-only churn on design-gate.yml as still matching', async () => {
    await runInit([], { ci: true });
    const path = join(dir, '.github/workflows/design-gate.yml');
    await writeFile(path, `${await readFile(path, 'utf-8')}\n\n`); // formatter added newlines
    log.mockClear();
    await runInit([], { ci: true });
    expect(logged()).toContain('matches the current template');
  });

  it('does not mistake an unrelated command mentioning "urbicon hook" for the gate', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    const decoy = {
      hooks: {
        PostToolUse: [
          { matcher: 'Write', hooks: [{ type: 'command', command: 'echo "urbicon hook todo"' }] }
        ]
      }
    };
    await writeFile(join(dir, '.claude/settings.json'), JSON.stringify(decoy, null, 2));
    await runInit([], { hook: true });
    const settings = JSON.parse(await read('.claude/settings.json'));
    expect(settings.hooks.PostToolUse).toHaveLength(2); // gate installed alongside
    expect(logged()).toContain('wired the PostToolUse');
  });

  it('reports the gate as present even when a decoy entry precedes it', async () => {
    await runInit([], { hook: true });
    const path = join(dir, '.claude/settings.json');
    const settings = JSON.parse(await readFile(path, 'utf-8'));
    settings.hooks.PostToolUse.unshift({
      matcher: 'Write',
      hooks: [{ type: 'command', command: 'echo "urbicon hook todo"' }]
    });
    await writeFile(path, JSON.stringify(settings, null, 2));
    await runInit([], { hook: true });
    const after = JSON.parse(await read('.claude/settings.json'));
    expect(after.hooks.PostToolUse).toHaveLength(2); // nothing added, nothing removed
    expect(logged()).toContain('already has');
    expect(logged()).not.toContain('customised');
  });
});
