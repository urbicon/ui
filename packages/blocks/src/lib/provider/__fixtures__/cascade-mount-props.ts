/**
 * The one hand-written part of the provider-cascade sweep: what a component
 * needs before it renders anything at all.
 *
 * Everything else in the sweep is read out of the code — who is exported, who
 * carries a provider name, which slots exist, which condition object is passed
 * with which values. This file cannot be: a required `data`/`items`/`message`
 * prop has a domain shape no type can synthesise a *valid* instance of, and a
 * compound child throws without a parent that only its own family can supply.
 *
 * Two rules keep it from growing into a second registry:
 *
 * - an entry carries the minimum that makes the component render, never a
 *   variant choice — the sweep measures the component's own defaults;
 * - an entry that is no longer needed is an error: the sweep re-measures every
 *   component without its entry and demands a different answer, exactly the
 *   contract `imports-lint` puts on its own allowlist.
 */

import { createRawSnippet } from 'svelte';

/** Parent families `CascadeCompoundHost.svelte` can mount a child inside. */
export type CompoundFamily =
  | 'accordion'
  | 'radioGroup'
  | 'segmentGroup'
  | 'stepper'
  | 'tabStrip'
  | 'tabPanels'
  | 'guide'
  | 'guidePanel'
  | 'calendar';

export interface MountFixture {
  /** Mount the component inside this parent family instead of on its own. */
  family?: CompoundFamily;
  /** Props without which the component throws, renders nothing, or measures differently. */
  props?: Record<string, unknown>;
}

/** Stand-in for a required content snippet. */
const TEXT_SNIPPET = createRawSnippet(() => ({ render: () => '<span>pane</span>' }));

const CARTESIAN = {
  series: [{ label: 'Series A' }],
  data: [
    { label: 'Jan', values: [1] },
    { label: 'Feb', values: [2] }
  ]
};

export const MOUNT_FIXTURES: Record<string, MountFixture> = {
  // ── required domain data ──────────────────────────────────────────────
  AreaChart: { props: CARTESIAN },
  BarChart: { props: CARTESIAN },
  LineChart: { props: CARTESIAN },
  DonutChart: {
    props: {
      data: [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 }
      ]
    }
  },
  Breadcrumb: { props: { items: [{ label: 'Home', href: '/' }, { label: 'Here' }] } },
  ChatMessage: {
    props: { message: { id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] } }
  },
  ChatMessageList: {
    props: { messages: [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }] }
  },
  CitationChip: { props: { source: { id: 's1', title: 'Source' }, index: 1 } },
  CommandPalette: { props: { open: true, items: [{ id: 'new', label: 'New File' }] } },
  CompositionBar: {
    props: {
      items: [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 }
      ]
    }
  },
  JourneyTimeline: {
    props: {
      items: [
        { id: 'a', title: 'First', status: 'complete' },
        { id: 'b', title: 'Second', status: 'active' }
      ]
    }
  },
  ReasoningDisclosure: { props: { reasoning: { type: 'reasoning', text: 'why', durationMs: 12 } } },
  Sankey: {
    props: {
      nodes: [{ id: 'a' }, { id: 'b' }],
      links: [{ source: 'a', target: 'b', value: 1 }]
    }
  },
  Sparkline: { props: { data: [1, 4, 2, 8, 5] } },
  SplitPane: { props: { start: TEXT_SNIPPET, end: TEXT_SNIPPET } },
  StreamingMarkdown: { props: { content: 'hello' } },
  ToolCallCard: {
    props: { toolCall: { type: 'tool-call', id: 't1', name: 'lookup', state: 'complete' } }
  },

  // ── renders nothing until it is open ──────────────────────────────────
  Dialog: { props: { open: true } },
  Drawer: { props: { open: true } },

  // ── compound children: no parent, no context, no render ───────────────
  CalendarHeader: { family: 'calendar' },
  AccordionItem: { family: 'accordion', props: { value: 'a', title: 'A' } },
  RadioItem: { family: 'radioGroup', props: { value: 'a', label: 'A' } },
  SegmentItem: { family: 'segmentGroup', props: { value: 'a' } },
  StepperStep: { family: 'stepper', props: { label: 'Step' } },
  TabItem: { family: 'tabStrip', props: { value: 'a' } },
  TabPanel: { family: 'tabPanels', props: { value: 'a' } },

  // ── Guide: every part reads the tour controller from GuideProvider ────
  Guide: { family: 'guide' },
  GuideBeacon: { family: 'guide', props: { tour: { id: 'onboarding', steps: [] } } },
  GuideHint: { family: 'guide', props: { for: 'save', open: true, title: 'Hint' } },
  GuideMarker: { family: 'guide', props: { for: 'save' } },
  GuideMention: { family: 'guide', props: { for: 'save' } },
  GuidePanel: { family: 'guide', props: { title: 'Panel' } },
  GuideRef: { family: 'guidePanel', props: { article: 'cascade-article' } }
};
