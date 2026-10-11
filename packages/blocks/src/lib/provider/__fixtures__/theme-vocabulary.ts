import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/**
 * Which theme props each component admits, and every value each one admits —
 * asked of the TypeScript checker about the type the provider itself uses.
 *
 * Not a re-implementation of the rule: for each props type this writes
 * `StylePropsOf<XProps>` into a file the checker reads alongside the package,
 * and reads the answer back. So the sweep's population is the provider's type,
 * whatever that type is changed to, and a prop the type admits cannot be one
 * the sweep never mounts.
 *
 * What it reads is the props type the `$props()` call is annotated with — the
 * type svelte2tsx gives the component, and the one `ThemePropsOf` reaches
 * through the package barrel.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME_PROPS = resolve(HERE, '../theme-props.ts');
const VIRTUAL = join(HERE, '__theme_vocabulary__.ts');

export interface PropsTypeRef {
  /** The key the answer is filed under. */
  key: string;
  name: string;
  file: string;
}

/** Each admitted prop with its values: string literals, or both booleans. */
export type Vocabulary = Record<string, (string | boolean)[]>;

/** The type parameter count of `name` in `file`, so a generic props type can be closed with `any`. */
function typeParameterCount(file: string, name: string): number {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  let count = 0;
  source.forEachChild((node) => {
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name.text === name
    ) {
      count = node.typeParameters?.length ?? 0;
    }
  });
  return count;
}

function valuesOf(type: ts.Type): (string | boolean)[] {
  const members = type.isUnion() ? type.types : [type];
  const values: (string | boolean)[] = [];
  for (const member of members) {
    if (member.isStringLiteral()) values.push(member.value);
    else if (member.flags & ts.TypeFlags.BooleanLiteral) {
      values.push((member as { intrinsicName?: string }).intrinsicName === 'true');
    }
  }
  return values;
}

export function themeVocabularies(refs: PropsTypeRef[]): Map<string, Vocabulary> {
  const lines = [
    `import type { StylePropsOf } from './${relative(HERE, THEME_PROPS).replace(/\.ts$/, '')}';`
  ];
  refs.forEach((ref, i) => {
    if (!ref.file.endsWith('.ts')) {
      throw new Error(
        `${ref.key}: its props type is declared in ${ref.file}, which the checker cannot read`
      );
    }
    const specifier = `./${relative(HERE, ref.file).replace(/\.ts$/, '')}`;
    const args = typeParameterCount(ref.file, ref.name);
    const applied = args > 0 ? `${ref.name}<${Array(args).fill('any').join(', ')}>` : ref.name;
    lines.push(`import type { ${ref.name} as P${i} } from '${specifier}';`);
    lines.push(`export type V${i} = StylePropsOf<${applied.replace(ref.name, `P${i}`)}>;`);
  });
  const text = lines.join('\n');

  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    types: []
  };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (file, language, ...rest) =>
    file === VIRTUAL
      ? ts.createSourceFile(file, text, language)
      : getSourceFile(file, language, ...rest);
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (file) => file === VIRTUAL || fileExists(file);
  const readFile = host.readFile.bind(host);
  host.readFile = (file) => (file === VIRTUAL ? text : readFile(file));

  const program = ts.createProgram([VIRTUAL], options, host);
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(VIRTUAL);
  const moduleSymbol = source && checker.getSymbolAtLocation(source);
  if (!moduleSymbol) throw new Error('the checker did not read the vocabulary file');
  const exports = new Map(checker.getExportsOfModule(moduleSymbol).map((s) => [s.name, s]));

  const result = new Map<string, Vocabulary>();
  refs.forEach((ref, i) => {
    const symbol = exports.get(`V${i}`);
    if (!symbol) throw new Error(`${ref.key}: no answer for ${ref.name}`);
    const type = checker.getDeclaredTypeOfSymbol(symbol);
    const arms = type.isUnion() ? type.types : [type];
    const vocabulary: Vocabulary = {};
    for (const arm of arms) {
      for (const prop of checker.getPropertiesOfType(arm)) {
        const values = valuesOf(checker.getTypeOfSymbol(prop));
        const known = new Set(vocabulary[prop.name] ?? []);
        for (const value of values) known.add(value);
        vocabulary[prop.name] = [...known];
      }
    }
    result.set(ref.key, vocabulary);
  });
  return result;
}
