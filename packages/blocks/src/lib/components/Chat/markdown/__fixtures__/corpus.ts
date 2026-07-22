/**
 * Corpus loader for the streaming-markdown test suite.
 *
 * Eagerly slurps every `*.md` under `./corpus` as raw text (Vite's `?raw`
 * query) and exposes them as a deterministically ordered array so the invariant
 * suite iterates the same sequence on every run.
 */

export interface CorpusFixture {
  /** Basename without extension, e.g. `01-gfm-table`. */
  name: string;
  /** Raw file contents, byte-for-byte. */
  text: string;
}

const modules = import.meta.glob('./corpus/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

export const corpus: CorpusFixture[] = Object.keys(modules)
  .sort()
  .map((path) => ({
    name: path.replace(/^.*\/([^/]+)\.md$/, '$1'),
    text: modules[path]
  }));
