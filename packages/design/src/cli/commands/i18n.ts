/**
 * `urbicon i18n <check> [dirs...]` — the filesystem front end over
 * `@urbicon-ui/i18n/audit`. Three checks (and `audit` = all):
 *
 *   parity     data-level translation audit (missing/empty/param/plural/…)
 *   unused     source-scan for defined keys no code references (+ used-but-undefined)
 *   hardcoded  literal UI copy in .svelte markup that bypassed i18n (advisory)
 *
 * Pure analysis lives in the i18n package; this command does the I/O it
 * structurally can't: glob sources, load locale bundles, then call
 * `auditTranslations` / `scanSources` + `findUnusedKeys` / `findHardcodedStrings`.
 *
 * Gate (exit 1): translation-parity ERRORS + used-but-undefined keys — the
 * correctness failures. Unused keys, hardcoded strings and parity warnings are
 * advisory (reported, gate only under `--strict`), mirroring `validate`'s
 * correctness-gates / slop-is-advisory split.
 *
 * The bundle loader uses dynamic `import()`, so run it under Bun (or point at
 * compiled `.js` bundles) — Node cannot import a consumer's `.ts` translations.
 */

import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { boolFlag, type Flags, stringFlag } from '../args.js';
import { EXIT, printError } from '../output.js';

type AuditModule = typeof import('@urbicon-ui/i18n/audit');
type Locale = import('@urbicon-ui/i18n/audit').Locale;

const CHECKS = ['parity', 'unused', 'hardcoded', 'audit'] as const;
type Check = (typeof CHECKS)[number];
const isCheck = (value: string): value is Check => (CHECKS as readonly string[]).includes(value);

const SKIP_DIRS = new Set([
  'node_modules',
  '.svelte-kit',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage'
]);
const MAX_DEPTH = 24;

interface I18nAuditConfig {
  sources: string[];
  translations: string[];
  functionNames?: string[];
  dynamicKeys?: string[];
  ignoreKeys?: string[];
  ignoreStrings?: string[];
  baseLocale?: string;
  runtimeUsage?: string;
}

const DEFAULT_CONFIG: I18nAuditConfig = {
  sources: ['src'],
  translations: ['src/lib/translations']
};

function label(abs: string): string {
  return relative(process.cwd(), abs).split(sep).join('/') || abs;
}

/** Split a `--flag a,b,c` value into a trimmed list, or undefined when absent. */
function listFlag(flags: Flags, key: string): string[] | undefined {
  const raw = stringFlag(flags, key);
  if (raw === undefined) return undefined;
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

/** Resolve config: explicit `--config`, else `i18n.audit.json`, else defaults; flags win. */
async function loadConfig(flags: Flags, sourceDirs: string[]): Promise<I18nAuditConfig> {
  let fileConfig: Partial<I18nAuditConfig> = {};
  const explicit = stringFlag(flags, 'config');
  const candidate = explicit ?? 'i18n.audit.json';
  try {
    fileConfig = JSON.parse(
      await readFile(resolve(candidate), 'utf-8')
    ) as Partial<I18nAuditConfig>;
  } catch (error) {
    // A missing default config is fine; an explicitly-requested one that fails is not.
    if (explicit) throw new Error(`cannot read config "${explicit}": ${(error as Error).message}`);
  }

  const merged: I18nAuditConfig = { ...DEFAULT_CONFIG, ...fileConfig };
  if (sourceDirs.length) merged.sources = sourceDirs;
  merged.functionNames = listFlag(flags, 'function-names') ?? merged.functionNames;
  merged.dynamicKeys = listFlag(flags, 'dynamic-keys') ?? merged.dynamicKeys;
  merged.ignoreKeys = listFlag(flags, 'ignore-keys') ?? merged.ignoreKeys;
  merged.ignoreStrings = listFlag(flags, 'ignore-strings') ?? merged.ignoreStrings;
  merged.baseLocale = stringFlag(flags, 'base-locale') ?? merged.baseLocale;
  merged.translations = listFlag(flags, 'translations') ?? merged.translations;
  merged.runtimeUsage = stringFlag(flags, 'runtime-usage') ?? merged.runtimeUsage;
  return merged;
}

/** Recursively collect files with one of `extensions` under `dir`, skipping junk. */
async function collectFiles(dir: string, extensions: string[], depth = 0): Promise<string[]> {
  if (depth > MAX_DEPTH) return [];
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      files.push(...(await collectFiles(full, extensions, depth + 1)));
    } else if (
      entry.isFile() &&
      extensions.some((ext) => entry.name.endsWith(ext)) &&
      !/\.(test|spec)\.|\.d\.ts$/.test(entry.name)
    ) {
      files.push(full);
    }
  }
  return files;
}

interface BundleGroup {
  name: string;
  bundles: Record<string, Record<string, unknown>>;
}

const BUNDLE_EXT = /\.(ts|js|mjs)$/;

/**
 * Load each translations dir's locale modules into `{ locale: bundle }` via
 * dynamic import. Admits .ts/.js/.mjs (the .js path is the documented Node escape
 * hatch); only files whose stem is a supported locale are loaded, so an `index.ts`
 * barrel or a helper is ignored rather than imported as a phantom locale. A dir
 * that yields no locale bundle is an error, not a silent pass.
 */
async function loadBundleGroups(
  dirs: string[],
  isSupportedLocale: (locale: string) => boolean
): Promise<{ groups: BundleGroup[]; errors: string[] }> {
  const groups: BundleGroup[] = [];
  const errors: string[] = [];
  for (const dir of dirs) {
    const abs = resolve(dir);
    let candidates: string[];
    try {
      const info = await stat(abs);
      candidates = info.isDirectory()
        ? (await readdir(abs))
            .filter((f) => BUNDLE_EXT.test(f) && !f.endsWith('.d.ts'))
            .map((f) => join(abs, f))
        : [abs];
    } catch {
      errors.push(`translations path not found: ${label(abs)}`);
      continue;
    }
    const bundles: Record<string, Record<string, unknown>> = {};
    let localeFiles = 0;
    for (const file of candidates) {
      const locale = basename(file).replace(BUNDLE_EXT, '');
      if (!isSupportedLocale(locale)) continue; // barrels / helpers are not locales
      localeFiles++;
      if (bundles[locale]) {
        errors.push(`duplicate locale "${locale}" in ${label(abs)} — ${label(file)} ignored`);
        continue;
      }
      try {
        const mod = (await import(pathToFileURL(file).href)) as { default?: unknown };
        if (mod.default && typeof mod.default === 'object') {
          bundles[locale] = mod.default as Record<string, unknown>;
        } else {
          errors.push(`bundle ${label(file)} has no object default export`);
        }
      } catch (error) {
        errors.push(`cannot load bundle ${label(file)}: ${(error as Error).message}`);
      }
    }
    if (Object.keys(bundles).length) groups.push({ name: label(abs), bundles });
    else if (localeFiles === 0) errors.push(`no locale bundles (en/de/…) in: ${label(abs)}`);
  }
  return { groups, errors };
}

interface Outcome {
  /** Lines for the human report. */
  lines: string[];
  /** Gate-failing items (correctness). */
  errors: number;
  /** Advisory items (cleanup / heuristics). */
  warnings: number;
  /** Structured payload for `--json`. */
  json: Record<string, unknown>;
}

function runParity(audit: AuditModule, config: I18nAuditConfig, groups: BundleGroup[]): Outcome {
  const lines: string[] = [];
  let errors = 0;
  let warnings = 0;
  const allFindings: unknown[] = [];
  for (const group of groups) {
    const report = audit.auditTranslations(group.name, group.bundles, {
      baseLocale: config.baseLocale as Locale | undefined,
      ignoreKeys: config.ignoreKeys
    });
    errors += report.errors.length;
    warnings += report.warnings.length;
    allFindings.push(...report.findings);
    for (const finding of report.findings) {
      const icon = finding.severity === 'error' ? '✗' : '!';
      lines.push(`  ${icon} [${finding.code}] ${finding.locale} — ${finding.detail}`);
    }
  }
  return { lines, errors, warnings, json: { findings: allFindings } };
}

async function runUnused(
  audit: AuditModule,
  config: I18nAuditConfig,
  groups: BundleGroup[],
  sources: { file: string; code: string }[]
): Promise<Outcome> {
  const defined = new Set<string>();
  for (const group of groups) {
    const base = group.bundles.en ?? Object.values(group.bundles)[0];
    if (base) for (const key of audit.collectDeepKeys(base)) defined.add(key);
  }
  let runtimeUsedKeys: string[] | undefined;
  if (config.runtimeUsage) {
    try {
      const parsed = JSON.parse(await readFile(resolve(config.runtimeUsage), 'utf-8'));
      if (Array.isArray(parsed))
        runtimeUsedKeys = parsed.filter((k): k is string => typeof k === 'string');
    } catch (error) {
      printError(`ignoring unreadable runtime-usage file: ${(error as Error).message}`);
    }
  }

  const { scan, errors: scanErrors } = await audit.scanSources(sources, {
    functionNames: config.functionNames
  });
  const report = audit.findUnusedKeys(defined, scan, {
    dynamicKeys: config.dynamicKeys,
    ignoreKeys: config.ignoreKeys,
    runtimeUsedKeys
  });

  const lines: string[] = [];
  for (const error of scanErrors) lines.push(`  ! could not parse ${error.file}: ${error.message}`);
  for (const finding of report.usedButUndefined) {
    lines.push(
      `  ✗ used but undefined: ${finding.key} (${finding.sites[0]?.file}:${finding.sites[0]?.line})`
    );
  }
  for (const finding of report.unused) {
    lines.push(`  ! unused (${finding.tier}): ${finding.key}`);
  }
  // Errors gate; unused keys are advisory cleanup.
  return {
    lines,
    errors: report.usedButUndefined.length,
    warnings: report.unused.length,
    json: {
      unused: report.unused,
      usedButUndefined: report.usedButUndefined,
      dynamicPrefixCoverage: report.dynamicPrefixCoverage,
      opaqueSiteCount: report.opaqueSiteCount,
      scanErrors
    }
  };
}

async function runHardcoded(
  audit: AuditModule,
  config: I18nAuditConfig,
  sources: { file: string; code: string }[]
): Promise<Outcome> {
  const lines: string[] = [];
  const all: unknown[] = [];
  let warnings = 0;
  for (const source of sources) {
    if (!source.file.endsWith('.svelte')) continue;
    try {
      const findings = await audit.findHardcodedStrings(source.code, source.file, {
        ignoreStrings: config.ignoreStrings
      });
      warnings += findings.length;
      all.push(...findings);
      for (const f of findings) {
        const where = f.kind === 'attribute' ? `@${f.attribute}` : 'text';
        lines.push(`  ! hardcoded ${where}: "${f.text}" (${f.file}:${f.line})`);
      }
    } catch (error) {
      lines.push(`  ! could not parse ${source.file}: ${(error as Error).message}`);
    }
  }
  return { lines, errors: 0, warnings, json: { findings: all } };
}

export async function runI18n(positionals: string[], flags: Flags): Promise<number> {
  const first = positionals[0];
  const check: Check = first && isCheck(first) ? first : 'audit';
  const dirArgs = (first && isCheck(first) ? positionals.slice(1) : positionals).filter(Boolean);
  const asJson = boolFlag(flags, 'json');
  const strict = boolFlag(flags, 'strict');

  let audit: AuditModule;
  try {
    audit = (await import('@urbicon-ui/i18n/audit')) as AuditModule;
  } catch (error) {
    printError(
      `cannot load @urbicon-ui/i18n/audit — is @urbicon-ui/i18n installed? (${(error as Error).message})`
    );
    return EXIT.FAIL;
  }

  let config: I18nAuditConfig;
  try {
    config = await loadConfig(flags, dirArgs);
  } catch (error) {
    printError((error as Error).message);
    return EXIT.USAGE;
  }

  const wantsParity = check === 'parity' || check === 'audit';
  const wantsUnused = check === 'unused' || check === 'audit';
  const wantsHardcoded = check === 'hardcoded' || check === 'audit';

  // Sources are needed for unused + hardcoded; load once.
  let sources: { file: string; code: string }[] = [];
  if (wantsUnused || wantsHardcoded) {
    const files = (
      await Promise.all(
        config.sources.map((dir) => collectFiles(resolve(dir), ['.ts', '.js', '.svelte']))
      )
    ).flat();
    sources = await Promise.all(
      files.map(async (file) => ({ file: label(file), code: await readFile(file, 'utf-8') }))
    );
  }

  // Bundles are needed for parity + unused.
  let groups: BundleGroup[] = [];
  let bundleErrors: string[] = [];
  if (wantsParity || wantsUnused) {
    const loaded = await loadBundleGroups(config.translations, audit.isLocaleSupported);
    groups = loaded.groups;
    bundleErrors = loaded.errors;
  }

  const sections: Record<string, Outcome> = {};
  if (wantsParity) sections.parity = runParity(audit, config, groups);
  if (wantsUnused) sections.unused = await runUnused(audit, config, groups, sources);
  if (wantsHardcoded) sections.hardcoded = await runHardcoded(audit, config, sources);

  const totalErrors = Object.values(sections).reduce((sum, s) => sum + s.errors, 0);
  const totalWarnings = Object.values(sections).reduce((sum, s) => sum + s.warnings, 0);
  // A translations path that was requested but loaded nothing is a hard failure,
  // never a silent "all clean" — it would otherwise make every defined key look
  // unused / hide parity drift. Only relevant when bundles were actually needed.
  const bundleFailed = (wantsParity || wantsUnused) && bundleErrors.length > 0;
  const failed = totalErrors > 0 || bundleFailed || (strict && totalWarnings > 0);

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: !failed,
          check,
          strict,
          bundleErrors,
          ...Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.json]))
        },
        null,
        2
      )
    );
    return failed ? EXIT.FAIL : EXIT.OK;
  }

  for (const error of bundleErrors) printError(error);
  for (const [name, section] of Object.entries(sections)) {
    console.log(`\n${name}:`);
    if (section.lines.length === 0) console.log('  ✓ no findings');
    else for (const line of section.lines) console.log(line);
  }
  const bundleNote = bundleErrors.length ? `, ${bundleErrors.length} bundle error(s)` : '';
  console.log(
    `\n${totalErrors} error(s), ${totalWarnings} advisory finding(s)${bundleNote}${strict ? ' (--strict: advisory gates)' : ''}.`
  );
  if (failed) console.log('FAIL.');
  return failed ? EXIT.FAIL : EXIT.OK;
}
