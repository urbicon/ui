/**
 * The one `matchMedia` the DOM suites of blocks and table run against — imported by both
 * `vitest-setup.ts` files, so the answer to a query cannot differ between the two packages.
 * Not published: it lives in `scripts/`, outside every package root.
 */
// ── matchMedia ──────────────────────────────────────────────────────────────
//
// Queries the mounted tree asks about: `prefers-reduced-motion` and
// `(hover: hover)` in the blocks mint engine, `(max-width: 639px)` in the
// Pagination the table renders in its footer.
//
// Answered from `mediaState` below rather than with a flat `false`, because
// `false` is not a neutral default — it is a WRONG answer to `(min-width: 1px)`,
// and it lets any test of anything media-query-shaped pass without the branch it
// is about ever running. jsdom ships no `matchMedia` in this environment
// (measured: the flat stub this replaces installed itself on every run, behind a
// `if (!window.matchMedia)` guard), so this is the only implementation the suite
// has.
//
// The defaults reproduce the answers the flat stub gave — 1024 is jsdom's own
// `innerWidth`, and at that width `(max-width: 639px)` and `(max-width: 1023px)`
// are false either way — so installing this changes no existing test. What it
// adds is a width a test can MOVE, plus a `change` event on the lists whose
// answer flips, so `MediaQuery` from `svelte/reactivity` re-reads.
//
// A query with no rule here throws instead of answering `false`. That is the
// point: the next media-query-shaped feature has to teach this stub about
// itself rather than inherit a silent `false`.
const MEDIA_DEFAULTS = { width: 1024, prefersReducedMotion: false, hover: false };
const mediaState = { ...MEDIA_DEFAULTS };
const liveLists = new Set<StubMediaQueryList>();

const LENGTH_QUERY = /^\(\s*(min|max)-width:\s*([\d.]+)(px|rem|em)\s*\)$/;

/** jsdom has no layout, so `rem`/`em` resolve against the CSS initial 16px. */
const toPx = (value: string, unit: string) => (unit === 'px' ? Number(value) : Number(value) * 16);

function evaluateMedia(query: string): boolean {
  const normalized = query.trim();
  if (normalized === '(prefers-reduced-motion: reduce)') return mediaState.prefersReducedMotion;
  if (normalized === '(prefers-reduced-motion: no-preference)')
    return !mediaState.prefersReducedMotion;
  if (normalized === '(hover: hover)') return mediaState.hover;
  if (normalized === '(hover: none)') return !mediaState.hover;

  const length = LENGTH_QUERY.exec(normalized);
  if (length) {
    const px = toPx(length[2], length[3]);
    return length[1] === 'min' ? mediaState.width >= px : mediaState.width <= px;
  }

  throw new Error(
    `matchMedia stub: no rule for ${JSON.stringify(query)}. Add one in ` +
      'scripts/vitest-match-media.ts — answering `false` to a query nobody taught it is how ' +
      'a media-query test goes green without ever running its branch.'
  );
}

class StubMediaQueryList extends EventTarget {
  readonly media: string;
  matches: boolean;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null;

  constructor(query: string) {
    super();
    this.media = query;
    this.matches = evaluateMedia(query);
    liveLists.add(this);
  }

  /** Pre-2019 Safari surface; `svelte/reactivity` uses `addEventListener`. */
  addListener(listener: (ev: MediaQueryListEvent) => void) {
    this.addEventListener('change', listener as EventListener);
  }
  removeListener(listener: (ev: MediaQueryListEvent) => void) {
    this.removeEventListener('change', listener as EventListener);
  }

  refresh() {
    const next = evaluateMedia(this.media);
    if (next === this.matches) return;
    this.matches = next;
    const event = Object.assign(new Event('change'), { matches: next, media: this.media });
    this.onchange?.call(this as unknown as MediaQueryList, event as unknown as MediaQueryListEvent);
    this.dispatchEvent(event);
  }
}

function refreshLists() {
  for (const list of liveLists) list.refresh();
}

/**
 * Move the viewport width `(min-width:)` / `(max-width:)` are answered against,
 * and notify every live list whose answer changed.
 */
export function setMediaViewport(width: number) {
  mediaState.width = width;
  refreshLists();
}

/** Move the motion preference the mint engine reads. */
export function setPrefersReducedMotion(reduced: boolean) {
  mediaState.prefersReducedMotion = reduced;
  refreshLists();
}

/** Back to the defaults — belongs in an `afterEach` of any test that moved one. */
export function resetMediaState() {
  Object.assign(mediaState, MEDIA_DEFAULTS);
  refreshLists();
}

if (typeof window !== 'undefined') {
  window.matchMedia = ((query: string) =>
    new StubMediaQueryList(query)) as unknown as typeof window.matchMedia;
}
