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

/** Needs `packages/design/dist/cli.js` — `bun run build:packages` first. */
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
});
