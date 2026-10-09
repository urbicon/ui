/**
 * DOM readers shared by the chart tests.
 *
 * The slot contract is asked by identity: each probe's carriers are compared
 * with the elements the test picks out by tag and tree position, never by
 * class. `slot-reach.svelte.test.ts` already asks whether a slot reaches *an*
 * element, and that question stays green when two slots trade places.
 */

const PROBE = 'chart-probe-';

/** A `slotClasses` object writing one probe class per slot. */
export function probes<Slot extends string>(slots: readonly Slot[]): Record<Slot, string> {
  return Object.fromEntries(slots.map((slot) => [slot, `${PROBE}${slot}`])) as Record<Slot, string>;
}

/**
 * `tag#n`, where n is the element's index among `root` and its descendants:
 * two elements with the same markup still read differently.
 */
export function identify(root: Element, elements: Iterable<Element>): string[] {
  const all = [root, ...root.querySelectorAll('*')];
  return [...elements].map((el) => `${el.tagName.toLowerCase()}#${all.indexOf(el)}`);
}

/** Per slot, the elements (identified) whose class list carries that slot's probe. */
export function probeCarriers<Slot extends string>(
  root: Element,
  slots: readonly Slot[]
): Record<Slot, string[]> {
  const all = [root, ...root.querySelectorAll('*')];
  return Object.fromEntries(
    slots.map((slot) => [
      slot,
      identify(
        root,
        all.filter((el) => el.classList.contains(`${PROBE}${slot}`))
      )
    ])
  ) as Record<Slot, string[]>;
}

/** Per slot, the elements (identified) `pick` names for it. */
export function expectedCarriers<Slot extends string>(
  root: Element,
  slots: readonly Slot[],
  pick: Record<Slot, () => Element[]>
): Record<Slot, string[]> {
  return Object.fromEntries(slots.map((slot) => [slot, identify(root, pick[slot]())])) as Record<
    Slot,
    string[]
  >;
}

/**
 * A numeric attribute; `NaN` when absent, so a missing attribute fails the
 * match. `+ 0` folds `-0` into `0`, which `toEqual` tells apart.
 */
export function num(el: Element, name: string): number {
  const value = el.getAttribute(name);
  return value === null ? Number.NaN : Number(value) + 0;
}

const N = String.raw`-?[\d.]+`;

/**
 * The vertices `[x, y]` of a straight-segment path, read back from its `d`.
 * `closed` says whether the path must end in `Z`: on a stroked line that `Z`
 * draws a segment back to the start, so it is part of the shape. Anything else
 * — a curve, a second move-to, a non-finite coordinate — throws rather than
 * read as a path that moved.
 */
export function vertices(d: string, closed = false): number[][] {
  const shape = new RegExp(`^(?:M${N},${N}(?:L${N},${N})*${closed ? 'Z' : ''})?$`);
  if (!shape.test(d)) throw new Error(`not a straight ${closed ? 'closed' : 'open'} path: "${d}"`);
  return [...d.matchAll(new RegExp(`[ML](${N}),(${N})`, 'g'))].map(([, x, y]) => [
    Number(x),
    Number(y)
  ]);
}

/** Per mark, the text of its `<title>` child — the tooltip a browser shows on hover. */
export function titles(marks: Iterable<Element>): (string | undefined)[] {
  return [...marks].map((mark) => mark.querySelector(':scope > title')?.textContent?.trim());
}

/**
 * The one data table a chart renders for screen readers, as text. A header
 * cell reads `th[<scope>] <text>`, so a dropped `scope` reads `th[null] …`; a
 * data cell reads `td <text>`. `hidden` is whether the table's container is
 * the visually hidden one.
 */
export function dataTable(root: Element) {
  const tables = root.querySelectorAll('table');
  if (tables.length !== 1) throw new Error(`expected one <table>, found ${tables.length}`);
  const table = tables[0];
  return {
    hidden: table.parentElement?.classList.contains('sr-only') ?? false,
    caption: table.querySelector(':scope > caption')?.textContent?.trim(),
    rows: [...table.querySelectorAll('tr')].map((row) =>
      [...row.children].map((cell) => {
        const text = cell.textContent?.trim() ?? '';
        return cell.localName === 'th' ? `th[${cell.getAttribute('scope')}] ${text}` : `td ${text}`;
      })
    )
  };
}

/**
 * Every attribute value and text node under `root` that spells a non-finite
 * number — `NaN`, `Infinity`, or the `∞` `Intl.NumberFormat` prints for it.
 * A zero-width domain or a zero total that reaches a division shows up here.
 *
 * Formatted text spells NaN in the formatter's locale (`не число` under
 * ru-RU), and Node takes its default locale from `LANG`, so every formatter a
 * mount reaches has to spell it in English — `formatValue: String`, or an
 * English `locale` — or this reads past it.
 */
export function nonFinite(root: Element): string[] {
  const bad = /NaN|Infinity|∞/;
  const found: string[] = [];
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of el.attributes) {
      if (bad.test(attr.value))
        found.push(`<${el.tagName.toLowerCase()} ${attr.name}="${attr.value}">`);
    }
    for (const node of el.childNodes) {
      if (node.nodeType === 3 && bad.test(node.textContent ?? '')) {
        found.push(`<${el.tagName.toLowerCase()}>${node.textContent}`);
      }
    }
  }
  return found;
}
