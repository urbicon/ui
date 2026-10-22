/**
 * The Popover API the DOM suites of blocks and table run against — imported by both
 * `vitest-setup.ts` files (auth runs blocks' file), so what an open panel is cannot differ
 * between packages. Not published: it lives in `scripts/`, outside every package root.
 */
// ── Popover API ─────────────────────────────────────────────────────────────
//
// jsdom ships no `showPopover`/`hidePopover`, and its selector engine answers `:popover-open`
// with `false` for every element. Its UA sheet still applies
// `[popover]:not(:popover-open):not(dialog[open]) { display: none }`, so every `[popover]`
// element computes `display: none`, shown or not — and `focus()` refuses an element inside a
// `display: none` one. A no-op `showPopover()` leaves an opened panel unfocusable.
//
// The stub keeps the shown state in one attribute, and both readers derive from it:
//
// - the cascade: `OPEN_RULE` un-hides a shown `[popover]`. jsdom cascades UA and author rules
//   by specificity alone, with no origins, so the rule has to reach the UA rule's (0,3,1); at
//   equal specificity the later, author sheet wins. Not `!important`: that would also beat an
//   inline `display: none`, which a browser lets hide even an open popover. Not `revert`
//   either — jsdom has no origin to revert to, it computes the literal `revert`. A vitest
//   document carries no other author sheet (component `<style>` blocks and imported CSS are
//   not injected), so `block` is what Chromium computes there for an open `div` or `span`.
// - every selector method: `:popover-open` is rewritten to `OPEN_SELECTOR`, so the
//   product's `matches(':popover-open')` guards (show only while hidden, hide only while
//   shown) see the state the stub set. `getComputedStyle` matches rules through jsdom's own
//   engine, never these methods — which is why the cascade needs a rule of its own.
//
// Show/hide fire no `beforetoggle`/`toggle` events and never throw, and `showPopover()` on an
// element without the `popover` attribute shows nothing.
const SHOWN = 'data-vitest-popover-open';
const OPEN_SELECTOR = `[popover][${SHOWN}]`;
const OPEN_RULE = `${OPEN_SELECTOR}:not(dialog[open]) { display: block; }`;
const POPOVER_OPEN = /:popover-open(?![\w-])/g;

type SelectorMethod = (this: unknown, selectors: unknown) => unknown;

function answerPopoverOpen(proto: object, names: readonly string[]) {
  const methods = proto as Record<string, SelectorMethod>;
  for (const name of names) {
    const native = methods[name];
    methods[name] = function (this: unknown, selectors: unknown) {
      return native.call(
        this,
        typeof selectors === 'string' ? selectors.replace(POPOVER_OPEN, OPEN_SELECTOR) : selectors
      );
    };
  }
}

if (typeof window !== 'undefined' && !HTMLElement.prototype.showPopover) {
  HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement) {
    if (this.hasAttribute('popover')) this.setAttribute(SHOWN, '');
  };
  HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement) {
    this.removeAttribute(SHOWN);
  };

  answerPopoverOpen(Element.prototype, [
    'matches',
    'webkitMatchesSelector',
    'closest',
    'querySelector',
    'querySelectorAll'
  ]);
  answerPopoverOpen(Document.prototype, ['querySelector', 'querySelectorAll']);
  answerPopoverOpen(DocumentFragment.prototype, ['querySelector', 'querySelectorAll']);

  const sheet = document.createElement('style');
  sheet.textContent = OPEN_RULE;
  document.head.append(sheet);
}
