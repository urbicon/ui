import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Positive controls for `section-ids:check`, run as the CLI over a fixture
 * build (`--dist`). A check that parsed nothing prints the same verdict as one
 * that found every id distinct, so the clean build has to report what it read,
 * and a build it cannot read has to fail.
 */

const SCRIPT = join(import.meta.dirname, 'section-ids-check.ts');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function build(pages: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'section-ids-'));
  roots.push(root);
  for (const [path, body] of Object.entries(pages)) {
    mkdirSync(join(root, dirname(path)), { recursive: true });
    writeFileSync(join(root, path), `<!doctype html><html><body>${body}</body></html>`);
  }
  return root;
}

function check(dist: string) {
  const run = spawnSync('bun', [SCRIPT, '--dist', dist], { encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

/** A page as `<Section>` renders one: the id, and the heading id derived from it. */
function section(id: string, attrs = ''): string {
  return `<section ${attrs} id="${id}" aria-labelledby="${id}-title"><h2 id="${id}-title">${id}</h2></section>`;
}

const CLEAN = {
  'index.html': section('playground') + section('api'),
  // The same id on two pages is two documents, not a repeat.
  'blocks/components/button.html': section('playground') + section('examples'),
  // Repeats outside a <section> are not this check's question.
  'blocks/components/guide.html': `${section('api')}<table><tr id="prop-class"></tr><tr id="prop-class"></tr></table>`
};

describe('section-ids-check', () => {
  it('passes a build whose pages keep their section ids apart', () => {
    const { status, output } = check(build(CLEAN));

    expect(output).toContain('5 <section id> on 3 pages');
    expect(status).toBe(0);
  });

  it('names the page and the id two of its sections share', () => {
    const { status, output } = check(
      build({
        ...CLEAN,
        // Nested and with its attributes in another order: still a section.
        'blocks/components/tabs.html': `${section('examples')}<div>${section('examples', 'class="demo"')}</div>`
      })
    );

    expect(output).toContain('blocks/components/tabs.html: 2 sections share the id "examples"');
    expect(output).not.toContain('button.html');
    expect(output).not.toContain('guide.html');
    expect(status).toBe(1);
  });

  it('fails on a build it cannot read', () => {
    const missing = check(join(build(CLEAN), 'nope'));
    const pageless = check(build({}));
    const sectionless = check(build({ 'index.html': '<main id="main"></main>' }));

    expect(missing.output).toContain('no build to check');
    expect(pageless.output).toContain('read 0 page(s)');
    expect(sectionless.output).toContain('read 1 page(s) and 0 <section id>');
    expect([missing.status, pageless.status, sectionless.status]).toEqual([1, 1, 1]);
  });
});
