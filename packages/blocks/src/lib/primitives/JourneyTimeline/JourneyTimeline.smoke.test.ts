/**
 * SSR smoke render for JourneyTimeline. The vitest env is `node`, so these can't
 * exercise click/keyboard interaction — but they pin the render-time contract:
 * default focus resolution, the "exactly one node in focus" rule, status →
 * sr-only label mapping, aria wiring, the meta rail, segment labels, and the
 * inline/panel/horizontal layout split.
 */

import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import type { JourneyNode } from './index';
import JourneyTimeline from './JourneyTimeline.svelte';

const stages: JourneyNode[] = [
  {
    id: 'draft',
    title: 'Draft stage',
    status: 'complete',
    subtitle: 'Done Monday',
    meta: '06:12',
    segmentLabel: '2 days · handover'
  },
  {
    id: 'review',
    title: 'Review stage',
    status: 'active',
    subtitle: 'Underway',
    meta: '08:15',
    connector: 'dashed'
  },
  { id: 'wait', title: 'Waiting room', status: 'pending', focusable: false },
  { id: 'approve', title: 'Approval stage', status: 'pending' },
  { id: 'blocked', title: 'Blocked stage', status: 'blocked' },
  {
    id: 'skipped',
    title: 'Skipped stage',
    status: 'skipped',
    segmentLabel: 'NEVER-RENDERED (last node)'
  }
];

// Plain nodes without meta — the chronicle rail must stay off.
const plain: JourneyNode[] = [
  { id: 'a', title: 'Alpha', status: 'complete' },
  { id: 'b', title: 'Beta', status: 'active' }
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

  it('focuses exactly the first active node by default', () => {
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

  it('renders the chronicle meta rail as soon as any node carries meta', () => {
    const withMeta = render(JourneyTimeline, { props: { items: stages, node: detail } }).body;
    expect(withMeta).toContain('06:12');
    expect(withMeta).toContain('08:15');
    expect(withMeta).toContain('grid-cols-[auto_auto_minmax(0,1fr)]');

    const withoutMeta = render(JourneyTimeline, { props: { items: plain, node: detail } }).body;
    expect(withoutMeta).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(withoutMeta).not.toContain('grid-cols-[auto_auto_minmax(0,1fr)]');
  });

  it('labels segments between nodes but never after the last node', () => {
    const { body } = render(JourneyTimeline, { props: { items: stages, node: detail } });
    expect(body).toContain('2 days · handover');
    expect(body).not.toContain('NEVER-RENDERED');
    expect(count(body, 'data-journey-segment')).toBe(1);
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

  it('renders a single stable readout for detail="panel" (no inline regions)', () => {
    const { body } = render(JourneyTimeline, {
      props: { items: stages, node: detail, detail: 'panel' }
    });
    expect(body).toContain('data-detail="panel"');
    expect(body).toContain('data-journey-panel');
    expect(body).toContain('DETAIL:review');
    expect(count(body, 'DETAIL:')).toBe(1);
    // Inline collapse regions must not exist in panel mode.
    expect(body).not.toContain('data-journey-detail');
  });

  it('renders the shared panel in horizontal orientation', () => {
    const { body } = render(JourneyTimeline, {
      props: { items: stages, node: detail, orientation: 'horizontal' }
    });
    expect(body).toContain('data-orientation="horizontal"');
    expect(body).toContain('data-journey-panel');
    expect(body).toContain('DETAIL:review');
    expect(count(body, 'DETAIL:')).toBe(1);
  });

  describe('horizontal spine', () => {
    it('keeps the DOM order trigger → spine so segments announce after their node', () => {
      const { body } = render(JourneyTimeline, {
        props: { items: stages, node: detail, orientation: 'horizontal' }
      });
      expect(body.indexOf('data-journey-trigger')).toBeLessThan(
        body.indexOf('data-journey-marker')
      );
      // Vertical keeps the spine before the trigger (DOM order = visual order).
      const vertical = render(JourneyTimeline, { props: { items: stages, node: detail } }).body;
      expect(vertical.indexOf('data-journey-marker')).toBeLessThan(
        vertical.indexOf('data-journey-trigger')
      );
    });

    it('splits the line around a segment label (line — label — line)', () => {
      const { body } = render(JourneyTimeline, {
        props: { items: stages, node: detail, orientation: 'horizontal' }
      });
      // 5 gaps between 6 nodes + 1 extra half-line for the labelled segment.
      expect(count(body, 'data-journey-connector')).toBe(6);
      expect(count(body, 'data-journey-segment')).toBe(1);
    });

    it('pads missing meta with an equal-height placeholder so stations align', () => {
      const { body } = render(JourneyTimeline, {
        props: { items: stages, node: detail, orientation: 'horizontal' }
      });
      // 6 nodes, 2 carry meta → 4 placeholders on the chronicle row.
      expect(count(body, /\u00a0/g)).toBe(4);

      const noRail = render(JourneyTimeline, {
        props: { items: plain, node: detail, orientation: 'horizontal' }
      }).body;
      expect(count(noRail, /\u00a0/g)).toBe(0);
    });
  });

  it('ignores detail="inline" for horizontal orientation (always the panel)', () => {
    const { body } = render(JourneyTimeline, {
      props: { items: stages, node: detail, orientation: 'horizontal', detail: 'inline' }
    });
    expect(body).toContain('data-detail="panel"');
    expect(body).toContain('data-journey-panel');
    expect(body).not.toContain('data-journey-detail');
  });

  describe('rich rows (marker / trailing / attention)', () => {
    const glyph = createRawSnippet<[JourneyNode]>((item) => ({
      render: () => `<b>MK:${item().id}</b>`
    }));
    const badge = createRawSnippet<[JourneyNode]>((item) => ({
      render: () => `<em>TR:${item().id}</em>`
    }));

    it('renders marker snippet content inside every (still decorative) dot', () => {
      const { body } = render(JourneyTimeline, {
        props: { items: stages, node: detail, marker: glyph }
      });
      expect(count(body, 'MK:')).toBe(stages.length);
      // Glyphs live inside the aria-hidden marker span, never in the button.
      for (const chunk of body.split('<button').slice(1)) {
        expect(chunk.split('</button>')[0]).not.toContain('MK:');
      }
    });

    it('renders trailing content for every row, outside the trigger button', () => {
      const { body } = render(JourneyTimeline, {
        props: { items: stages, node: detail, trailing: badge }
      });
      // Every row gets its trailing area — including pure waypoints.
      expect(count(body, 'TR:')).toBe(stages.length);
      expect(body).toContain('TR:wait');
      expect(count(body, 'data-journey-trailing')).toBe(stages.length);
      // Never nested inside the interactive trigger (valid HTML for buttons
      // and links in trailing content).
      for (const chunk of body.split('<button').slice(1)) {
        expect(chunk.split('</button>')[0]).not.toContain('TR:');
      }
    });

    it('announces the attention status through the sr-only label', () => {
      const { body } = render(JourneyTimeline, {
        props: {
          items: [
            { id: 'adv', title: 'Advance payments', status: 'attention' } satisfies JourneyNode
          ],
          node: detail
        }
      });
      expect(body).toContain('Needs attention');
    });
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
    expect(count(body, 'data-journey-node=')).toBe(0);
  });
});
