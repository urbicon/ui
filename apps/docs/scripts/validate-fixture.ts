/**
 * Run a recorded fixture through the library's own A2UI validator.
 *
 * A recording is model output, so "it looked right in the browser" is the weak
 * check: a payload can render and still bind to a data path the schema never
 * declared, or carry a prop the registry drops. This asks the same processor
 * `A2UIView` runs, with the same catalog and the same `BOOKING_SCHEMA`, and
 * prints every issue it raises.
 *
 * Usage (from the repo root, after `build:packages`):
 *   bun apps/docs/scripts/validate-fixture.ts [path-to-fixture.json]
 */

// Relative dist imports, same reason as in `record-fixture.ts`: the package
// barrel re-exports Svelte runtime modules that bare Bun cannot execute. Both
// modules below are plain TS output with no Svelte in their import graph.
import {
  createA2uiProcessor,
  normalizeA2uiPayload
} from '../../../packages/blocks/dist/components/Chat/A2UIView/a2ui-validate.js';
import { urbiconA2uiCatalogSpec } from '../../../packages/blocks/dist/components/Chat/A2UIView/urbicon/a2ui-urbicon-registry.js';
import { BOOKING_SCHEMA } from '../src/lib/booking-schema';

const path =
  process.argv[2] ?? new URL('../src/lib/replay/booking-fixture.json', import.meta.url).pathname;
const fixture = (await Bun.file(path).json()) as {
  turns: { frames: { event: string; data: { text?: string } }[] }[];
};

const processor = createA2uiProcessor({
  catalogs: [urbiconA2uiCatalogSpec],
  dataSchema: BOOKING_SCHEMA
});

let index = 0;
for (const turn of fixture.turns) {
  let raw = '';
  for (const frame of turn.frames) if (frame.event === 'token') raw += frame.data.text ?? '';
  for (const fence of raw.matchAll(/```a2ui\n([\s\S]*?)```/g)) {
    for (const line of fence[1].trim().split('\n')) {
      const { envelopes } = normalizeA2uiPayload(JSON.parse(line));
      for (const envelope of envelopes) processor.apply(envelope, index++);
    }
  }
}

const surfaces = [...processor.surfaces.values()];
const issues = [...processor.globalIssues, ...surfaces.flatMap((surface) => surface.issues)];
const errors = issues.filter((issue) => issue.severity === 'error');

console.log(`Surfaces:    ${[...processor.surfaces.keys()].join(', ') || '—'}`);
console.log(`Components:  ${surfaces.reduce((n, surface) => n + surface.components.size, 0)}`);
console.log(`Envelopes:   ${index}`);
console.log(`Issues:      ${errors.length} error(s), ${issues.length - errors.length} warning(s)`);
for (const issue of issues) console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`);

process.exit(errors.length > 0 ? 1 : 0);
