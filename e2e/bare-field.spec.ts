import { expect, test } from '@playwright/test';

/**
 * `bare` is what the browser computes, not what the config says.
 *
 * The class strings are already asserted in `internal/field-bare-variant.test.ts`,
 * where the question is which class survives the tv() fold. This file asks the
 * only question that file cannot: does the resulting stylesheet actually paint
 * nothing at rest and something on focus.
 *
 * Two claims need a browser and nothing less:
 *
 * - **At rest there is no chrome.** `border-0` is one class among a dozen that
 *   set a border property, and a computed `border-width` of 0 with a `box-shadow`
 *   of `none` and a `padding` of 0 is the whole definition of the variant. A
 *   consumer reading `bare` in the API table is promised this, not a class list.
 * - **On keyboard focus there is an indicator (WCAG 2.4.7).** `bare` has no frame
 *   to tint, so its outline is all a keyboard user gets — and the field's base
 *   slot carries `focus-visible:outline-none`, which sets `--tw-outline-style:
 *   none`. Whether `outline-solid` wins that is a cascade question, and the
 *   cascade lives in the compiled stylesheet. The `ghost` twin is the control:
 *   focused, it reveals a real border, which is what `bare` must not do.
 */

const URL = '/test-fixtures/bare-field';

// `reducedMotion` is not cosmetic here: Combobox's frame carries Tailwind's
// `transition-colors`, whose property list includes `outline-color`, so a
// computed read right after focus lands mid-interpolation and returns an
// oklab blend of the ink and the focus colour. Reduced motion collapses
// `--blocks-duration-fast` to 1ms, which makes the read the end state.
test.use({
  channel: 'chromium',
  viewport: { width: 900, height: 1400 },
  reducedMotion: 'reduce'
});

/** The element each component draws its frame on. */
const FRAME: Record<string, string> = {
  input: 'input',
  textarea: 'textarea',
  select: 'button[role="combobox"]',
  combobox: 'input[role="combobox"]'
};

/**
 * The one padding a bare field keeps: the lane an absolutely positioned control
 * needs back after `p-0` took it. Combobox always hosts one (clear or chevron);
 * Select's chevron is a flex child, so a non-clearable Select keeps none.
 */
const LANE: Record<string, string> = {
  input: '0px',
  textarea: '0px',
  select: '0px',
  combobox: '28px'
};

interface Chrome {
  borderTopWidth: string;
  borderBottomWidth: string;
  borderLeftWidth: string;
  borderRightWidth: string;
  boxShadow: string;
  paddingTop: string;
  paddingBottom: string;
  paddingLeft: string;
  paddingRight: string;
  borderRadius: string;
  backgroundColor: string;
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
  fontSize: string;
  focusVisible: boolean;
}

function read(
  page: import('@playwright/test').Page,
  probe: string,
  frame: string
): Promise<Chrome> {
  return page.evaluate(
    ({ probe: name, frame: selector }) => {
      const host = document.querySelector(`[data-probe="${name}"]`);
      if (!host) throw new Error(`no probe "${name}"`);
      const el = host.querySelector<HTMLElement>(selector);
      if (!el) throw new Error(`probe "${name}" has no "${selector}"`);
      const s = getComputedStyle(el);
      return {
        borderTopWidth: s.borderTopWidth,
        borderBottomWidth: s.borderBottomWidth,
        borderLeftWidth: s.borderLeftWidth,
        borderRightWidth: s.borderRightWidth,
        boxShadow: s.boxShadow,
        paddingTop: s.paddingTop,
        paddingBottom: s.paddingBottom,
        paddingLeft: s.paddingLeft,
        paddingRight: s.paddingRight,
        borderRadius: s.borderTopLeftRadius,
        backgroundColor: s.backgroundColor,
        outlineStyle: s.outlineStyle,
        outlineWidth: s.outlineWidth,
        outlineColor: s.outlineColor,
        fontSize: s.fontSize,
        focusVisible: el.matches(':focus-visible')
      };
    },
    { probe, frame }
  );
}

/** Every length in a computed `box-shadow` that is not zero. */
function nonZeroLengths(boxShadow: string): string[] {
  return [...boxShadow.matchAll(/-?\d+(?:\.\d+)?px/g)]
    .map((m) => m[0])
    .filter((px) => Number.parseFloat(px) !== 0);
}

/**
 * Keyboard focus, so `:focus-visible` applies — the state the library styles —
 * and then a wait until the focus look has settled.
 *
 * The wait is not padding. The focus look is transitioned: the fields' own
 * property list carries `box-shadow`, and Tailwind's `transition-colors`
 * (Combobox) carries `outline-color`, so a computed read taken in the same task
 * returns the START of the interpolation — for an outline that is
 * `currentColor`, i.e. the page's ink, which is exactly the wrong answer read
 * confidently. `reducedMotion` above collapses the duration to 1ms; this polls
 * frame by frame until two consecutive frames agree.
 */
async function tabInto(
  page: import('@playwright/test').Page,
  probe: string,
  frame: string
): Promise<void> {
  await page.locator(`[data-anchor="${probe}"]`).focus();
  await page.keyboard.press('Tab');
  await page.waitForFunction(
    ({ probe: name, frame: selector }) => {
      const el = document.querySelector(`[data-probe="${name}"]`)?.querySelector(selector);
      if (!el) return false;
      const s = getComputedStyle(el);
      const now = `${s.outlineColor}|${s.boxShadow}|${s.borderTopWidth}`;
      const w = window as unknown as { __settled?: string };
      const previous = w.__settled;
      w.__settled = now;
      return previous === now;
    },
    { probe, frame }
  );
}

/** The colour the token resolves to, read off the page rather than restated here. */
function focusRingColor(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.color = 'var(--blocks-focus-ring-color)';
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto(URL);
  await expect(page.getByTestId('bare-field-fixtures')).toBeVisible();
});

for (const component of ['input', 'textarea', 'select', 'combobox'] as const) {
  test(`${component}: bare draws no chrome at rest`, async ({ page }) => {
    const bare = await read(page, `${component}-bare`, FRAME[component]);

    expect(bare.borderTopWidth).toBe('0px');
    expect(bare.borderRightWidth).toBe('0px');
    expect(bare.borderBottomWidth).toBe('0px');
    expect(bare.borderLeftWidth).toBe('0px');
    expect(bare.boxShadow).toBe('none');
    expect(bare.paddingTop).toBe('0px');
    expect(bare.paddingRight).toBe(LANE[component]);
    expect(bare.paddingBottom).toBe('0px');
    expect(bare.paddingLeft).toBe('0px');
    expect(bare.borderRadius).toBe('0px');
    // `bg-transparent` — an alpha-zero colour, whatever the theme resolves it to.
    expect(bare.backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    // The type step is the one thing `size` keeps: md is 16px.
    expect(bare.fontSize).toBe('16px');
  });

  test(`${component}: ghost keeps the measure bare gives up`, async ({ page }) => {
    const ghost = await read(page, `${component}-ghost`, FRAME[component]);

    // The control for the test above: the same field one variant over is framed
    // and padded, so "0px everywhere" is a property of `bare`, not of the probe.
    expect(Number.parseFloat(ghost.borderTopWidth)).toBeGreaterThan(0);
    expect(Number.parseFloat(ghost.paddingLeft)).toBeGreaterThan(0);
    expect(Number.parseFloat(ghost.borderRadius)).toBeGreaterThan(0);
  });

  test(`${component}: bare shows a focus outline in the family colour`, async ({ page }) => {
    await tabInto(page, `${component}-bare`, FRAME[component]);
    const focused = await read(page, `${component}-bare`, FRAME[component]);

    expect(focused.focusVisible).toBe(true);
    // The indicator is an outline, not a ring: forced-colors mode drops
    // box-shadow, and `bare` has no border left to fall back on.
    expect(focused.outlineStyle).toBe('solid');
    expect(Number.parseFloat(focused.outlineWidth)).toBeGreaterThanOrEqual(2);
    expect(focused.outlineColor).toBe(await focusRingColor(page));
    // And still no frame — focus reveals nothing on `bare`.
    expect(focused.borderTopWidth).toBe('0px');
    // `ring-0` leaves Tailwind's shadow chain standing at zero size rather
    // than removing it, so the test is that every length in it is 0 — not
    // that the property is `none`, which it only is at rest.
    expect(nonZeroLengths(focused.boxShadow)).toEqual([]);
  });

  test(`${component}: ghost reveals a frame on focus instead`, async ({ page }) => {
    await tabInto(page, `${component}-ghost`, FRAME[component]);
    const focused = await read(page, `${component}-ghost`, FRAME[component]);

    expect(focused.focusVisible).toBe(true);
    expect(Number.parseFloat(focused.borderTopWidth)).toBeGreaterThan(0);
    // Its indicator is a tinted ring — a box-shadow with a real size, which is
    // the control for the zero-size chain `bare` leaves behind.
    expect(nonZeroLengths(focused.boxShadow).length).toBeGreaterThan(0);
  });
}

/**
 * Where the text ends and where the absolutely positioned control starts.
 *
 * `p-0` takes the lane the size axis reserved for that control with it, so
 * without a `pr-*` put back the two overlap — which is a geometry question and
 * has no answer in a class string.
 */
function lane(
  page: import('@playwright/test').Page,
  probe: string,
  textSelector: string
): Promise<{ textRight: number; buttonLeft: number; button: string }> {
  return page.evaluate(
    ({ probe: name, textSelector: text }) => {
      const host = document.querySelector(`[data-probe="${name}"]`);
      const textEl = host?.querySelector(text);
      // The LAST button in the probe: the anchor comes first, the field's own
      // control last (`:last-of-type` picks per parent and would find the
      // anchor, which is a sibling rather than a descendant of the field).
      const buttonEl = [...(host?.querySelectorAll('button') ?? [])].at(-1);
      if (!textEl || !buttonEl) throw new Error(`probe "${name}" is missing text or button`);
      const textBox = textEl.getBoundingClientRect();
      // The CONTENT box, not the border box: the lane is padding, so a full-width
      // field's border box reaches the button by design and only its content
      // edge says whether the text has room. `truncate` and an input's own clip
      // stop the painted glyphs early, so the box is the honest measure.
      const padRight = Number.parseFloat(getComputedStyle(textEl).paddingRight) || 0;
      return {
        textRight: textBox.right - padRight,
        buttonLeft: buttonEl.getBoundingClientRect().left,
        button: buttonEl.getAttribute('aria-label') ?? buttonEl.className
      };
    },
    { probe, textSelector }
  );
}

test('a clearable bare Select keeps the lane its clear button sits in', async ({ page }) => {
  const bare = await lane(page, 'select-bare-clearable', '[class*="truncate"]');
  const outlined = await lane(page, 'select-outlined-clearable', '[class*="truncate"]');

  expect(bare.textRight).toBeLessThanOrEqual(bare.buttonLeft);
  // The control: the framed twin has always had the lane.
  expect(outlined.textRight).toBeLessThanOrEqual(outlined.buttonLeft);
});

test('a bare Combobox keeps the lane its chevron sits in', async ({ page }) => {
  await page
    .locator('[data-probe="combobox-bare-value"] input')
    .fill('A label long enough to run the whole width of this narrow field and then some');
  const { textRight, buttonLeft } = await lane(page, 'combobox-bare-value', 'input');
  // The input's text is clipped by the input box itself, so the box edge is the
  // measurement: it must stop before the button.
  expect(textRight).toBeLessThanOrEqual(buttonLeft);
});

test('the focus outline takes its width from the token, not a literal', async ({ page }) => {
  await tabInto(page, 'input-bare', FRAME.input);
  const normal = await read(page, 'input-bare', FRAME.input);
  expect(normal.outlineWidth).toBe('2px');
});

test('an invalid bare field focuses in the failure tone', async ({ page }) => {
  const family = await focusRingColor(page);

  await tabInto(page, 'input-bare-error', FRAME.input);
  const focused = await read(page, 'input-bare-error', FRAME.input);

  expect(focused.focusVisible).toBe(true);
  expect(focused.outlineStyle).toBe('solid');
  expect(focused.outlineColor).not.toBe(family);
  await expect(page.locator('[data-probe="input-bare-error"] input')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
});

/**
 * The reason the width and the offset are tokens rather than `outline-2`:
 * `prefers-contrast: more` raises `--blocks-focus-ring-width` to 3px (and moves
 * the colour to the ink), and a literal would have ignored both.
 */
test.describe('under prefers-contrast: more', () => {
  // `page.emulateMedia`, not `test.use({ contrast })` — measured, the fixture
  // option did not reach `matchMedia('(prefers-contrast: more)')` in this
  // Playwright version and the test would have passed on the default styling.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ contrast: 'more' });
    await page.goto(URL);
    await expect(page.getByTestId('bare-field-fixtures')).toBeVisible();
  });

  test('the bare outline thickens with the token', async ({ page }) => {
    await tabInto(page, 'input-bare', FRAME.input);
    const focused = await read(page, 'input-bare', FRAME.input);

    expect(focused.focusVisible).toBe(true);
    expect(focused.outlineStyle).toBe('solid');
    expect(focused.outlineWidth).toBe('3px');
    // The colour follows the same token block, so it is no longer the accent.
    expect(focused.outlineColor).toBe(await focusRingColor(page));
  });
});
