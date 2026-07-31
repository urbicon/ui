#!/usr/bin/env bun
/**
 * build-packages — builds every package in dependency order.
 *
 * `bun --filter='./packages/*' run build` runs all packages CONCURRENTLY and
 * does not honour the `workspace:*` edges between them. That is not a
 * performance detail: `packages/docs` types its variants against
 * `VariantProps` from `@urbicon-ui/blocks`, so if blocks' `dist` is not
 * finished when docs is type-checked, TypeScript cannot resolve the tv()
 * return type — and emits `export declare const docsLayoutVariants: any`
 * instead of failing. Exit code 0, declaration file present, every variant
 * prop gone.
 *
 * Measured 2026-07-31: a clean concurrent build degraded all nine
 * `packages/docs/**\/*.variants.d.ts` to `any` (21 KB → 180 B); rebuilding docs
 * afterwards, with blocks/dist in place, restored them. Which packages lose
 * their types depends purely on which build finishes first, so a release could
 * ship correct types one day and `any` the next. v6.45.0 happened to be fine.
 *
 * Layers are derived from the `@urbicon-ui/*` edges in each package.json
 * rather than hardcoded, so a new package joins the right layer on its own —
 * a hardcoded list would silently stop building anything added later.
 */

const ROOT = new URL('..', import.meta.url).pathname;

type Pkg = { name: string; dir: string; needs: Set<string> };

const packages: Pkg[] = [];
for (const rel of new Bun.Glob('packages/*/package.json').scanSync({ cwd: ROOT })) {
  const json = (await Bun.file(`${ROOT}/${rel}`).json()) as Record<string, unknown>;
  const name = json.name as string;
  const needs = new Set<string>();
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
    for (const dep of Object.keys((json[field] ?? {}) as Record<string, string>)) {
      if (dep.startsWith('@urbicon-ui/') && dep !== name) needs.add(dep);
    }
  }
  packages.push({ name, dir: rel.replace('/package.json', ''), needs });
}

const known = new Set(packages.map((p) => p.name));
const done = new Set<string>();
const layers: Pkg[][] = [];

while (done.size < packages.length) {
  const pending = packages.filter((p) => !done.has(p.name));
  // A package is ready once every in-repo dependency it declares is built.
  // Edges to packages outside this workspace are irrelevant here.
  const ready = pending.filter((p) => ![...p.needs].some((d) => known.has(d) && !done.has(d)));
  if (ready.length === 0) {
    console.error(`✖ dependency cycle among: ${pending.map((p) => p.name).join(', ')}`);
    process.exit(1);
  }
  layers.push(ready);
  for (const p of ready) done.add(p.name);
}

console.log(`build-packages · ${packages.length} packages in ${layers.length} layers`);

for (const [i, layer] of layers.entries()) {
  const names = layer.map((p) => p.dir.replace('packages/', '')).join(', ');
  console.log(`\n── layer ${i + 1}/${layers.length}: ${names}`);
  // Within a layer nothing depends on anything else in it, so concurrency is
  // safe and keeps the wall-clock cost of ordering low. Spawned directly rather
  // than through Bun's shell: `$` quotes an interpolated array as one argument,
  // which reaches bun as a single unmatched filter.
  const args = ['--bun', ...layer.flatMap((p) => [`--filter=./${p.dir}`]), 'run', 'build'];
  const proc = Bun.spawn(['bun', ...args], { cwd: ROOT, stdout: 'inherit', stderr: 'inherit' });
  const code = await proc.exited;
  if (code !== 0) {
    console.error(`\n✖ layer ${i + 1} failed (${names}) — exit ${code}`);
    process.exit(code);
  }
}
