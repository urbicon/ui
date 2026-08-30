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
 *   header render the same `section` slot through separate code. The sweep
 *   mounts Menu with neither — measured, its mount renders no section element
 *   at all — and judges Menu's own root.
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
function classesOf(target: HTMLElement, selector: string, index = 0): Set<string> | undefined {
  const element = target.querySelectorAll(selector)[index];
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
/** MenuSection's own element. */
const DECLARATIVE_SECTION = '[role="separator"]';
/** The array-shaped section header — the same `section` slot, other call form. */
const ARRAY_SECTION = '[role="presentation"]';

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
      declarative: classesOf(t, DECLARATIVE_SECTION),
      array: classesOf(t, ARRAY_SECTION)
    }));
    expect(declarative?.size).toBe(0);
    expect(array?.size).toBe(0);
  });

  it('takes `slotClasses.section` from the provider, like the array form', () => {
    const { declarative, array } = withRender(
      { composition: 'menu', defaults: { Menu: { slotClasses: { section: 'probe-section' } } } },
      (t) => ({
        declarative: classesOf(t, DECLARATIVE_SECTION),
        array: classesOf(t, ARRAY_SECTION)
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
  /** The header bar; `[0]` is Calendar's own root, `[1]` its sr-only live region. */
  const header = (target: HTMLElement) => classesOf(target, 'div', 2);

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
  // #339's correction, pinned: CalendarHeader and LocaleSwitcher have no
  // provider name of their own and are not meant to grow one. What reaches
  // them is the name of the component they render inside of / through.
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

  it('reaches LocaleSwitcher through `defaults.Select` and `presets.Select`', () => {
    // Select's root slot is `wrapper` (the label column) and `base` is the
    // field inside it — both arrive, which is what "it renders nothing of its
    // own" means here.
    const viaDefaults = withRender(
      {
        composition: 'localeSwitcher',
        defaults: { Select: { slotClasses: { wrapper: 'probe-wrapper', base: 'probe-base' } } }
      },
      (t) => ({ wrapper: classesOf(t, 'div', 0), base: classesOf(t, 'div', 1) })
    );
    expect(viaDefaults.wrapper?.has('probe-wrapper')).toBe(true);
    expect(viaDefaults.base?.has('probe-base')).toBe(true);

    // The `preset` prop takes the same route: LocaleSwitcher declares none, so
    // it rides the rest spread into <Select> and resolves under `Select`.
    const viaPreset = withRender(
      {
        composition: 'localeSwitcher',
        partPreset: 'compact',
        presets: { Select: { compact: { slotClasses: { base: 'probe-preset' } } } }
      },
      (t) => classesOf(t, 'div', 1)
    );
    expect(viaPreset?.has('probe-preset')).toBe(true);
  });
});
