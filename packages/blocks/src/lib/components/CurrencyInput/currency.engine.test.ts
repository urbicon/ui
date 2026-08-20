import { describe, expect, it } from 'vitest';
import { applyEdit, type CurrencyMask, fractionDigits } from './currency.engine';

// The editing engine has no DOM in it, so the whole mask contract is reachable
// from the node suite: what an edit does to the amount, and where it leaves the
// caret. The caret is the half that used to be untestable — it lived in a
// requestAnimationFrame inside the component — and it is where the two reported
// defects sat: deleting twice from the end walked the caret past the decimal
// separator, and deleting the separator itself multiplied the amount by 100.
//
// `edit()` below is what a browser leaves behind after a keystroke: the text it
// wrote and where it put the caret. Every case is written that way rather than
// "the field now contains X", because the text alone cannot say whether a digit
// was inserted, replaced or deleted.

function mask(locale: string, precision = 2): CurrencyMask {
  const decimal =
    new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ??
    '.';
  const written = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 0
  }).format(1234567890);
  const digits = written.length === 10 ? written[9] + written.slice(0, 9) : '0123456789';
  return {
    precision,
    decimal,
    digits,
    format: (minor) => {
      const factor = 10 ** precision;
      const total = Math.abs(minor);
      const int = Math.trunc(total / factor).toLocaleString(locale, {
        useGrouping: true,
        maximumFractionDigits: 0
      });
      const fraction = (total % factor)
        .toString()
        .padStart(precision, '0')
        .replace(/[0-9]/g, (d) => digits[Number(d)]);
      const body = precision > 0 ? int + decimal + fraction : int;
      return minor < 0 ? `-${body}` : body;
    }
  };
}

const de = mask('de-DE');
const en = mask('en-US');
const jpy = mask('ja-JP', 0);

/** Backspace at `caret` (the offset *after* the deleted character). */
function backspace(previous: string, caret: number) {
  return { previous, next: previous.slice(0, caret - 1) + previous.slice(caret), caret: caret - 1 };
}

/** Forward-delete of the character at `caret`. */
function del(previous: string, caret: number) {
  return {
    previous,
    next: previous.slice(0, caret) + previous.slice(caret + 1),
    caret,
    deletion: 'forward' as const
  };
}

/** Cut the selection `[from, to)` — a removal that reaches for no neighbour. */
function cut(previous: string, from: number, to: number) {
  return {
    previous,
    next: previous.slice(0, from) + previous.slice(to),
    caret: from,
    deletion: 'exact' as const
  };
}

/** Type `text` at `caret`, replacing the selection `[caret, selectionEnd)`. */
function type(previous: string, caret: number, text: string, selectionEnd = caret) {
  return {
    previous,
    next: previous.slice(0, caret) + text + previous.slice(selectionEnd),
    caret: caret + text.length
  };
}

const at = (result: { display: string; caret: number }) =>
  `${result.display.slice(0, result.caret)}|${result.display.slice(result.caret)}`;

describe('currency.engine — deleting in the fraction', () => {
  it('zeroes the slot it deletes instead of dragging the separator', () => {
    const first = applyEdit(de, backspace('12,34', 5));
    expect(first.value).toBe(1230);
    expect(at(first)).toBe('12,3|0');

    const second = applyEdit(de, backspace(first.display, first.caret));
    expect(second.value).toBe(1200);
    expect(at(second)).toBe('12,|00');
  });

  it('leaves the caret behind the separator after two deletes from the end (#cursor)', () => {
    // The reported defect: from the end of `2.233,00` two backspaces put the
    // caret *in front of* the comma, and no keystroke could put it back behind.
    const first = applyEdit(de, backspace('2.233,00', 8));
    expect(at(first)).toBe('2.233,0|0');

    const second = applyEdit(de, backspace(first.display, first.caret));
    expect(at(second)).toBe('2.233,|00');
    expect(second.value).toBe(223300);
  });

  it('hops the caret over the decimal separator without touching the amount', () => {
    // Deleting the separator would move every cent digit into the integer part
    // — a silent ×100. The keypress moves the caret instead.
    const result = applyEdit(de, backspace('2.233,00', 6));
    expect(result.value).toBe(223300);
    expect(at(result)).toBe('2.233|,00');
  });

  it('hops forward over the decimal separator on Delete', () => {
    const result = applyEdit(de, del('2.233,45', 5));
    expect(result.value).toBe(223345);
    expect(at(result)).toBe('2.233,|45');
  });

  it('deletes the integer digit the caret reaches after the separator', () => {
    const result = applyEdit(de, backspace('2.233,00', 5));
    expect(result.value).toBe(22300);
    expect(at(result)).toBe('223|,00');
  });
});

describe('currency.engine — deleting in the integer part', () => {
  it('closes the gap and re-groups', () => {
    const result = applyEdit(de, backspace('12.345,00', 6));
    expect(result.value).toBe(123400);
    expect(at(result)).toBe('1.234|,00');
  });

  it('takes the neighbouring digit when the keypress lands on a grouping separator', () => {
    // The separator is decoration the next reformat puts back, so a backspace
    // on it has to do something — it takes the digit to its left.
    const back = applyEdit(de, backspace('2.233,00', 2));
    expect(back.value).toBe(23300);
    expect(at(back)).toBe('|233,00');

    // …and Delete takes the one to its right.
    const forward = applyEdit(de, del('2.233,00', 1));
    expect(forward.value).toBe(23300);
    expect(at(forward)).toBe('2|33,00');
  });

  it('empties the field when the last integer digit goes and no cent is left', () => {
    const result = applyEdit(de, backspace('1,00', 1));
    expect(result.value).toBeNull();
    expect(at(result)).toBe('|');
  });

  it('parks the caret behind the zero an emptied integer part leaves behind', () => {
    // The field cannot show *nothing* in front of the separator, so it shows the
    // `0` the amount has. The caret belongs behind it: the next digit typed then
    // replaces the placeholder instead of landing in front of it, which would
    // read as thirty rather than three.
    const emptied = applyEdit(de, backspace('1,56', 1));
    expect(emptied.value).toBe(56);
    expect(at(emptied)).toBe('0|,56');

    const retyped = applyEdit(de, type(emptied.display, emptied.caret, '3'));
    expect(retyped.value).toBe(356);
    expect(at(retyped)).toBe('3|,56');
  });

  it('clears on select-all + delete', () => {
    const result = applyEdit(de, { previous: '1.234,56', next: '', caret: 0 });
    expect(result.value).toBeNull();
    expect(result.display).toBe('');
  });
});

describe('currency.engine — typing', () => {
  it('overwrites the fraction slot the caret sits on', () => {
    const result = applyEdit(de, type('2.233,45', 6, '9'));
    expect(result.value).toBe(223395);
    expect(at(result)).toBe('2.233,9|5');
  });

  it('drops digits past the last fraction slot instead of rounding', () => {
    // `1.999` at precision 2 is 199 minor units — the string-split parse the
    // cents contract rests on, not `round(1.999 * 100)`.
    const result = applyEdit(en, type('', 0, '1.999'));
    expect(result.value).toBe(199);
    expect(at(result)).toBe('1.99|');
  });

  it('inserts into the integer part and carries the caret across a new group', () => {
    const result = applyEdit(de, type('999,00', 3, '9'));
    expect(result.value).toBe(999900);
    expect(at(result)).toBe('9.999|,00');
  });

  it('keeps the caret on the digit it typed, one group further along', () => {
    const result = applyEdit(de, type('2.233,00', 3, '9'));
    expect(result.value).toBe(2293300);
    expect(at(result)).toBe('22.9|33,00');
  });

  it('opens the fraction on an empty integer part as 0', () => {
    const opened = applyEdit(de, type('', 0, ','));
    expect(opened.value).toBe(0);
    expect(at(opened)).toBe('0,|00');

    const filled = applyEdit(de, type(opened.display, opened.caret, '5'));
    expect(filled.value).toBe(50);
    expect(at(filled)).toBe('0,5|0');
  });

  it('keeps a digit typed in front of the same digit', () => {
    // The browser leaves `22.233,00` whether the new `2` went in front of the
    // old one or behind it. Read the far way round, the keystroke disappears:
    // same text, same caret, no digit added.
    const result = applyEdit(de, type('2.233,00', 0, '2'));
    expect(result.value).toBe(2223300);
    expect(at(result)).toBe('2|2.233,00');
  });

  it('keeps the caret moving when a digit replaces its own twin', () => {
    const result = applyEdit(de, type('12,34', 3, '3'));
    expect(result.value).toBe(1234);
    expect(at(result)).toBe('12,3|4');
  });

  it('replaces a selection', () => {
    const result = applyEdit(de, type('1.234,56', 0, '9', 5));
    expect(result.value).toBe(956);
    expect(at(result)).toBe('9|,56');
  });

  it('drops the grouping separators out of a pasted amount', () => {
    const result = applyEdit(de, type('', 0, '1.234,56'));
    expect(result.value).toBe(123456);
    expect(result.display).toBe('1.234,56');
  });

  it('refuses a digit that would push the amount past the safe integer range', () => {
    const full = '9.007.199.254.740,99'; // 900719925474099 minor units
    const result = applyEdit(de, type(full, 15, '9'));
    expect(result.value).toBe(900719925474099);
    expect(result.display).toBe(full);
  });
});

describe('currency.engine — the sign', () => {
  it('keeps a lone minus on screen while it has no digits to sign', () => {
    const result = applyEdit(de, type('', 0, '-'));
    expect(result.value).toBeNull();
    expect(at(result)).toBe('-|');
  });

  it('carries the sign until a non-zero digit can hold it', () => {
    const minus = applyEdit(de, type('', 0, '-'));
    const zero = applyEdit(de, type(minus.display, minus.caret, '0'));
    expect(zero.value).toBe(0);
    expect(at(zero)).toBe('-0|,00');

    const cents = applyEdit(de, type(zero.display, 3, '5'));
    expect(cents.value).toBe(-50);
    expect(at(cents)).toBe('-0,5|0');
  });

  it('flips the sign of a value already on the field', () => {
    const negative = applyEdit(de, type('5,00', 0, '-'));
    expect(negative.value).toBe(-500);
    const positive = applyEdit(de, type(negative.display, 0, '-'));
    expect(positive.value).toBe(500);
  });

  it('ignores a minus typed inside the number', () => {
    const result = applyEdit(de, type('5,00', 1, '-'));
    expect(result.value).toBe(500);
    expect(result.display).toBe('5,00');
  });

  it('drops the sign when the minus itself is deleted', () => {
    const result = applyEdit(de, backspace('-5,00', 1));
    expect(result.value).toBe(500);
    expect(at(result)).toBe('|5,00');
  });
});

describe('currency.engine — precision 0', () => {
  it('has no fraction to edit', () => {
    const typed = applyEdit(jpy, type('', 0, '15000'));
    expect(typed.value).toBe(15000);
    expect(typed.display).toBe('15,000');

    const deleted = applyEdit(jpy, backspace(typed.display, typed.caret));
    expect(deleted.value).toBe(1500);
    expect(at(deleted)).toBe('1,500|');
  });

  it('ignores a typed decimal separator', () => {
    const result = applyEdit(jpy, type('15,000', 6, '.'));
    expect(result.value).toBe(15000);
    expect(result.display).toBe('15,000');
  });
});

describe('fractionDigits', () => {
  it('normalises what a consumer can pass as precision', () => {
    expect(fractionDigits(2)).toBe(2);
    expect(fractionDigits(0)).toBe(0);
    expect(fractionDigits(-3)).toBe(0);
    expect(fractionDigits(2.7)).toBe(2);
    expect(fractionDigits(Number.NaN)).toBe(0);
  });
});

describe('currency.engine — edits the caret does not sit at the end of', () => {
  // A keystroke leaves the caret behind what it typed, and the mask reads the
  // edit that way. A drop, an autofill and a composition commit do not, and
  // reading those the same way invents digits or reverts the write outright —
  // so the reading is checked against the text and falls back when it fails.

  it('reads text dropped in front of the caret', () => {
    // Chrome selects the dropped run, leaving selectionStart at the drop point.
    const result = applyEdit(de, { previous: '1,00', next: '199,00', caret: 1 });
    expect(result.value).toBe(19900);
    expect(result.display).toBe('199,00');
  });

  it('keeps an autofill that lands with the caret at the start', () => {
    const result = applyEdit(de, { previous: '1,00', next: '2.500,00', caret: 0 });
    expect(result.value).toBe(250000);
    expect(result.display).toBe('2.500,00');
  });

  it('keeps a composition commit whose caret trails the committed text', () => {
    const result = applyEdit(de, { previous: '', next: '1234', caret: 2 });
    expect(result.value).toBe(123400);
    expect(result.display).toBe('1.234,00');
  });
});

describe('currency.engine — which key produced the deletion', () => {
  it('walks Delete along the fraction instead of re-deleting one slot', () => {
    let state = { display: '12,34', caret: 3, value: 1234 as number | null };
    state = applyEdit(de, del(state.display, state.caret));
    expect(at(state)).toBe('12,0|4');
    state = applyEdit(de, del(state.display, state.caret));
    expect(at(state)).toBe('12,00|');
    expect(state.value).toBe(1200);
  });

  it('takes no neighbouring digit when a separator was cut rather than deleted', () => {
    // Cut selects the grouping separator and nothing else; a backspace onto it
    // leaves the browser the same text, so only the input type tells them apart.
    const result = applyEdit(de, cut('1.234,56', 1, 2));
    expect(result.value).toBe(123456);
    expect(result.display).toBe('1.234,56');
  });
});

describe('currency.engine — numbering systems that are not 0-9', () => {
  // 13 of the 100 most common locale tags write their digits in another script.
  // A field that cannot read its own digits back loses the amount on the first
  // keystroke — `١٢٣٤٫٥٦` parses as "no digits at all", i.e. as an empty field.
  const ar = mask('ar-EG');

  it('renders one script, not a Latin fraction under Arabic-Indic integers', () => {
    expect(ar.format(123456)).toBe('١٬٢٣٤٫٥٦');
  });

  it('reads its own digits back and keeps the amount', () => {
    // A digit typed at the end of the integer part, in the locale's own script.
    const result = applyEdit(ar, type('١٬٢٣٤٫٥٦', 5, '٧'));
    expect(result.value).toBe(1234756);
    expect(at(result)).toBe('١٢٬٣٤٧|٫٥٦');
  });

  it('accepts a Latin keyboard under a non-Latin locale', () => {
    const result = applyEdit(ar, type('١٬٢٣٤٫٥٦', 5, '7'));
    expect(result.value).toBe(1234756);
    expect(at(result)).toBe('١٢٬٣٤٧|٫٥٦');
  });

  it('deletes a cent digit without dragging the separator', () => {
    const result = applyEdit(ar, backspace('١٬٢٣٤٫٥٦', 8));
    expect(result.value).toBe(123450);
    expect(at(result)).toBe('١٬٢٣٤٫٥|٠');
  });
});
