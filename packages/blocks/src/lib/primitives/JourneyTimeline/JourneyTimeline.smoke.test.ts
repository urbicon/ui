/**
 * SSR smoke render for JourneyTimeline. The vitest env is `node`, so these can't
 * exercise click/keyboard/scroll interaction — but they pin the render-time
 * contract: the default focus resolution, the "exactly one node expanded" rule,
 * status → sr-only label mapping, aria wiring, and the vertical/horizontal split.
 */

import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { JourneyNode } from './index';
import JourneyTimeline from './JourneyTimeline.svelte';

const stages: JourneyNode[] = [
  { id: 'draft', title: 'Draft stage', status: 'complete', subtitle: 'Done Monday' },
  { id: 'review', title: 'Review stage', status: 'active', subtitle: 'Underway' },
  { id: 'wait', title: 'Waiting room', status: 'pending', focusable: false },
  { id: 'approve', title: 'Approval stage', status: 'pending' },
  { id: 'blocked', title: 'Blocked stage', status: 'blocked' },
  { id: 'skipped', title: 'Skipped stage', status: 'skipped' }
];

// A node snippet that stamps the node id so we can assert *which* detail rendered.
const detail = createRawSnippet<[JourneyNode]>((item) => ({
  render: () => `<p>DETAIL:${item().id}</p>`
}));

const count = (html: string, needle: string | RegExp) =>
  html.match(typeof needle === 'string' ? new RegExp(needle, 'g') : needle)?.length ?? 0;

describe('JourneyTimeline (SSR)', () => {
  it('renders every node title and subtitle', () => {
    const { body } = render(JourneyTimeline, { props: { items: stages, node: detail } });
    for (const title of [
      'Draft stage',
      'Review stage',
      'Waiting room',
      'Approval stage',
      'Blocked stage',
      'Skipped stage'
    ]) {
      expect(body).toContain(title);
    }
    expect(body).toContain('Done Monday');
    expect(body).toContain('Underway');
  });

  it('expands exactly the first active node by default', () => {
    const { body } = render(JourneyTimeline, { props: { items: stages, node: detail } });
    // Only the focused node's detail snippet is in the DOM.
    expect(body).toContain('DETAIL:review');
    expect(body).not.toContain('DETAIL:draft');
    expect(body).not.toContain('DETAIL:approve');
    // Exactly one expanded trigger.
    expect(count(body, 'aria-expanded="true"')).toBe(1);
  });

  it('marks only the active-status node as the current step', () => {
    const { body } = render(JourneyTimeline, { props: { items: stages, node: detail } });
    expect(count(body, 'aria-current="step"')).toBe(1);
  });

  it('exposes an sr-only status label for every status', () => {
    const { body } = render(JourneyTimeline, { props: { items: stages, node: detail } });
    for (const label of ['Completed', 'In progress', 'Pending', 'Blocked', 'Skipped']) {
      expect(body).toContain(label);
    }
  });

  it('renders pure waypoints without an interactive trigger', () => {
    const { body } = render(JourneyTimeline, { props: { items: stages, node: detail } });
    // 6 nodes, one focusable:false → 5 interactive triggers.
    expect(count(body, 'data-journey-trigger')).toBe(5);
    // …but the waypoint still shows its label.
    expect(body).toContain('Waiting room');
  });

  it('honours an explicit defaultFocusId', () => {
    const { body } = render(JourneyTimeline, {
      props: { items: stages, node: detail, defaultFocusId: 'approve' }
    });
    expect(body).toContain('DETAIL:approve');
    expect(body).not.toContain('DETAIL:review');
  });

  it('honours a controlled focusId (including a completed node)', () => {
    const { body } = render(JourneyTimeline, {
      props: { items: stages, node: detail, focusId: 'draft' }
    });
    expect(body).toContain('DETAIL:draft');
    expect(body).not.toContain('DETAIL:review');
  });

  it('renders the shared panel (not inline regions) in horizontal orientation', () => {
    const { body } = render(JourneyTimeline, {
      props: { items: stages, node: detail, orientation: 'horizontal' }
    });
    expect(body).toContain('data-orientation="horizontal"');
    expect(body).toContain('DETAIL:review');
    // The horizontal detail lives in a single panel, so only one region carries a detail.
    expect(count(body, 'DETAIL:')).toBe(1);
  });

  it('does not advertise expandability when no node snippet is supplied', () => {
    const { body } = render(JourneyTimeline, { props: { items: stages } });
    expect(body).not.toContain('aria-expanded');
    expect(body).not.toContain('DETAIL:');
    // The rail + markers still render.
    expect(body).toContain('Review stage');
  });

  it('renders nothing catastrophic for an empty item list', () => {
    const { body } = render(JourneyTimeline, { props: { items: [], node: detail } });
    expect(body).toContain('data-orientation="vertical"');
    // `data-journey-node=` matches the real node attribute, not the base class's
    // `[&_[data-journey-node]:last-child…]` selector token.
    expect(count(body, 'data-journey-node=')).toBe(0);
  });
});
