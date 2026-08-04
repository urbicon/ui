import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * Shared, per-tsconfig `ts.Program` cache.
 *
 * Five extractor classes derive from TypeScriptBaseExtractor and each used to
 * build its own (always empty) program. With a real tsconfig wired in, a
 * per-extractor program would parse the whole package five times — so the
 * bundles live here, keyed by resolved configPath, and every extractor for
 * the same package shares one program + checker. The cache also survives the
 * per-target extractor recreation in ExtractorFactory (`--target all` runs
 * four packages in one process).
 *
 * Fail-loud contract (read tolerant / write strict): a *set* configPath that
 * is missing or unparsable throws — never a silent fall-back to the isolated
 * single-file mode, which would quietly drop cross-file types from the
 * generated artifacts. An *unset* configPath is the documented single-file
 * fallback (tests, ad-hoc extractor usage).
 */

export interface ProgramBundle {
  program: ts.Program;
  checker: ts.TypeChecker;
  compilerOptions: ts.CompilerOptions;
  /** Directory of the tsconfig — treated as the package root for source guards. */
  packageRoot: string;
  /**
   * Every name reachable from one of the package's public entry points —
   * what a consumer can actually `import type { … } from '@urbicon-ui/x'`.
   * `null` when the package declares no entry this program can see (test
   * fixtures, ad-hoc roots); consumers must then report "unknown" rather
   * than "not exported". See `resolvePublicExportNames`.
   */
  publicExportNames: ReadonlySet<string> | null;
  /**
   * Why the surface above is `null` even though the manifest *declared* typed
   * entries — a broken `dist/*.d.ts` → `src/lib/*` mapping, or an unreadable
   * manifest. `null` when nothing was declared (the documented unknown case).
   *
   * Carried rather than thrown so the bundle still lands in the cache; it is
   * `assertResolvablePublicExports` at phase start that turns it into a run
   * failure, where the error can actually escape.
   */
  publicExportFailure: string | null;
}

const bundles = new Map<string, ProgramBundle>();

/**
 * Parse the tsconfig at `configPath`, throwing a descriptive error when the
 * file is missing or has config-level diagnostics. Cheap (~5–15ms) — used
 * both for eager validation at pipeline start and for program construction.
 */
export function parseTsConfig(configPath: string): ts.ParsedCommandLine {
  const resolved = path.resolve(configPath);

  if (!ts.sys.fileExists(resolved)) {
    throw new Error(
      `docs-gen: tsconfig not found at ${resolved}. ` +
        `The extraction config sets typescript.configPath, so cross-file type resolution is expected — ` +
        `if this is a SvelteKit package, its .svelte-kit/tsconfig.json may be missing (run the package build or \`svelte-kit sync\`).`
    );
  }

  const configFile = ts.readConfigFile(resolved, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `docs-gen: failed to read tsconfig ${resolved}: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, ' ')}`
    );
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(resolved),
    undefined,
    resolved
  );
  if (parsed.errors.length > 0) {
    const details = parsed.errors
      .map((e) => ts.flattenDiagnosticMessageText(e.messageText, ' '))
      .join('; ');
    throw new Error(`docs-gen: tsconfig ${resolved} has errors: ${details}`);
  }

  return parsed;
}

/**
 * Eager validation hook for the pipeline: parses the tsconfig (throwing on
 * miss/errors) *before* extraction starts, so a broken configPath fails the
 * run at phase start instead of degrading into 80 per-component warnings.
 *
 * Deliberately cheap (~5–15ms, no program build) — see
 * `assertResolvablePublicExports` for the second, program-backed half of the
 * same eager check.
 */
export function assertUsableTsConfig(configPath: string): void {
  parseTsConfig(configPath);
}

/**
 * Second eager validation hook, run next to `assertUsableTsConfig` at phase
 * start: a package whose manifest *declares* typed entry points none of which
 * resolve must abort the run.
 *
 * This has to live at the pipeline level, not in `getProgramBundle`. The
 * extractors are constructed per component inside `ExtractionCoordinator`'s
 * per-extractor `try/catch`, which turns any constructor throw into
 * `{ success: false, data: [] }` plus a `console.warn` and never propagates
 * the error — so a throw from the bundle builder produced a *green* run over
 * 0 props, 0 variants and 0 types (measured: 5/5 components "successfully
 * extracted", exit 0). Building the program here is not extra work: it is the
 * same program every extractor is about to share, one phase earlier.
 *
 * An *unknown* surface is a warning rather than an error: a package with no
 * `exports` manifest at all is the documented ad-hoc case, and `exported`
 * is then absent (never `false`) on every type. It is still worth one line at
 * phase start, because every downstream gate loses its input.
 */
export function assertResolvablePublicExports(configPath: string): void {
  const bundle = getProgramBundle(configPath);
  if (bundle.publicExportFailure) throw new Error(bundle.publicExportFailure);
  if (!bundle.publicExportNames) {
    console.warn(
      `⚠️  ${bundle.packageRoot}: no typed entry point found in package.json#exports — ` +
        `the exported/not-exported flag will be absent on every extracted type.`
    );
  }
}

/**
 * Get (or build) the shared program bundle for a tsconfig. Throws when the
 * tsconfig is missing or unparsable — see the fail-loud contract above.
 *
 * The public-export surface is resolved *after* the bundle is cached, and its
 * failure is carried on the bundle instead of thrown. Throwing here left the
 * cache empty, so every extractor of every component rebuilt the program:
 * measured 160ms → 3667ms for the same five components (23×). A cache that
 * only fills on the happy path is not a cache.
 */
export function getProgramBundle(configPath: string): ProgramBundle {
  const resolved = path.resolve(configPath);

  const cached = bundles.get(resolved);
  if (cached) return cached;

  const parsed = parseTsConfig(resolved);
  const compilerOptions: ts.CompilerOptions = {
    ...parsed.options,
    // Documentation extraction never emits and never type-checks libs.
    noEmit: true,
    skipLibCheck: true
  };

  const program = ts.createProgram(parsed.fileNames, compilerOptions);
  const checker = program.getTypeChecker();
  const packageRoot = path.dirname(resolved);
  const bundle: ProgramBundle = {
    program,
    checker,
    compilerOptions,
    packageRoot,
    publicExportNames: null,
    publicExportFailure: null
  };
  bundles.set(resolved, bundle);

  const surface = resolvePublicExportNames(program, checker, packageRoot);
  bundle.publicExportNames = surface.names;
  bundle.publicExportFailure = surface.failure;
  return bundle;
}

/**
 * Source files a consumer can import from, derived from the package's own
 * `exports` map: every `./dist/<x>.d.ts` target is mapped back to the source
 * that produces it (`src/lib/<x>.ts` or `src/lib/<x>/index.ts`).
 *
 * Reading the manifest rather than hard-coding `src/lib/index.ts` is what
 * keeps the subpath entries honest — `@urbicon-ui/blocks/date` and
 * `@urbicon-ui/auth/server` are real import specifiers whose types are just
 * as public as the root entry's, and a root-only rule would report them as
 * private.
 */
function publicEntrySourceCandidates(packageRoot: string): {
  paths: string[];
  failure: string | null;
} {
  const manifestPath = path.join(packageRoot, 'package.json');
  if (!ts.sys.fileExists(manifestPath)) return { paths: [], failure: null };

  let manifest: { exports?: unknown };
  try {
    manifest = JSON.parse(ts.sys.readFile(manifestPath) ?? '{}');
  } catch (error) {
    return {
      paths: [],
      failure:
        `docs-gen: ${manifestPath} is not valid JSON, so the package's public export surface ` +
        `cannot be determined: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  const candidates = new Set<string>();
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      const target = node.match(/^\.\/dist\/(.+)\.d\.ts$/)?.[1];
      if (!target) return;
      candidates.add(path.join(packageRoot, 'src', 'lib', `${target}.ts`));
      candidates.add(path.join(packageRoot, 'src', 'lib', target, 'index.ts'));
      return;
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node as Record<string, unknown>)) visit(value);
    }
  };
  visit(manifest.exports);
  return { paths: [...candidates], failure: null };
}

/**
 * Union of the names exported from the package's public entry points.
 *
 * Never throws — the failure is returned, so `getProgramBundle` can cache the
 * bundle either way and `assertResolvablePublicExports` can raise it at phase
 * start, which is the only level where the error is not swallowed by
 * `ExtractionCoordinator`'s per-extractor `try/catch`.
 *
 * A manifest that *declares* typed entries none of which resolve is a
 * failure, not an unknown: the `dist/*.d.ts` → `src/lib/*` mapping has
 * broken, and every type in the package would be labelled "not exported" —
 * one uniformly wrong answer that a downstream lint would then enforce. A
 * package with no typed entries at all (test fixtures, ad-hoc roots) is the
 * documented unknown case and yields `null` without a failure.
 */
function resolvePublicExportNames(
  program: ts.Program,
  checker: ts.TypeChecker,
  packageRoot: string
): { names: ReadonlySet<string> | null; failure: string | null } {
  const candidates = publicEntrySourceCandidates(packageRoot);
  if (candidates.failure) return { names: null, failure: candidates.failure };
  if (candidates.paths.length === 0) return { names: null, failure: null };

  const names = new Set<string>();
  let resolved = 0;
  for (const candidate of candidates.paths) {
    const sourceFile = program.getSourceFile(candidate);
    if (!sourceFile) continue;
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) continue;
    resolved++;
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) names.add(symbol.getName());
  }

  if (resolved === 0) {
    return {
      names: null,
      failure:
        `docs-gen: ${path.join(packageRoot, 'package.json')} declares typed entry points, but none of ` +
        `them resolves to a source file in the program:\n` +
        candidates.paths.map((c) => `  - ${path.relative(packageRoot, c)}`).join('\n') +
        `\nWithout an entry the exported/not-exported flag on every type would be uniformly wrong.`
    };
  }
  return { names, failure: null };
}

/** Test hook: drop all cached programs. */
export function clearProgramCache(): void {
  bundles.clear();
}
