// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import AreaChart from '$lib/components/AreaChart/AreaChart.svelte';
import BarChart from '$lib/components/BarChart/BarChart.svelte';
import Calendar from '$lib/components/Calendar/Calendar.svelte';
import { calendarVariants } from '$lib/components/Calendar/calendar.variants';
import ChartFrame from '$lib/components/ChartFrame/ChartFrame.svelte';
import DonutChart from '$lib/components/DonutChart/DonutChart.svelte';
import LineChart from '$lib/components/LineChart/LineChart.svelte';
import {
  AREA_CHART_SLOTS,
  BAR_CHART_SLOTS,
  CHART_FRAME_SLOTS,
  DONUT_CHART_SLOTS,
  LINE_CHART_SLOTS
} from '$lib/internal/charts/slots';
import { chartVariants } from '$lib/internal/charts/variants';

/**
 * Does every slot a component's `slotClasses` type offers reach an element of
 * that component?
 *
 * A slot name type-checks and autocompletes from the config's own derived
 * union, so `slotClasses={{ weekColumn: 'min-h-8' }}` compiles whether or not
 * any element reads `weekColumn`. Nothing else in the repo answers this:
 * `variants-lint` replays the tv matrix and reports tokens stripped *within* a
 * chain, and a slot that never reaches markup resolves correctly and looks
 * healthy to it. The provider-cascade sweep sets one probe per declared slot
 * but asserts only that the *root* slot arrives; the rest of its census is a
 * number in a message.
 *
 * The oracle is the rendered markup, mounted through the component's own
 * public `slotClasses` prop — the same call the consumer writes. The question
 * is asked **per component**, never per config: see {@link Sweep}.
 *
 * **Reach: the components below, not the library.** Promoting the
 * provider-cascade census to an assertion was measured first and does not
 * work: its one default mount per component leaves more than half of all
 * declared slots unreached — 363 of 638 across 62 configs when this was
 * written — because most slots belong to a state that mount never enters (a
 * `label` prop, an error line, an open popover). A library-wide version needs a
 * per-component state matrix; the components below carry one.
 */

/**
 * Probe-class prefix. Matched as a whole class name against the slots below,
 * never by slicing the prefix off any class that happens to start with it: the
 * charts and the calendar render `sr-only` wrappers, and prefix-slicing read
 * that as a slot called `only` painted by five of the six components.
 */
const PROBE = 'slot-reach-';

interface Mount {
  /** What state this mount puts the component in — one line, it has to earn its place. */
  name: string;
  props: Record<string, unknown>;
  /** Run after mount, e.g. to open a hover/focus-gated element. */
  after?: (root: HTMLElement) => void;
}

/**
 * One sweep is one component, never a union over the components that share a
 * config: `chartVariants` is one config behind five charts, and a union only
 * catches a slot dead in all five. A slot `<LineChart>` offers and never paints
 * would hide behind the `arc` DonutChart does paint.
 */
interface Sweep {
  /** The public component under measurement. */
  name: string;
  component: unknown;
  /** The tv() config its slots come from. */
  config: string;
  /**
   * Every slot that config declares. The probe set, which is wider than
   * `slots` where a config feeds several components — so a slot painted
   * *outside* the component's own type shows up too.
   */
  configSlots: string[];
  /** The slots this component's `slotClasses` type offers. */
  slots: string[];
  /** States of this one component. */
  mounts: Mount[];
  /**
   * Slots this component reaches in no state, each with the reason in words.
   * An entry whose slot IS reached — or is no longer declared — is an error,
   * the contract `imports-lint` and the cascade sweep already carry.
   */
  unreached: Record<string, string>;
}

const REF = new Date(2026, 7, 12); // a Wednesday

const EVENTS = [
  {
    id: 'e1',
    title: 'Timed',
    description: 'With a description',
    helperText: 'and a helper line',
    start: new Date(2026, 7, 12, 9, 0),
    end: new Date(2026, 7, 12, 10, 30),
    allDay: false,
    categoryId: 'work'
  },
  {
    id: 'e2',
    title: 'All day',
    start: new Date(2026, 7, 12),
    end: new Date(2026, 7, 12),
    allDay: true,
    categoryId: 'home'
  },
  {
    id: 'e3',
    title: 'Multi day',
    start: new Date(2026, 7, 11),
    end: new Date(2026, 7, 14),
    allDay: true,
    categoryId: 'work'
  }
];

const CATEGORIES = [
  { id: 'work', label: 'Work', color: 'oklch(0.65 0.15 250)' },
  { id: 'home', label: 'Home', color: 'oklch(0.65 0.15 140)' }
];

/** Everything the calendar renders only when asked to. */
const CALENDAR_SHELL = {
  defaultDate: REF,
  events: EVENTS,
  categories: CATEGORIES,
  showLegend: true,
  showEventList: true,
  showWeekNumbers: true,
  showViewSwitcher: true,
  showMiniCalendar: true,
  animated: false
};

const CARTESIAN = {
  series: [{ label: 'A' }, { label: 'B' }],
  data: [
    { label: 'Jan', values: [1, 2] },
    { label: 'Feb', values: [3, 4] }
  ],
  showLegend: true,
  showGrid: true
};

const CHART_SLOTS = Object.keys(chartVariants.config.slots as Record<string, unknown>);
const CALENDAR_SLOTS = Object.keys(calendarVariants.config.slots as Record<string, unknown>);

const SWEEPS: Sweep[] = [
  {
    name: 'Calendar',
    component: Calendar,
    config: 'calendarVariants',
    configSlots: CALENDAR_SLOTS,
    slots: CALENDAR_SLOTS,
    mounts: [
      {
        name: 'month, a selected day with events, popover on focus',
        props: { ...CALENDAR_SHELL, view: 'month', value: REF, eventPopover: true },
        // The popover opens on focus (synchronously) as well as on hover after
        // a timer — focus is the one a mount can drive without a clock.
        after: (root) => root.querySelector<HTMLElement>('button[data-date="2026-08-12"]')?.focus()
      },
      { name: 'week', props: { ...CALENDAR_SHELL, view: 'week' } },
      {
        name: 'day, on today, with the hour grid spanning the whole day',
        // The now-line renders only for today and only while the current time
        // falls inside the grid's hours, so the grid is opened to all of them
        // rather than the test being pinned to a time of day.
        props: {
          ...CALENDAR_SHELL,
          view: 'day',
          defaultDate: new Date(),
          timeGridStartHour: 0,
          timeGridEndHour: 24
        }
      },
      { name: 'agenda', props: { ...CALENDAR_SHELL, view: 'agenda' } },
      { name: 'year', props: { ...CALENDAR_SHELL, view: 'year' } }
    ],
    unreached: {}
  },
  {
    name: 'BarChart',
    component: BarChart,
    config: 'chartVariants',
    configSlots: CHART_SLOTS,
    slots: [...BAR_CHART_SLOTS],
    mounts: [{ name: 'grouped bars with a legend and gridlines', props: CARTESIAN }],
    unreached: {}
  },
  {
    name: 'LineChart',
    component: LineChart,
    config: 'chartVariants',
    configSlots: CHART_SLOTS,
    slots: [...LINE_CHART_SLOTS],
    mounts: [{ name: 'two series with a legend and gridlines', props: CARTESIAN }],
    unreached: {}
  },
  {
    name: 'AreaChart',
    component: AreaChart,
    config: 'chartVariants',
    configSlots: CHART_SLOTS,
    slots: [...AREA_CHART_SLOTS],
    mounts: [{ name: 'two stacked areas with a legend and gridlines', props: CARTESIAN }],
    unreached: {}
  },
  {
    name: 'DonutChart',
    component: DonutChart,
    config: 'chartVariants',
    configSlots: CHART_SLOTS,
    slots: [...DONUT_CHART_SLOTS],
    mounts: [
      {
        name: 'two arcs with the centre total and a legend',
        props: {
          data: [
            { label: 'A', value: 1 },
            { label: 'B', value: 2 }
          ],
          showLegend: true,
          showTotal: true,
          totalLabel: 'Total'
        }
      }
    ],
    unreached: {}
  },
  {
    name: 'ChartFrame',
    component: ChartFrame,
    config: 'chartVariants',
    configSlots: CHART_SLOTS,
    // The frame is the `<figure>` + `<svg>` a consumer draws their own marks
    // into; every other slot belongs to a chart that draws itself.
    slots: [...CHART_FRAME_SLOTS],
    mounts: [{ name: 'an empty frame', props: {} }],
    unreached: {}
  }
];

/** Slot names whose probe class landed on at least one element. */
function landed(sweep: Sweep, entry: Mount): Set<string> {
  document.body.innerHTML = '';
  const target = document.createElement('div');
  document.body.appendChild(target);
  const app = mount(sweep.component as never, {
    target,
    props: {
      ...entry.props,
      slotClasses: Object.fromEntries(sweep.configSlots.map((slot) => [slot, `${PROBE}${slot}`]))
    }
  });
  flushSync();
  entry.after?.(target);
  flushSync();

  const bySlot = new Map(sweep.configSlots.map((slot) => [`${PROBE}${slot}`, slot]));
  const found = new Set<string>();
  for (const element of target.querySelectorAll('*')) {
    for (const token of element.classList) {
      const slot = bySlot.get(token);
      if (slot) found.add(slot);
    }
  }
  unmount(app);
  document.body.innerHTML = '';
  return found;
}

const measured = SWEEPS.map((sweep) => ({
  sweep,
  perMount: sweep.mounts.map((entry) => ({ entry, landed: landed(sweep, entry) }))
}));

/** Every slot a sweep reaches across its states. */
const reachedBy = new Map<string, Set<string>>(
  measured.map((m) => {
    const union = new Set<string>();
    for (const state of m.perMount) for (const slot of state.landed) union.add(slot);
    return [m.sweep.name, union];
  })
);

describe.each(measured.map((m) => [m.sweep.name, m] as const))('%s', (_name, measurement) => {
  const { sweep, perMount } = measurement;
  const union = reachedBy.get(sweep.name) as Set<string>;
  const excused = sweep.unreached;

  it('mounts every state it declares', () => {
    const empty = perMount.filter((m) => m.landed.size === 0).map((m) => m.entry.name);
    expect(
      empty,
      `these mounts render no slot at all — they measure nothing:\n  ${empty.join('\n  ')}`
    ).toEqual([]);
  });

  it('declares no slot that reaches no element', () => {
    const dead = sweep.slots.filter((slot) => !union.has(slot) && !(slot in excused));
    expect(
      dead,
      `${sweep.name} offers these slot names in its \`slotClasses\` type, and across the ` +
        `${perMount.length} state(s) above no element of it carries them. A consumer writing ` +
        'one into `slotClasses` gets a silent no-op. Either wire the slot to the element it ' +
        'names, drop it from the type, or — if the state it lives in cannot be mounted here — ' +
        `give it an \`unreached\` entry saying so:\n  ${dead.join('\n  ')}`
    ).toEqual([]);
  });

  it('paints no slot its own type withholds', () => {
    // The other direction, and it needs the *config's* slots as probes: a slot
    // a component paints but leaves out of its `slotClasses` type is an
    // override surface the consumer cannot reach at all — the projection in
    // `charts/slots.ts` taking one slot too few looks exactly like this.
    const withheld = [...union].filter((slot) => !sweep.slots.includes(slot));
    expect(
      withheld,
      `${sweep.name} paints these slots but its \`slotClasses\` type does not offer them, so ` +
        `no consumer can style them. Add them to the type:\n  ${withheld.join('\n  ')}`
    ).toEqual([]);
  });

  it('lists no excused slot that is reached after all', () => {
    const stale = Object.keys(excused).filter(
      (slot) => union.has(slot) || !sweep.slots.includes(slot)
    );
    expect(
      stale,
      '`unreached` entries that no longer hold — the slot is reached now, or is no longer ' +
        `declared. Delete them:\n  ${stale.join('\n  ')}`
    ).toEqual([]);
  });

  // Every mount here is a state of one component, so a state has to earn its
  // place: without this the matrix becomes where a dead slot hides — add enough
  // states and something eventually paints. A one-state sweep has nothing to
  // compare and is skipped rather than passing on an empty comparison.
  it.skipIf(perMount.length < 2)('needs every state it carries', () => {
    const redundant: string[] = [];
    for (const { entry, landed: reached } of perMount) {
      const others = new Set<string>();
      for (const other of perMount) {
        if (other.entry === entry) continue;
        for (const slot of other.landed) others.add(slot);
      }
      if ([...reached].every((slot) => others.has(slot))) redundant.push(entry.name);
    }
    expect(
      redundant,
      `states that reach no slot the other states do not — delete them:\n  ${redundant.join('\n  ')}`
    ).toEqual([]);
  });
});

describe('chartVariants', () => {
  // Projecting the shared config per chart moves a slot no chart paints out of
  // every component's reach, and the per-component sweeps above would then
  // never look at it again — the exact case #345 deleted `axisTick` for. So the
  // projections are also checked as a set, against the config they come from.
  it('is covered by the five charts it feeds', () => {
    const projected = new Set(
      SWEEPS.filter((s) => s.config === 'chartVariants').flatMap((s) => s.slots)
    );
    const orphans = CHART_SLOTS.filter((slot) => !projected.has(slot));
    expect(
      orphans,
      'slots `chartVariants` declares that no chart offers in its `slotClasses` type, so no ' +
        `consumer can reach them and no sweep above measures them. Delete them from the config, ` +
        `or add them to the chart that should paint them:\n  ${orphans.join('\n  ')}`
    ).toEqual([]);
  });
});
