import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runI18n } from './i18n.js';

interface I18nJson {
  ok: boolean;
  parity?: { findings: { code: string; locale: string }[] };
  unused?: { unused: { key: string; tier: string }[]; usedButUndefined: { key: string }[] };
  hardcoded?: { findings: { text: string }[] };
}

describe('urbicon i18n', () => {
  let dir: string;
  let log: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'urbicon-i18n-'));
    await mkdir(join(dir, 'src', 'lib', 'translations'), { recursive: true });
    await writeFile(
      join(dir, 'src', 'lib', 'translations', 'en.ts'),
      `export default { greeting: 'Hello', items: '{{count}} items', unused: { deep: 'Never used' } } as const;\n`
    );
    await writeFile(
      join(dir, 'src', 'lib', 'translations', 'de.ts'),
      `export default { greeting: 'Hallo', items: '{{count}} Dinge' } as const;\n`
    );
    await writeFile(
      join(dir, 'src', 'App.svelte'),
      `<script lang="ts">\n  import { useI18n } from '@urbicon-ui/i18n';\n  const t = useI18n().t;\n</script>\n<button>{t('greeting')}</button>\n<span aria-label="Close the dialog">{t('items', { count: 3 })}</span>\n`
    );
    log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  const run = (check: string, flags: Record<string, string | boolean> = {}) =>
    runI18n([check, join(dir, 'src')], {
      translations: join(dir, 'src', 'lib', 'translations'),
      ...flags
    });

  function lastJson(): I18nJson {
    const out = log.mock.calls.map((call: unknown[]) => call[0]).join('\n');
    return JSON.parse(out) as I18nJson;
  }

  it('gates (exit 1) on a missing-key parity error and reports it', async () => {
    expect(await run('parity', { json: true })).toBe(1);
    const json = lastJson();
    expect(json.ok).toBe(false);
    expect(json.parity?.findings.some((f) => f.code === 'missing-key' && f.locale === 'de')).toBe(
      true
    );
  });

  it('reports an unused key as advisory (exit 0 without --strict)', async () => {
    expect(await run('unused', { json: true })).toBe(0);
    const json = lastJson();
    expect(json.unused?.unused.some((u) => u.key === 'unused.deep')).toBe(true);
  });

  it('flags hardcoded markup copy', async () => {
    await run('hardcoded', { json: true });
    const json = lastJson();
    expect(json.hardcoded?.findings.some((f) => f.text === 'Close the dialog')).toBe(true);
  });

  it('gates advisory findings under --strict', async () => {
    expect(await run('hardcoded')).toBe(0);
    log.mockClear();
    expect(await run('hardcoded', { strict: true })).toBe(1);
  });

  it('fails (never silently passes) when the translations path loads no bundles', async () => {
    expect(await run('parity', { translations: join(dir, 'nope') })).toBe(1);
  });

  it('loads .js bundles — the documented Node escape hatch', async () => {
    const jsDir = join(dir, 'dist-translations');
    await mkdir(jsDir, { recursive: true });
    await writeFile(join(jsDir, 'en.js'), `export default { greeting: 'Hello' };\n`);
    await writeFile(join(jsDir, 'de.js'), `export default { greeting: 'Hallo' };\n`);
    expect(await run('parity', { translations: jsDir, json: true })).toBe(0);
    expect(lastJson().ok).toBe(true);
  });

  it('skips __fixtures__ directories (test-support code, not shippable UI)', async () => {
    const fixturesDir = join(dir, 'src', 'lib', '__fixtures__');
    await mkdir(fixturesDir, { recursive: true });
    await writeFile(
      join(fixturesDir, 'Harness.svelte'),
      `<button>Throwaway fixture copy</button>\n`
    );

    await run('hardcoded', { json: true });
    const json = lastJson();
    // The fixture's literal copy is not scanned…
    expect(json.hardcoded?.findings.some((f) => f.text === 'Throwaway fixture copy')).toBe(false);
    // …while the regular App.svelte copy still is (the scanner ran, it just skipped the dir).
    expect(json.hardcoded?.findings.some((f) => f.text === 'Close the dialog')).toBe(true);
  });

  it('rejects a mistyped check instead of auditing a path that does not exist', async () => {
    // Measured: `urbicon i18n prity` took "prity" as a source dir, found no
    // sources, reported every defined key unused — and exited 0.
    expect(await runI18n(['prity'], {})).toBe(2);
  });

  it('rejects a source directory that is not there', async () => {
    expect(await runI18n(['unused', join(dir, 'nope')], {})).toBe(2);
  });

  it('rejects an unreadable --runtime-usage rather than over-reporting unused keys', async () => {
    expect(
      await runI18n(['unused', join(dir, 'src')], {
        translations: join(dir, 'src', 'lib', 'translations'),
        'runtime-usage': join(dir, 'nope.json')
      })
    ).toBe(2);

    await writeFile(join(dir, 'keys.json'), '{"not":"an array"}');
    expect(
      await runI18n(['unused', join(dir, 'src')], {
        translations: join(dir, 'src', 'lib', 'translations'),
        'runtime-usage': join(dir, 'keys.json')
      })
    ).toBe(2);
  });

  it('counts runtime-observed keys as used when the file is readable', async () => {
    await writeFile(join(dir, 'keys.json'), '["unused.deep"]');
    expect(await run('unused', { 'runtime-usage': join(dir, 'keys.json'), json: true })).toBe(0);
    expect(lastJson().unused?.unused.some((u) => u.key === 'unused.deep')).toBe(false);
  });

  it('ignores a non-locale file (index.ts barrel), not flagging an invalid locale', async () => {
    await writeFile(
      join(dir, 'src', 'lib', 'translations', 'index.ts'),
      `export { default as en } from './en';\n`
    );
    await run('parity', { json: true });
    const findings = lastJson().parity?.findings ?? [];
    expect(findings.some((f) => f.locale === 'index')).toBe(false);
    expect(findings.some((f) => f.code === 'invalid-locale')).toBe(false);
  });
});
