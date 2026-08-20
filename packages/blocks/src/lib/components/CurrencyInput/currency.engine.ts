/**
 * Editing engine for CurrencyInput — the half of the masked field that has no
 * DOM in it: given the text the field showed, the text the browser left behind
 * and where it put the caret, it returns the amount, the text to show, and
 * where the caret belongs.
 *
 * The field is a **fixed-scale mask**, not free text. Its display always carries
 * exactly `precision` fraction digits, which is what makes the two halves behave
 * differently:
 *
 * - the **integer part shifts** — deleting a digit closes the gap, so `2.233`
 *   minus a digit is `233`;
 * - a **fraction slot is overwritten** — deleting a cent digit zeroes its slot
 *   (`1,45` → `1,40` → `1,00`), so the separator never travels and the caret
 *   stays where the user was aiming.
 *
 * Everything else follows from that: the separators are the mask's own
 * punctuation and are never content, and the caret is carried through
 * reformatting as a digit slot rather than a character offset — grouping
 * separators appear and disappear as the number grows, so an offset would drift
 * by one on every thousands boundary.
 *
 * @internal Engine functions are an internal API of the CurrencyInput
 * component. They are exported for testing, not as part of the public surface;
 * the supported entry point is the `CurrencyInput` component itself.
 */

/** The locale-driven shape of the field, everything the engine needs to know. */
export interface CurrencyMask {
  /** Fraction digits the value carries: 2 for EUR/USD, 0 for JPY, 3 for BHD. */
  precision: number;
  /** The locale's decimal separator — the only character that opens the fraction. */
  decimal: string;
  /** Renders a minor-unit amount the way the field shows it, grouping included. */
  format: (minor: number) => string;
  /**
   * The locale's ten digits in ascending order, for the numbering systems that
   * are not written `0`–`9` (`ar`, `fa`, `bn`, `my`, …). ASCII digits are read
   * as well either way, so a Latin keyboard keeps working under those locales.
   * @default '0123456789'
   */
  digits?: string;
}

/** Which keypress produced a deletion — it decides what a separator takes with it. */
export type DeletionKind =
  /** Backspace: reaches for the character to its left. */
  | 'backward'
  /** Delete: reaches for the character to its right. */
  | 'forward'
  /** Cut, drag-out: the removed run is the selection, and nothing beside it. */
  | 'exact';

/** One edit as the browser left it behind. */
export interface CurrencyEdit {
  /** The text the field showed before the browser touched it. */
  previous: string;
  /** The text the browser left in the field. */
  next: string;
  /** `selectionStart` after the edit. */
  caret: number;
  /** Which keypress produced it. Only a deletion cares. @default 'backward' */
  deletion?: DeletionKind;
}

export interface CurrencyEditResult {
  /** The amount in minor units, `null` for an empty field. */
  value: number | null;
  /** The text the field must show. */
  display: string;
  /** Where the caret belongs in `display`. */
  caret: number;
}

/** Which half of the number a caret sits in — grouping separators aside. */
type Region = 'int' | 'frac';

interface Anchor {
  region: Region;
  /** Int: how many integer digits sit to its left. Frac: which fixed slot. */
  index: number;
}

const ASCII_DIGITS = '0123456789';

/** The ASCII value of a digit in the mask's numbering system, or `-1`. */
function digitOf(ch: string, digits: string): number {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  return digits === ASCII_DIGITS ? -1 : digits.indexOf(ch);
}

/** Normalise a consumer-supplied precision to a usable digit count. */
export function fractionDigits(precision: number): number {
  return Number.isFinite(precision) ? Math.max(0, Math.trunc(precision)) : 0;
}

/** Split a formatted display into the digits the model works on. */
function split(text: string, sep: number, precision: number, digits: string) {
  let int = '';
  let frac = '';
  for (let i = 0; i < text.length; i++) {
    const d = digitOf(text[i], digits);
    if (d < 0) continue;
    if (sep !== -1 && i > sep) frac += d;
    else int += d;
  }
  return {
    negative: text.startsWith('-'),
    int,
    // The fraction is a fixed row of slots, so a display that is short of digits
    // (never one we rendered — but a consumer can hand us anything) is padded up
    // rather than indexed out of range.
    frac: precision > 0 ? frac.padEnd(precision, '0').slice(0, precision) : ''
  };
}

/** Translate a character offset in `text` into a digit slot. */
function anchorAt(text: string, sep: number, pos: number, digits: string): Anchor {
  if (sep !== -1 && pos > sep) return { region: 'frac', index: pos - sep - 1 };
  let index = 0;
  for (let i = 0; i < pos && i < text.length; i++) if (digitOf(text[i], digits) >= 0) index++;
  return { region: 'int', index };
}

/** Translate an integer-digit slot back into a character offset in `display`. */
function offsetOfIntDigit(display: string, intEnd: number, slot: number, digits: string): number {
  let seen = 0;
  for (let i = 0; i < intEnd; i++) {
    if (digitOf(display[i], digits) < 0) continue;
    // Slot 0 means "before the first digit", which is after a leading sign.
    if (slot === 0) return i;
    seen++;
    if (seen === slot) return i + 1;
  }
  return intEnd;
}

interface Change {
  /** Where the change starts in `previous`. */
  head: number;
  /** Where it ends in `previous`. */
  removedEnd: number;
  /** What went in at `head`. */
  inserted: string;
}

/**
 * Recover what the browser did, from the text alone.
 *
 * The caret is the sharper of the two readings available: the run behind it is
 * untouched, which fixes where the change ends, and the text before the first
 * difference fixes where it starts. That is what tells a `2` typed *in front of*
 * `2.233` from one typed behind it — the browser leaves the same string either
 * way, and only the near reading has the new digit in it.
 *
 * But it rests on the caret sitting at the end of the change, which a drop, an
 * autofill or a composition commit does not honour. So the reading is checked
 * against `next`, and where it fails to reconstruct it the plain prefix/suffix
 * diff — which says nothing about a caret but is always right about the content
 * — takes over.
 */
function readEdit(previous: string, next: string, caret: number): Change {
  const untouchedTail = next.length - caret;
  const removedEnd = Math.max(0, previous.length - untouchedTail);
  const limit = Math.min(caret, removedEnd);
  let head = 0;
  while (head < limit && next[head] === previous[head]) head++;
  const inserted = next.slice(head, caret);
  if (previous.slice(0, head) + inserted + previous.slice(removedEnd) === next) {
    return { head, removedEnd, inserted };
  }

  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) {
    prefix++;
  }
  let suffix = 0;
  const room = Math.min(previous.length, next.length) - prefix;
  while (
    suffix < room &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    head: prefix,
    removedEnd: previous.length - suffix,
    inserted: next.slice(prefix, next.length - suffix)
  };
}

/**
 * Apply one browser edit to the mask. It covers every operation a text field
 * performs — typing, backspace, forward delete, replacing a selection, cut,
 * paste, drop, autofill — without the engine having to know which one it was,
 * which is what lets the component stay on a single `input` handler.
 */
export function applyEdit(mask: CurrencyMask, edit: CurrencyEdit): CurrencyEditResult {
  const precision = fractionDigits(mask.precision);
  const digits = mask.digits?.length === 10 ? mask.digits : ASCII_DIGITS;
  const deletion = edit.deletion ?? 'backward';
  const { previous, next } = edit;
  const caret = Math.max(0, Math.min(edit.caret, next.length));

  const { head, removedEnd, inserted } = readEdit(previous, next, caret);
  const removedLength = removedEnd - head;

  const sep = precision > 0 ? previous.indexOf(mask.decimal) : -1;
  const anchor = anchorAt(previous, sep, head, digits);

  const model = split(previous, sep, precision, digits);
  const intDigits = model.int.split('');
  const frac = model.frac.split('');
  const dropped = new Set<number>();
  let negative = model.negative;

  // ── What the edit removed ────────────────────────────────────────────────
  // The removed run starts at `head`, so every integer digit it covers sits at
  // or after the anchor — which is what lets the anchor stay valid for the
  // insertion below even though the integer digits shift.
  let intSlot = anchor.region === 'int' ? anchor.index : intDigits.length;
  let removedDigits = 0;
  let removedSign = false;
  for (let i = head; i < removedEnd; i++) {
    const ch = previous[i];
    if (digitOf(ch, digits) >= 0) {
      if (sep !== -1 && i > sep) frac[i - sep - 1] = '0';
      else dropped.add(intSlot++);
      removedDigits++;
    } else if (ch === '-') {
      negative = false;
      removedSign = true;
    }
    // Separators fall through: they belong to the mask, not to the amount.
  }

  let caretAnchor = anchor;
  if (removedLength > 0 && inserted === '' && anchor.region === 'frac' && removedDigits === 1) {
    // A fraction slot is zeroed where it stands rather than pulled left, so a
    // forward delete that stayed on it would keep deleting the same digit.
    if (deletion === 'forward') caretAnchor = { region: 'frac', index: anchor.index + 1 };
  } else if (removedLength > 0 && removedDigits === 0 && !removedSign && inserted === '') {
    // The user deleted punctuation and nothing else. The decimal separator is
    // structural — removing it would multiply the amount by 10^precision — so
    // the caret hops over it and the value stands. A grouping separator is pure
    // decoration that the next reformat puts back, so the keypress takes the
    // digit it was aimed at instead of doing nothing at all — unless nothing
    // was aimed at, which is what a cut or a drag-out is.
    if (sep !== -1 && head === sep) {
      caretAnchor = deletion === 'forward' ? { region: 'frac', index: 0 } : anchor;
    } else if (anchor.region === 'int' && deletion !== 'exact') {
      const target = deletion === 'forward' ? anchor.index : anchor.index - 1;
      if (target >= 0 && target < intDigits.length) {
        dropped.add(target);
        caretAnchor = { region: 'int', index: target };
      }
    }
  }

  // ── What the edit inserted ───────────────────────────────────────────────
  let int = intDigits.filter((_, i) => !dropped.has(i)).join('');
  let fraction = frac.join('');
  let region = caretAnchor.region;
  let slot = caretAnchor.index;

  for (const ch of inserted) {
    const digit = digitOf(ch, digits);
    if (digit >= 0) {
      if (region === 'frac') {
        // Past the last slot the digit is dropped: a fixed scale truncates,
        // it never rounds — `1,999` at precision 2 is 199 minor units, not 200.
        if (slot < precision) {
          fraction = fraction.slice(0, slot) + digit + fraction.slice(slot + 1);
          slot++;
        }
        continue;
      }
      const grown = `${int.slice(0, slot)}${digit}${int.slice(slot)}`;
      // Beyond 2^53 an integer amount silently stops being itself, so the digit
      // is refused rather than accepted into a wrong number.
      if (!Number.isSafeInteger(Number(grown + fraction))) continue;
      int = grown;
      slot++;
      continue;
    }
    if (precision > 0 && ch === mask.decimal && region === 'int') {
      // Opening the fraction with nothing to the left of it means `0,…`, so the
      // separator the user typed has something to sit behind.
      if (int === '') int = '0';
      region = 'frac';
      slot = 0;
      continue;
    }
    // A minus only reads as a sign where a sign can stand, and there it flips
    // the one already on the field rather than stacking a second one.
    if (ch === '-' && region === 'int' && slot === 0) negative = !negative;
    // Anything else — a grouping separator out of a pasted amount, a second
    // decimal separator, a stray letter — is not content and is dropped.
  }

  // ── The amount ───────────────────────────────────────────────────────────
  // An integer part the user emptied leaves no amount behind, even though the
  // fraction slots still hold their zeros: that is what clearing the field
  // looks like from the inside.
  const empty = int === '' && !/[1-9]/.test(fraction);
  const magnitude = empty ? null : Number(int + fraction);
  const value = magnitude === null ? null : negative && magnitude !== 0 ? -magnitude : magnitude;

  // A negative that has not reached a non-zero digit yet (`-`, `-0,00`) has no
  // number to carry its sign, so the display carries it until one arrives.
  let display = value === null ? '' : mask.format(value);
  if (negative && !display.startsWith('-')) display = `-${display}`;

  // ── The caret ────────────────────────────────────────────────────────────
  const displaySep = precision > 0 ? display.indexOf(mask.decimal) : -1;
  let position: number;
  if (region === 'frac' && displaySep !== -1) {
    position = displaySep + 1 + slot;
  } else {
    const intEnd = displaySep === -1 ? display.length : displaySep;
    let rendered = 0;
    for (let i = 0; i < intEnd; i++) if (digitOf(display[i], digits) >= 0) rendered++;
    // An integer part the user emptied is still rendered as `0`, and the caret
    // belongs *behind* that zero: the next digit typed then replaces the
    // placeholder (`0` → `3`) instead of landing in front of it and reading as
    // thirty. Otherwise: formatting drops leading zeros (`007` renders as `7`),
    // and a caret counted in digits has to drop them too or it sits one to the
    // right of where the user left it.
    const target =
      int === '' && rendered > 0
        ? rendered
        : Math.max(0, slot - Math.max(0, int.length - rendered));
    position = offsetOfIntDigit(display, intEnd, target, digits);
  }

  return { value, display, caret: Math.max(0, Math.min(position, display.length)) };
}
