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
 * A numeric attribute rounded to 6 decimals, so a test can compare it with a
 * literal: a scale step like 90 / 30 lands a hair off the integer. `NaN` when
 * absent, so a missing attribute fails the match. `+ 0` folds `-0` into `0`,
 * which `toEqual` tells apart.
 */
export function num(el: Element, name: string): number {
  const value = el.getAttribute(name);
  return value === null ? Number.NaN : Math.round(Number(value) * 1e6) / 1e6 + 0;
}

/**
 * Every attribute value and text node under `root` that spells a non-finite
 * number — `NaN`, `Infinity`, or the `∞` `Intl.NumberFormat` prints for it.
 * A zero-width domain or a zero total that reaches a division shows up here.
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
