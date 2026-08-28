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

  // The bare command exits 127 in a hook shell (no node_modules/.bin on PATH), so the
  // gate silently blocks nothing. Nothing about that is visible to the agent — the run
  // looks like "produced no violations". The runner prefix is what makes it resolve.
  it('--hook writes a command that resolves from a hook shell, not the bare binary', async () => {
    await runInit([], { hook: true });
    const settings = JSON.parse(await read('.claude/settings.json'));
    const command = settings.hooks.PostToolUse[0].hooks[0].command;
    expect(command).toBe('bunx urbicon hook');
    expect(command).not.toBe('urbicon hook');
  });

  it('repairs the dead bare hook an older init wrote', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(
      join(dir, '.claude/settings.json'),
      JSON.stringify(
        {
          model: 'opus',
          hooks: {
            PostToolUse: [
              {
                matcher: 'Edit|MultiEdit|Write',
                hooks: [{ type: 'command', command: 'urbicon hook' }]
              }
            ]
          }
        },
        null,
        2
      )
    );
    await runInit([], { hook: true });
    const settings = JSON.parse(await read('.claude/settings.json'));
    expect(settings.hooks.PostToolUse).toHaveLength(1); // repaired in place, not appended
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe('bunx urbicon hook');
    expect(settings.model).toBe('opus'); // unrelated keys untouched
    expect(logged()).toContain('repaired');
    expect(logged()).not.toContain('customised'); // our own defect is not a customisation
  });

  it('repairing is idempotent — a second run reports it as present', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(
      join(dir, '.claude/settings.json'),
      JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              {
                matcher: 'Edit|MultiEdit|Write',
                hooks: [{ type: 'command', command: 'urbicon hook' }]
              }
            ]
          }
        },
        null,
        2
      )
    );
    await runInit([], { hook: true });
    log.mockClear();
    await runInit([], { hook: true });
    expect(logged()).toContain('already has');
    expect(logged()).not.toContain('repaired');
  });

  // The repair is scoped to the exact shape init itself wrote. A user who deliberately
  // customised the command still gets the keep-and-report treatment.
  it('does not repair a customised gate command', async () => {
    await mkdir(join(dir, '.claude'), { recursive: true });
    await writeFile(
      join(dir, '.claude/settings.json'),
      JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              { matcher: 'Write', hooks: [{ type: 'command', command: 'urbicon hook --strict' }] }
            ]
          }
        },
        null,
        2
      )
    );
    await runInit([], { hook: true });
    const settings = JSON.parse(await read('.claude/settings.json'));
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toBe('urbicon hook --strict'); // kept
    expect(logged()).toContain('customised');
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

  // Naming a stylesheet the project does not have is worse than naming none: the
  // consumer creates it, nothing imports it, every token silently resolves to nothing.
  describe('Tailwind next-step', () => {
    const withTailwind = async (): Promise<void> => {
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({ name: 'x', devDependencies: { tailwindcss: '^4' } })
      );
    };

    it('points at the stylesheet the project actually has, not at app.css', async () => {
      await withTailwind();
      await mkdir(join(dir, 'src/routes'), { recursive: true });
      await writeFile(join(dir, 'src/routes/layout.css'), "@import 'tailwindcss';\n");
      await runInit([], {});
      expect(logged()).toContain('src/routes/layout.css');
      expect(logged()).not.toContain('your `app.css`');
    });

    it('finds a double-quoted import too', async () => {
      await withTailwind();
      await mkdir(join(dir, 'src'), { recursive: true });
      await writeFile(join(dir, 'src/app.css'), '@import "tailwindcss";\n');
      await runInit([], {});
      expect(logged()).toContain('src/app.css');
    });

    it('describes the file instead of naming one when none matches', async () => {
      await withTailwind();
      await mkdir(join(dir, 'src'), { recursive: true });
      await writeFile(join(dir, 'src/other.css'), '.a { color: red }\n');
      await runInit([], {});
      expect(logged()).toContain("the file with `@import 'tailwindcss'`");
    });

    it('ignores node_modules when searching', async () => {
      await withTailwind();
      await mkdir(join(dir, 'src/node_modules/pkg'), { recursive: true });
      await writeFile(join(dir, 'src/node_modules/pkg/x.css'), "@import 'tailwindcss';\n");
      await runInit([], {});
      expect(logged()).not.toContain('src/node_modules');
    });
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

  it('wires a fresh project so Claude Code actually loads the block', async () => {
    await runInit([], {});
    expect(await read('CLAUDE.md')).toContain('@AGENTS.md');
  });

  it('adds the import to an existing CLAUDE.md and keeps what was there', async () => {
    await writeFile(join(dir, 'CLAUDE.md'), '# Project rules\n');
    await runInit([], {});
    const claude = await read('CLAUDE.md');
    expect(claude).toContain('@AGENTS.md');
    expect(claude).toContain('# Project rules');
  });

  it('imports even when CLAUDE.md only mentions the agents file in prose', async () => {
    // A prose pointer was measured NOT to deliver: the model has no reason to
    // follow it before it starts working. Only the import inlines the block.
    await writeFile(join(dir, 'CLAUDE.md'), '# Rules\n\nSee AGENTS.md for the design loop.\n');
    await runInit([], {});
    expect(await read('CLAUDE.md')).toContain('@AGENTS.md');
  });

  it('does not stack a second import on re-run', async () => {
    await runInit([], {});
    await runInit([], {});
    expect((await read('CLAUDE.md')).match(/@AGENTS\.md/g)).toHaveLength(1);
  });

  it('leaves CLAUDE.md alone under --claude-md=false', async () => {
    // For a harness that owns its system prompt and delivers the block itself.
    await runInit([], { 'claude-md': 'false' });
    expect(await readdir(dir)).not.toContain('CLAUDE.md');
  });

  it('does not import into a CLAUDE.md that carries the block itself', async () => {
    await runInit([], { 'agents-file': 'CLAUDE.md' });
    const claude = await read('CLAUDE.md');
    expect(claude).not.toContain('@CLAUDE.md');
    expect(claude.match(/urbicon:start/g)).toHaveLength(1);
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
    // The symlink is the older way to deliver the block and still works, so a
    // project that chose it must not be rewritten into the import form.
    await rm(join(dir, 'CLAUDE.md'));
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
          {
            hooks: [{ command: 'bunx urbicon hook', type: 'command' }],
            matcher: 'Edit|MultiEdit|Write'
          }
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

/**
 * The import list is read from `node_modules/@urbicon-ui/*` and the packages' own
 * `exports`, never from the consumer's declarations or a list in the CLI: `bun add
 * @urbicon-ui/table` declares only table while its peers (blocks, i18n, …) land in
 * `node_modules` undeclared, and a consumer who imports blocks alone gets the classes
 * only table uses compiled to nothing, with nothing reporting it. Both branches
 * (Tailwind wired or not) print the same list.
 */
describe('runInit — stylesheet imports read from node_modules', () => {
  const declare = async (
    deps: Record<string, string>,
    extra: Record<string, string> = { tailwindcss: '^4' }
  ): Promise<void> => {
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: deps, devDependencies: extra })
    );
  };
  const install = async (
    name: string,
    exports: Record<string, string> | undefined,
    root: string = dir
  ): Promise<void> => {
    const pkgDir = join(root, 'node_modules', '@urbicon-ui', name);
    await mkdir(pkgDir, { recursive: true });
    await writeFile(
      join(pkgDir, 'package.json'),
      JSON.stringify({ name: `@urbicon-ui/${name}`, exports })
    );
  };
  const STYLE = { '.': './dist/index.js', './style/index.css': './dist/style/index.css' };
  const NO_STYLE = { '.': './dist/index.js' };
  const line = (name: string): string => `@import '@urbicon-ui/${name}/style/index.css';`;

  it('lists only blocks when only blocks is installed', async () => {
    await declare({ '@urbicon-ui/blocks': '^8' });
    await install('blocks', STYLE);
    await runInit([], {});
    expect(logged()).toContain(line('blocks'));
    expect(logged().match(/@import '@urbicon-ui\//g)).toHaveLength(1);
  });

  it('lists every installed package that exports a stylesheet, blocks first, then alphabetical', async () => {
    await declare({
      '@urbicon-ui/table': '^8',
      '@urbicon-ui/blocks': '^8',
      '@urbicon-ui/auth': '^8'
    });
    await install('table', STYLE);
    await install('blocks', STYLE);
    await install('auth', STYLE);
    await runInit([], {});
    const out = logged();
    const at = (s: string): number => out.indexOf(s);
    expect(at(line('blocks'))).toBeGreaterThan(-1);
    expect(at(line('auth'))).toBeGreaterThan(-1);
    expect(at(line('table'))).toBeGreaterThan(-1);
    expect(at("@import 'tailwindcss';")).toBeLessThan(at(line('blocks')));
    expect(at(line('blocks'))).toBeLessThan(at(line('auth')));
    expect(at(line('auth'))).toBeLessThan(at(line('table')));
    expect(out.match(/@import '@urbicon-ui\//g)).toHaveLength(3);
    expect(out).toContain("/* table's own stylesheet */");
    expect(out).not.toContain('could not be read');
    expect(out).not.toContain('is installed yet');
  });

  it('skips an installed package that exports no stylesheet', async () => {
    await declare({ '@urbicon-ui/blocks': '^8', '@urbicon-ui/i18n': '^8' });
    await install('blocks', STYLE);
    await install('i18n', NO_STYLE);
    await runInit([], {});
    expect(logged()).toContain(line('blocks'));
    expect(logged()).not.toContain('@urbicon-ui/i18n/style');
    expect(logged()).not.toContain('could not be read');
  });

  // `bun add @urbicon-ui/table` writes only table into package.json; blocks arrives as
  // a peer, installed but undeclared. The declarations are not the oracle.
  it('lists an installed peer that package.json never declares', async () => {
    await declare({ '@urbicon-ui/table': '^8' });
    await install('blocks', STYLE);
    await install('table', STYLE);
    await runInit([], {});
    const out = logged();
    expect(out).toContain(line('blocks'));
    expect(out).toContain(line('table'));
    expect(out.indexOf(line('blocks'))).toBeLessThan(out.indexOf(line('table')));
    expect(out).not.toContain('is installed yet');
  });

  it('prints the same list on the not-yet-wired branch', async () => {
    await declare({ '@urbicon-ui/blocks': '^8', '@urbicon-ui/table': '^8' }, {}); // no tailwind
    await install('blocks', STYLE);
    await install('table', STYLE);
    await runInit([], {});
    expect(logged()).toContain('Wire up Tailwind 4');
    expect(logged()).toContain(line('blocks'));
    expect(logged()).toContain(line('table'));
  });

  it('reads a hoisted install from a monorepo root that declares no urbicon package', async () => {
    await declare({}); // the root package.json — workspaces only, no @urbicon-ui/* of its own
    await install('blocks', STYLE);
    await install('table', STYLE);
    await runInit([], {});
    expect(logged()).toContain(line('blocks'));
    expect(logged()).toContain(line('table'));
    expect(logged()).not.toContain('is installed yet');
    expect(logged()).not.toContain('could not be read');
  });

  it('resolves a hoisted install from a nested workspace package', async () => {
    const app = join(dir, 'apps', 'web');
    await mkdir(app, { recursive: true });
    await writeFile(
      join(app, 'package.json'),
      JSON.stringify({ name: 'web', dependencies: { '@urbicon-ui/table': '^8' } })
    );
    await install('table', STYLE); // node_modules at the workspace root, not in apps/web
    process.chdir(app);
    await runInit([], {});
    expect(logged()).toContain(line('table'));
    expect(logged()).not.toContain('is installed yet');
  });

  it('names an installed package whose package.json does not parse, and does not skip it', async () => {
    await declare({ '@urbicon-ui/blocks': '^8', '@urbicon-ui/table': '^8' });
    await install('blocks', STYLE);
    const tableDir = join(dir, 'node_modules', '@urbicon-ui', 'table');
    await mkdir(tableDir, { recursive: true });
    await writeFile(join(tableDir, 'package.json'), '{ not json');
    await runInit([], {});
    expect(logged()).toContain(line('blocks'));
    expect(logged()).not.toContain('@urbicon-ui/table/style');
    expect(logged()).toContain(
      '`@urbicon-ui/table` — installed, but its package.json could not be read'
    );
  });

  it('tells an absent package from a broken one — absent gets no line and no name', async () => {
    await declare({ '@urbicon-ui/blocks': '^8', '@urbicon-ui/table': '^8' }); // table not installed
    await install('blocks', STYLE);
    await runInit([], {});
    expect(logged()).toContain(line('blocks'));
    expect(logged()).not.toContain('@urbicon-ui/table');
    expect(logged()).not.toContain('could not be read');
  });

  it('says where the list comes from when nothing is installed — without naming a package', async () => {
    await declare({ '@urbicon-ui/blocks': '^8' }); // declared, `bun install` not run yet
    await runInit([], {});
    expect(logged()).not.toContain("@import '@urbicon-ui/");
    expect(logged()).toContain('No @urbicon-ui/* package is installed yet');
    expect(logged()).toContain('`bun install`');
    expect(logged()).not.toContain('bun add');
  });
});
