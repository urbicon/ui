import bash from '@shikijs/langs/bash';
import css from '@shikijs/langs/css';
import html from '@shikijs/langs/html';
import ini from '@shikijs/langs/ini';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import svelte from '@shikijs/langs/svelte';
import toml from '@shikijs/langs/toml';
import typescript from '@shikijs/langs/typescript';
import yaml from '@shikijs/langs/yaml';
import { createHighlighterCoreSync, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { editorialDark, editorialLight } from './shiki-editorial-themes';

/**
 * Syntax highlighting, synchronously — which is what makes it survive SSR.
 *
 * This was an async singleton (`createHighlighter`, oniguruma, grammars behind
 * dynamic imports) and every `CodePanel` awaited it in an `$effect`. Effects do
 * not run on the server, so the prerendered artifact of every docs page carried
 * a spinner and the string "Loading syntax highlighting…" where the code should
 * be — 186 code blocks that a non-rendering crawler read as having no content
 * at all (#10).
 *
 * Going synchronous needs the two things Shiki ships for exactly this: the
 * `Sync` core, and a regex engine written in JavaScript instead of the
 * oniguruma WASM (which can only be instantiated asynchronously).
 *
 *  - **Bytes.** Measured on the built client bundles of this site, not on
 *    `node_modules`. The eager entry chunk grows 44 → 121 KB gz as the ten
 *    grammars move into it. What goes away is bigger: Vite resolves Shiki's
 *    `./wasm` export to the **base64-inlined** build (the `unwasm` condition is
 *    never set), so the old output shipped oniguruma as a 607 KB JS chunk —
 *    225 KB gz, fetched on the first code block — plus ~64 KB gz of grammar
 *    chunks. So ~333 → 121 KB gz over the wire for a page with code. Note the
 *    split, though: the part that grew is the *eager* one, and the part that
 *    shrank was fetched after mount, outside the critical path.
 *
 *    (#10 assumed the grammar growth would be the blocking cost, and an earlier
 *    version of this comment put the saving at 145 KB gz — the size of
 *    `node_modules/shiki/dist/onig.wasm`, a file this site has never shipped.)
 *  - **Output.** Over a 252-snippet corpus taken from this repo (102 svelte,
 *    117 ts, 23 css, the rest json/bash/toml/ini/html/js) the two engines
 *    produce byte-identical HTML for every one. That is the risk #10 actually
 *    recorded — that highlighting would shift across the site — and it did not
 *    materialise.
 *
 * What it costs is CPU: the JS engine is ~2× slower per snippet warm (252
 * snippets: 379 → 756 ms) and ~4× cold, where regex compilation dominates.
 *
 * Grammars are imported by name on purpose. A dynamic `langs/${name}` would
 * defeat the bundler and drag all ~200 of them back in — the same trap the icon
 * set has with `getIcon`.
 */

/**
 * The languages this site uses. **Not** every language a consumer might ask
 * for — see `highlightCode`, which reports an unknown one rather than quietly
 * rendering plain text.
 */
const LANGS = [svelte, typescript, javascript, css, html, bash, json, toml, ini, yaml];

class HighlighterService {
  #highlighter: HighlighterCore | null = null;
  /**
   * Highlighted output, keyed by language and code.
   *
   * Not a micro-optimisation: `{@html}` re-evaluates its expression during
   * hydration and then keeps the server's DOM anyway, so without this every
   * page highlights all of its blocks a second time, synchronously on the main
   * thread, and throws the result away. Measured at ~3 ms per snippet — on a
   * page with 31 blocks that is ~90 ms of blocking time for nothing.
   *
   * Capped because client-side navigation would otherwise grow it for the life
   * of the session. Eviction is oldest-first, which is right here: the entries
   * worth keeping are the ones on screen.
   */
  #cache = new Map<string, string>();

  /**
   * Built on first use, not at import. That defers ~4 ms of construction and
   * ~0.5 MB of heap — **not** the bytes: the grammar imports at the top of this
   * file are static, so they load and evaluate whether or not a page has a code
   * block.
   */
  getHighlighter(): HighlighterCore {
    this.#highlighter ??= createHighlighterCoreSync({
      themes: [editorialLight, editorialDark],
      langs: LANGS,
      engine: createJavaScriptRegexEngine()
    });
    return this.#highlighter;
  }

  /**
   * Highlight `code` as `language`, returning Shiki's `<pre class="shiki">`.
   *
   * A language this service does not carry renders as escaped plain text — and
   * says so in DEV. Silence there was the old shape and it was wrong twice
   * over: `yaml` is used on a docs page and was rendering unhighlighted with no
   * signal at all, and since this now runs on the server the degradation gets
   * baked into prerendered HTML where nobody is watching a console.
   *
   * A grammar that throws is a different thing — a bug, not a configuration
   * gap — so it is reported at `error` level and still falls back rather than
   * taking the page down.
   */
  highlightCode(code: string, language: string): string {
    // `:` and not a NUL separator, which is what this was first written with.
    // It parsed, so nothing failed — but it made the file binary to every text
    // tool, `rg` and `git diff` included. A colon is unambiguous here because a
    // language id never contains one.
    const key = `${language}:${code}`;
    const cached = this.#cache.get(key);
    if (cached !== undefined) return cached;

    const highlighter = this.getHighlighter();
    let output: string;
    if (!highlighter.getLoadedLanguages().includes(language)) {
      if (import.meta.env?.DEV) {
        console.warn(
          `[docs] No grammar for language "${language}" — rendering it as plain text. Add it to LANGS in packages/docs/src/lib/utils/highlighter.ts.`
        );
      }
      output = `<pre><code>${escapeHtml(code)}</code></pre>`;
    } else {
      try {
        output = highlighter.codeToHtml(code, {
          lang: language,
          themes: { light: 'editorial-light', dark: 'editorial-dark' }
        });
      } catch (error) {
        console.error(`[docs] Highlighting "${language}" failed:`, error);
        output = `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
    }

    if (this.#cache.size >= CACHE_LIMIT) {
      const oldest = this.#cache.keys().next().value;
      if (oldest !== undefined) this.#cache.delete(oldest);
    }
    this.#cache.set(key, output);
    return output;
  }

  dispose(): void {
    this.#highlighter?.dispose();
    this.#highlighter = null;
    this.#cache.clear();
  }
}

/** Roughly two dense docs pages' worth of blocks. */
const CACHE_LIMIT = 200;

function escapeHtml(code: string): string {
  return String(code ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const highlighterService = new HighlighterService();
