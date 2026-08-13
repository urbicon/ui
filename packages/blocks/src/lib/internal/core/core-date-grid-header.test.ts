/**
 * The shared date-surface toolbar, asserted on both callers (#191).
 *
 * `CoreDateGridHeader` replaced 35 lines of markup that Planner and
 * ResourceTimeline each carried — a behaviour-parity refactor over two bars that
 * had no test at all: neither surface's suite asserted an aria-label, the
 * today-button hint or the bound gating, while Calendar's equivalents did. That
 * is the gap this file closes; the core has no test of its own because it renders
 * nothing without a surface's context.
 *
 * SSR-rendered (`svelte/server`), so it stays in the fast node environment: the
 * labels and the `disabled` attributes are all in the first paint. Bounds are
 * fixed dates, never the wall clock, and the i18n bundle resolves to English
 * without a provider — which is what makes the label assertions readable.
 */

import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Planner from '$lib/components/Planner/Planner.svelte';
import ResourceTimeline from '$lib/components/ResourceTimeline/ResourceTimeline.svelte';
import en from '$lib/translations/en';

/** Mon 15 Jun 2026 — inside the week both surfaces open on below. */
const ANCHOR = new Date(2026, 5, 15);

/**
 * Whether the button carrying `label` is rendered disabled. Matched as an
 * ATTRIBUTE: the core's class string carries `disabled:opacity-50`, and SSR
 * writes the boolean as `disabled=""`.
 */
function isDisabled(body: string, label: string): boolean {
  const hit = body.indexOf(`aria-label="${label}"`);
  expect(hit, `no control labelled "${label}"`).toBeGreaterThan(-1);
  const open = body.lastIndexOf('<button', hit);
  expect(open).toBeGreaterThan(-1);
  return /\sdisabled(?=[\s>=])/.test(body.slice(open, body.indexOf('>', hit)));
}

const surfaces = [
  {
    name: 'Planner',
    keys: en.planner,
    render: (props: Record<string, unknown>) =>
      render(Planner, {
        props: {
          view: 'week',
          locale: 'en-GB',
          value: ANCHOR,
          getDate: () => ANCHOR,
          ...props
        }
      }).body
  },
  {
    name: 'ResourceTimeline',
    keys: en.resourceTimeline,
    render: (props: Record<string, unknown>) =>
      render(ResourceTimeline, {
        props: {
          view: 'week',
          locale: 'en-GB',
          value: ANCHOR,
          resources: [{ id: 'r1', label: 'Room 01' }],
          getResourceId: () => 'r1',
          getRange: () => ({ start: ANCHOR, end: ANCHOR }),
          ...props
        }
      }).body
  }
] as const;

for (const surface of surfaces) {
  describe(`${surface.name} toolbar`, () => {
    it('names all three controls', () => {
      const body = surface.render({});
      expect(body).toContain(`aria-label="${surface.keys.previousWeek}"`);
      expect(body).toContain(`aria-label="${surface.keys.nextWeek}"`);
      expect(body).toContain(`aria-label="${surface.keys.today}"`);
      // The hint on the today button is the one thing the core kept from both
      // predecessors that is not an aria attribute — a Tooltip, i.e. the single
      // allowlisted edge out of internal/core.
      expect(body).toContain(surface.keys.today);
    });

    it('disables the arrow that would leave [minDate, maxDate]', () => {
      const body = surface.render({
        minDate: new Date(2026, 5, 15),
        maxDate: new Date(2026, 5, 21)
      });
      expect(isDisabled(body, surface.keys.previousWeek)).toBe(true);
      expect(isDisabled(body, surface.keys.nextWeek)).toBe(true);
    });

    it('leaves both arrows open without bounds', () => {
      // The negative half: without it the assertions above would hold for a
      // toolbar that renders every button disabled.
      const body = surface.render({});
      expect(isDisabled(body, surface.keys.previousWeek)).toBe(false);
      expect(isDisabled(body, surface.keys.nextWeek)).toBe(false);
    });

    it('disables every control when the surface is disabled', () => {
      const body = surface.render({ disabled: true });
      expect(isDisabled(body, surface.keys.previousWeek)).toBe(true);
      expect(isDisabled(body, surface.keys.nextWeek)).toBe(true);
      expect(isDisabled(body, surface.keys.today)).toBe(true);
    });

    it('takes its look from the surface, not from the core', () => {
      // The split the core is built on: behaviour here, look at the call site.
      // `slotClasses` reaches the toolbar through the surface's own tv() slots,
      // so an override lands on the rendered bar.
      const body = surface.render({ slotClasses: { navButton: 'ring-marker-42' } });
      expect(body).toContain('ring-marker-42');
    });
  });
}
