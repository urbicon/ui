import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const shim = resolve(here, 'bin', 'urbicon.js');
/** The real bin, by its workspace path — an oracle independent of the shim's resolution. */
const direct = resolve(here, '..', 'design', 'dist', 'cli.js');
const require = createRequire(import.meta.url);

const run = (bin: string, ...args: string[]) =>
  spawnSync(process.execPath, [bin, ...args], { cwd: here, encoding: 'utf8' });

/**
 * Needs `packages/design/dist/cli.js` — `bun run build:packages` first. Runs under
 * Node, never `vitest --bun`: `process.execPath` spawns the shim and `createRequire`
 * resolves with the host's resolver, and Bun's does not enforce `exports` on
 * `package.json` — the exports-map case below passes vacuously under Bun.
 */
describe('bin/urbicon.js', () => {
  // A deep import of design's package.json is what the shim rests on. Design has no
  // `exports` map; one that omits `./package.json` throws ERR_PACKAGE_PATH_NOT_EXPORTED
  // here, before the shim ever runs.
  it('resolves @urbicon-ui/design/package.json as a deep import', () => {
    expect(() => require.resolve('@urbicon-ui/design/package.json')).not.toThrow();
  });

  it('forwards to the installed design CLI — its version is what --version prints', () => {
    const { version } = require('@urbicon-ui/design/package.json') as { version: string };
    const result = run(shim, '--version');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(version);
  });

  it('passes the exit code through unchanged', () => {
    const viaShim = run(shim, 'nonsense-command');
    const viaBin = run(direct, 'nonsense-command');
    expect(viaBin.status).not.toBe(0); // an equal pair of zeros would prove nothing
    expect(viaShim.status).toBe(viaBin.status);
    expect(viaShim.stderr).toBe(viaBin.stderr);
  });

  // A pipe takes at least 64 KiB before Node has to queue the rest; a CLI that exits
  // before the queue drains ends mid-line. How much a reader drains before the exit
  // varies by reader and platform, so the report is several MB.
  // `validate` over stdin needs no content bundle, and its verdict is the last line
  // it prints — present only if nothing was cut.
  it('delivers piped output past the pipe buffer in full', () => {
    const markup = `<div>\n${'  <p class="bg-white">x</p>\n'.repeat(6000)}</div>\n`;
    for (const bin of [direct, shim]) {
      const result = spawnSync(process.execPath, [bin, 'validate'], {
        cwd: here,
        input: markup,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024
      });
      expect(result.stdout.trimEnd().endsWith('FAIL — fix the errors above.')).toBe(true);
      expect(Buffer.byteLength(result.stdout)).toBeGreaterThan(2 * 1024 * 1024);
      expect(result.status).toBe(1);
    }
  });
});
