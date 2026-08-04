import bash from '@shikijs/langs/bash';
import css from '@shikijs/langs/css';
import html from '@shikijs/langs/html';
import ini from '@shikijs/langs/ini';
import javascript from '@shikijs/langs/javascript';
import json from '@shikijs/langs/json';
import svelte from '@shikijs/langs/svelte';
import toml from '@shikijs/langs/toml';
import typescript from '@shikijs/langs/typescript';
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
 * oniguruma WASM (which can only be instantiated asynchronously). Both costs
 * were measured before this was written, and both came out the other way round
 * from the guess recorded in #10:
 *
 *  - **Bytes.** The nine grammars move into the eager bundle: 43 → 116 KB gz.
 *    But the 145 KB gz `onig.wasm` and the 63 KB gz of lazily fetched grammars
 *    go away entirely, so the total over the wire drops 252 → 116 KB gz. The
 *    issue expected this to be the blocking cost; it pays for itself twice.
 *  - **Output.** Over the 245 code snippets this site actually renders, the two
 *    engines produce byte-identical HTML in 244. The single difference is the
 *    colour of one closing brace in one import statement.
 *
 * What it does cost is CPU: the JS engine is ~4.3× slower per snippet (241
 * snippets: 192 ms → 823 ms). That is paid once per render, against network
 * round-trips it removes — and across the whole prerender it is under a second.
 *
 * Grammars are imported by name on purpose. A dynamic `langs/${name}` would
 * defeat the bundler and drag all ~200 of them back in — the same trap the icon
 * set has with `getIcon`.
 */

/** The languages the docs site uses. Anything else falls back to escaped text. */
const LANGS = [svelte, typescript, javascript, css, html, bash, json, toml, ini];

class HighlighterService {
  #highlighter: HighlighterCore | null = null;

  /**
   * Built on first use, not at import: a page with no code block should not pay
   * for grammars it never highlights. Construction measured at ~2 ms.
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
   * A language the highlighter does not carry, or a grammar that throws, falls
   * back to escaped plain text rather than to nothing — the same contract the
   * async version had, minus the timeout race it needed to bound the await.
   */
  highlightCode(code: string, language: string): string {
    try {
      return this.getHighlighter().codeToHtml(code, {
        lang: language,
        themes: { light: 'editorial-light', dark: 'editorial-dark' }
      });
    } catch {
      return `<pre><code>${escapeHtml(code)}</code></pre>`;
    }
  }

  dispose(): void {
    this.#highlighter?.dispose();
    this.#highlighter = null;
  }
}

function escapeHtml(code: string): string {
  return String(code ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const highlighterService = new HighlighterService();
