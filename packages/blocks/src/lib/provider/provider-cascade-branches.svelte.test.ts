// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import CascadeBranchHost from './__fixtures__/CascadeBranchHost.svelte';

/**
 * The branches `provider-cascade.svelte.test.ts` structurally cannot judge.
 *
 * That sweep mounts every component once, in its default state, and asks the
 * provider's five routes of the element it finds. Three kinds of defect sit
 * outside that by construction:
 *
 * - **the other orientation.** A component whose vertical branch drops part of
 *   the surface answers every route from its horizontal mount. Re-mounting the
 *   sweep vertically only moves the blind spot: measured, with the stepper
 *   family vertical, StepperStep's root carries no library class at all and
 *   route C reports "nothing to strip" instead.
 * - **the other call form.** `<MenuSection>` and the array-shaped section
 *   header render the same `section` slot. The sweep mounts Menu with neither
 *   — measured, its mount renders no section element at all — and judges
 *   Menu's own root. Both call forms now render *through* MenuSection, so the
 *   pair below is the control on that, no longer two separate code paths.
 * - **an instance prop.** Only `class` is passed to the component under
 *   measurement (route E), so `unstyled={false}` against a provider `unstyled`
 *   has no route to travel.
 *
 * Each test below carries its own control: the branch that already worked, or
 * the neighbouring component under the identical provider config. Without one,
 * a repair that moved the defect to the other branch reads as a pass.
 */

interface Rendered {
  target: HTMLElement;
  app: ReturnType<typeof mount>;
}

function render(props: Record<string, unknown>): Rendered {
  document.body.innerHTML = '';
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(CascadeBranchHost, { target, props: props as never });
  flushSync();
  return { target, app };
}

/** Class tokens of the first matching element; `undefined` when none matched. */
function classesOf(target: HTMLElement, selector: string): Set<string> | undefined {
  const element = target.querySelector(selector);
  return element ? new Set(element.classList) : undefined;
}

function withRender<T>(props: Record<string, unknown>, read: (target: HTMLElement) => T): T {
  const { target, app } = render(props);
  try {
    return read(target);
  } finally {
    unmount(app);
  }
}

const PANEL = '[role="tabpanel"]';
const STEP_ITEM = 'li';
/**
 * The section heading of the menu whose trigger reads `placeholder` — the
 * fixture names its two menus "declarative" and "array". Addressed through the
 * menu's own root rather than by position among all headings, so the control
 * does not silently follow the fixture's mount order. The shared selector is
 * itself the assertion that the two call forms no longer differ in role.
 */
function sectionHeadingOf(target: HTMLElement, placeholder: string): Set<string> | undefined {
  const root = Array.from(target.querySelectorAll<HTMLElement>('[data-menu-root]')).find((el) =>
    el.querySelector('button')?.textContent?.includes(placeholder)
  );
  if (!root) throw new Error(`no menu with the trigger "${placeholder}" in the fixture`);
  const heading = root.querySelector('[role="presentation"]');
  return heading ? new Set(heading.classList) : undefined;
}

describe('TabPanel takes the strip’s orientation', () => {
  it('drops the horizontal top margin when the strip is vertical', () => {
    const vertical = withRender({ composition: 'tab', orientation: 'vertical' }, (t) =>
      classesOf(t, PANEL)
    );
    expect(vertical?.has('mt-4')).toBe(false);
    expect(vertical?.has('flex-1')).toBe(true);
  });

  it('keeps it when the strip is horizontal', () => {
    const horizontal = withRender({ composition: 'tab' }, (t) => classesOf(t, PANEL));
    expect(horizontal?.has('mt-4')).toBe(true);
    expect(horizontal?.has('flex-1')).toBe(false);
  });

  it('lets an `overrides` rule condition on the orientation it carries', () => {
    const rule = (condition: Record<string, string>) =>
      withRender(
        {
          composition: 'tab',
          orientation: 'vertical',
          defaults: { TabPanel: { overrides: [{ ...condition, class: { panel: 'probe-rule' } }] } }
        },
        (t) => classesOf(t, PANEL)
      );
    // `size` is the control: it was always in the condition object, so a dead
    // `orientation` rule and a dead resolver look the same without it.
    expect(rule({ size: 'md' })?.has('probe-rule')).toBe(true);
    expect(rule({ orientation: 'vertical' })?.has('probe-rule')).toBe(true);
  });
});

describe('StepperStep routes its item slot in both orientations', () => {
  const stepItem = (orientation: 'horizontal' | 'vertical') =>
    withRender(
      {
        composition: 'stepper',
        orientation,
        defaults: { StepperStep: { slotClasses: { stepItem: 'probe-item' } } }
      },
      (t) => classesOf(t, STEP_ITEM)
    );

  it('delivers `slotClasses.stepItem` to the vertical item', () => {
    expect(stepItem('vertical')?.has('probe-item')).toBe(true);
  });

  it('still delivers it to the horizontal item, beside the library classes', () => {
    const horizontal = stepItem('horizontal');
    expect(horizontal?.has('probe-item')).toBe(true);
    // The control that separates "the slot arrives" from "the branch renders
    // nothing": horizontally the slot carries library classes of its own.
    expect(horizontal?.has('items-center')).toBe(true);
  });
});

describe('MenuSection renders the same `section` slot as its sibling call form', () => {
  it('strips the library classes under provider `unstyled`, like the array form', () => {
    const { declarative, array } = withRender({ composition: 'menu', unstyled: true }, (t) => ({
      declarative: sectionHeadingOf(t, 'declarative'),
      array: sectionHeadingOf(t, 'array')
    }));
    expect(declarative?.size).toBe(0);
    expect(array?.size).toBe(0);
  });

  it('takes `slotClasses.section` from the provider, like the array form', () => {
    const { declarative, array } = withRender(
      { composition: 'menu', defaults: { Menu: { slotClasses: { section: 'probe-section' } } } },
      (t) => ({
        declarative: sectionHeadingOf(t, 'declarative'),
        array: sectionHeadingOf(t, 'array')
      })
    );
    expect(declarative?.has('probe-section')).toBe(true);
    expect(array?.has('probe-section')).toBe(true);
    // Both keep the library look beside it — the entry merges, it does not replace.
    expect(declarative?.has('font-medium')).toBe(true);
    expect(array?.has('font-medium')).toBe(true);
  });
});

describe('CalendarHeader folds `unstyled` the way the other 60 components do', () => {
  /** CalendarHeader's own outermost element, inside the fixture's scope marker. */
  const header = (target: HTMLElement) => classesOf(target, '[data-header-scope] > div');

  it('stays stripped under a provider `unstyled` when the instance passes false', () => {
    const stripped = withRender(
      { composition: 'calendar', unstyled: true, partUnstyled: false },
      (t) => ({ header: header(t), control: classesOf(t, '[data-control]') })
    );
    expect(stripped.header?.size).toBe(0);
    // Control: Card under the identical provider, with the identical prop.
    expect(stripped.control?.size).toBe(0);
  });

  it('still strips on its own prop without a provider', () => {
    const own = withRender({ composition: 'calendar', partUnstyled: true }, header);
    expect(own?.size).toBe(0);
  });

  it('keeps its classes when neither says so', () => {
    const styled = withRender({ composition: 'calendar' }, header);
    expect(styled?.has('flex-wrap')).toBe(true);
  });
});

describe('compound parts are addressed under the parent’s provider name', () => {
  // #339's correction, pinned: CalendarHeader has no provider name of its own
  // and is not meant to grow one — it renders only inside `<Calendar>`, and the
  // name that reaches it is that parent's.
  //
  // LocaleSwitcher used to sit here beside it and no longer does: #355 gave it
  // a name of its own, because a *wrapper* has a second problem a compound part
  // does not — a forwarded `preset` resolves inside the component it wraps and
  // styles every instance of it. `preset-scope.svelte.test.ts` owns that
  // question for all four wrappers; measured here, `presets.LocaleSwitcher` now
  // reaches its field and `presets.Select` does not.
  it('reaches CalendarHeader’s three elements through `defaults.Calendar`', () => {
    const reached = withRender(
      {
        composition: 'calendar',
        defaults: {
          Calendar: {
            slotClasses: { header: 'probe-header', nav: 'probe-nav', title: 'probe-title' }
          }
        }
      },
      (t) => [...t.querySelectorAll('[class*="probe-"]')].map((el) => el.className)
    );
    expect(reached.some((c) => c.includes('probe-header'))).toBe(true);
    expect(reached.some((c) => c.includes('probe-nav'))).toBe(true);
    expect(reached.some((c) => c.includes('probe-title'))).toBe(true);
  });
});

describe('embedded controls sit on the ladder, not in a literal class string', () => {
  // #339's fourth point. A class string written straight onto a `<button>` is
  // unreachable by construction: `unstyled` cannot drop it and a colliding
  // consumer class cannot beat it, because nothing ever passes it through the
  // fold. Measured before the repair: 14 tokens on each picker button and 10 on
  // each stepper, byte-identical across baseline, provider `unstyled` and
  // instance `unstyled`.
  //
  // The sweep cannot see this either — it judges one element per component, and
  // these six sit deep inside an `<Input>`'s right-icon area.
  //
  // None of the six is a `CoreIconButton` (none of the three files imports it),
  // so the plumbing exception of COMPONENT-API-CONVENTIONS.md does not apply:
  // every token here, look and layout alike, belongs on the ladder.
  const CASES = [
    ['datePicker', 'DatePicker', 'iconButton', 'rounded-modify'],
    ['dateRangePicker', 'DateRangePicker', 'iconButton', 'rounded-modify'],
    ['numberInput', 'NumberInput', 'stepperButton', 'transition-colors']
  ] as const;

  /** The component's own buttons — the trailing one is the control `<Button>`. */
  function embedded(target: HTMLElement): HTMLElement[] {
    const all = [...target.querySelectorAll('button')];
    return all.filter((button) => !button.hasAttribute('data-control'));
  }

  const control = (target: HTMLElement) => classesOf(target, '[data-control]');

  it.each(CASES)(
    '%s: provider `unstyled` empties them',
    (composition, _name, _slot, libraryClass) => {
      const read = (props: Record<string, unknown>) =>
        withRender({ composition, ...props }, (t) => ({
          buttons: embedded(t).map((b) => new Set(b.classList)),
          control: control(t)?.size ?? 0
        }));

      const base = read({});
      const stripped = read({ unstyled: true });

      expect(base.buttons.length).toBe(2);
      for (const classes of base.buttons) expect(classes.has(libraryClass)).toBe(true);
      expect(stripped.buttons.map((c) => c.size)).toEqual([0, 0]);
      // The control says the provider reached this render at all — without it,
      // "no classes" and "nothing rendered" read the same. It keeps a couple of
      // structural tokens under `unstyled`, so the assertion is that it shrank.
      expect(stripped.control).toBeLessThan(base.control);
    }
  );

  it.each(CASES)('%s: the instance prop empties them too', (composition) => {
    const own = withRender({ composition, partUnstyled: true }, (t) =>
      embedded(t).map((b) => b.classList.length)
    );
    expect(own).toEqual([0, 0]);
  });

  it.each(CASES)(
    '%s: a provider `slotClasses` entry reaches them',
    (composition, name, slot, libraryClass) => {
      const { probed, controlClasses } = withRender(
        { composition, defaults: { [name]: { slotClasses: { [slot]: 'probe-control' } } } },
        (t) => ({
          probed: embedded(t).map((b) => new Set(b.classList)),
          controlClasses: control(t)?.size
        })
      );
      expect(probed.length).toBe(2);
      for (const classes of probed) {
        expect(classes.has('probe-control')).toBe(true);
        // Beside the library look, not instead of it.
        expect(classes.has(libraryClass)).toBe(true);
      }
      // The control is untouched by an entry written under another name.
      expect(controlClasses).toBeGreaterThan(0);
    }
  );
});
