#!/usr/bin/env bun
/**
 * Guard over `@summary` — the one sentence a human reads under a component's
 * name, on the landing page and in the component index.
 *
 * It exists as a tag of its own because one field for two readers served
 * neither: before the split the median `@description` ran 259 characters over
 * more than one sentence, 59 of 97 carried code voice, and the landing page
 * truncated the result mid-clause. `@description` stays the long form for
 * `llm.txt` and the MCP catalog; this checks that the short form stays short.
 *
 * The budget is measured, not taste: the hero's preview column fits roughly 52
 * characters per line and three lines before the stage is pushed down.
 *
 * Reads the generated catalogs, so it also proves the tag survived the
 * pipeline — a `@summary` the extractor drops is as broken as a missing one.
 */

const CATALOGS = ['blocks', 'table', 'auth'];
const ROOT = new URL('../../../apps/docs/static/', import.meta.url).pathname;

const MAX_CHARS = 120;
/** Code voice belongs in `@description`, not in a sentence under a headline. */
const CODE_VOICE = /[`{}<>]|\bv\d+\.\d+/;

interface Entry {
  name: string;
  summary?: string;
  tags?: string[];
}

const problems: string[] = [];
let checked = 0;

for (const catalog of CATALOGS) {
  const file = Bun.file(`${ROOT}${catalog}/_catalog.json`);
  if (!(await file.exists())) {
    problems.push(`${catalog}/_catalog.json is missing — run \`bun run docs:gen:all\` first.`);
    continue;
  }
  for (const entry of (await file.json()) as Entry[]) {
    checked++;
    const { name, summary } = entry;

    if (!summary) {
      problems.push(`${name}: no @summary on its *Props JSDoc.`);
      continue;
    }
    if (summary.length > MAX_CHARS) {
      problems.push(`${name}: @summary is ${summary.length} chars, the budget is ${MAX_CHARS}.`);
    }
    if (CODE_VOICE.test(summary)) {
      problems.push(
        `${name}: @summary carries code voice (backticks, braces, a version) — that belongs in @description.`
      );
    }
    // A second sentence means the first one did not do its job.
    if (/[.!?]\s+\S/.test(summary.replace(/\.\.\./g, '…'))) {
      problems.push(`${name}: @summary is more than one sentence.`);
    }
    if (!entry.tags?.length) {
      problems.push(`${name}: no @tag — the component index has no family to file it under.`);
    }
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s) in ${checked} components:\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('');
  process.exit(1);
}
console.log(
  `✓ ${checked} components: every @summary is one short sentence, every component has a @tag.`
);
