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
 */
export function assertUsableTsConfig(configPath: string): void {
  parseTsConfig(configPath);
}

/**
 * Get (or build) the shared program bundle for a tsconfig. Throws when the
 * tsconfig is missing or unparsable — see the fail-loud contract above.
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
  const bundle: ProgramBundle = {
    program,
    checker: program.getTypeChecker(),
    compilerOptions,
    packageRoot: path.dirname(resolved)
  };
  bundles.set(resolved, bundle);
  return bundle;
}

/** Test hook: drop all cached programs. */
export function clearProgramCache(): void {
  bundles.clear();
}
