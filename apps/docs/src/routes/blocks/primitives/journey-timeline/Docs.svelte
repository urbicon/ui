<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Badge,
    Button,
    JourneyTimeline,
    Kbd,
    type JourneyNode,
    type JourneyStatus
  } from '@urbicon-ui/blocks';

  // A utility-billing run — a retrospective chronicle with a time axis.
  const billing: JourneyNode[] = [
    {
      id: 'readings',
      title: 'Meter readings',
      status: 'complete',
      subtitle: 'All 48 units collected',
      meta: '3 Jun',
      segmentLabel: '2 days · validation'
    },
    {
      id: 'validate',
      title: 'Validation',
      status: 'complete',
      subtitle: '2 anomalies resolved',
      meta: '5 Jun',
      connector: 'dashed',
      segmentLabel: 'manual review'
    },
    {
      id: 'statements',
      title: 'Statements',
      status: 'active',
      subtitle: 'Generating 48 documents',
      meta: '6 Jun',
      segmentLabel: 'dispatch queue'
    },
    { id: 'dispatch', title: 'Dispatch', status: 'pending', subtitle: 'Email + postal' }
  ];
  // Confirmed dates rendered through the `meta` snippet (planned + actual).
  const actuals: Record<string, string> = { readings: '3 Jun', validate: '6 Jun' };
  let focusId = $state('statements');

  // Shipment tracking — the stable readout keeps the rail rigid.
  const shipment: JourneyNode[] = [
    { id: 'ordered', title: 'Ordered', status: 'complete', meta: 'Mon' },
    { id: 'packed', title: 'Packed', status: 'complete', meta: 'Tue' },
    {
      id: 'transit',
      title: 'In transit',
      status: 'active',
      meta: 'Wed',
      connector: 'dotted',
      segmentLabel: 'customs clearance'
    },
    { id: 'delivery', title: 'Out for delivery', status: 'pending' },
    { id: 'delivered', title: 'Delivered', status: 'pending' }
  ];

  // Invoice lifecycle — horizontal rail + shared panel.
  const lifecycle: JourneyNode[] = [
    { id: 'draft', title: 'Draft', status: 'complete', meta: '1 Mar' },
    { id: 'open', title: 'Open', status: 'active', meta: '5 Mar' },
    { id: 'due', title: 'Due', status: 'pending', meta: '19 Mar' },
    { id: 'paid', title: 'Paid', status: 'pending' }
  ];

  // Every status, plus a non-focusable waypoint.
  const statuses: JourneyNode[] = [
    { id: 's-complete', title: 'Complete', status: 'complete', subtitle: 'Finished' },
    { id: 's-active', title: 'Active', status: 'active', subtitle: 'In progress' },
    {
      id: 's-wait',
      title: 'Automatic hold',
      status: 'pending',
      subtitle: 'System step',
      focusable: false
    },
    { id: 's-pending', title: 'Pending', status: 'pending', subtitle: 'Not started' },
    { id: 's-attention', title: 'Attention', status: 'attention', subtitle: 'Optional, but look' },
    { id: 's-blocked', title: 'Blocked', status: 'blocked', subtitle: 'Missing data' },
    { id: 's-skipped', title: 'Skipped', status: 'skipped', subtitle: 'Not applicable' }
  ];

  // A billing cockpit — glyph markers, an attention row and trailing per row.
  const cockpit: JourneyNode[] = [
    { id: 'c-period', title: 'Billing period', status: 'complete', subtitle: 'Jan – Dec 2025' },
    {
      id: 'c-heating',
      title: 'Heating configuration',
      status: 'blocked',
      subtitle: 'Heat/water split missing'
    },
    {
      id: 'c-consumption',
      title: 'Consumption',
      status: 'pending',
      subtitle: 'Waits for heating',
      focusable: false
    },
    {
      id: 'c-expenses',
      title: 'Expenses & distribution',
      status: 'active',
      subtitle: 'No expenses recorded yet'
    },
    {
      id: 'c-advances',
      title: 'Advance payments',
      status: 'attention',
      subtitle: 'Needed for the tenant balance'
    }
  ];
  const glyphs: Record<JourneyStatus, string> = {
    complete: '✓',
    active: '▸',
    pending: '·',
    attention: '○',
    blocked: '▲',
    skipped: '—'
  };
  // Filled dots take the on-fill tone (light, like filled buttons); hollow ones
  // echo their border hue. `on-fill`, not `on-primary`: these dots sit on
  // success/danger grounds as well, and `on-primary` is scoped to the primary
  // fill so a theme can retune it alone.
  const glyphTone: Record<JourneyStatus, string> = {
    complete: 'text-text-on-fill',
    active: 'text-text-on-fill',
    pending: 'text-text-tertiary',
    attention: 'text-warning-emphasis',
    blocked: 'text-text-on-fill',
    skipped: 'text-text-tertiary'
  };
  let lastHelp = $state<string | undefined>(undefined);
</script>

<!-- ─── Examples ─── -->
<Section marker="02" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Vertical chronicle with inline detail"
      description="The default. Per-node meta renders on the chronicle rail (here through the meta snippet: planned date + confirmed Badge), connectors carry meaning (dashed = manual hop), segment labels annotate the stretch between nodes. The focused node becomes an elevated card in place."
      isolate
    >
      <div class="flex w-full max-w-lg flex-col gap-3">
        <div class="flex items-center gap-2">
          <span class="text-text-tertiary text-xs font-medium">Focused node:</span>
          <Badge size="xs" intent="primary" variant="soft">{focusId}</Badge>
        </div>
        <JourneyTimeline items={billing} bind:focusId>
          {#snippet meta(item)}
            <div class="flex flex-col items-end gap-1">
              {#if item.meta}
                <span class="text-text-tertiary font-mono text-xs tabular-nums">{item.meta}</span>
              {/if}
              {#if actuals[item.id]}
                <Badge size="xs" intent="success" variant="soft">{actuals[item.id]}</Badge>
              {/if}
            </div>
          {/snippet}
          {#snippet node(item)}
            <div class="flex flex-col gap-2 py-0.5">
              <p class="text-text-secondary text-sm">
                Full record for <strong>{item.title}</strong> — assignments, anomalies and the audit trail
                live here.
              </p>
              <div>
                <Button size="sm" variant="outlined">Open {item.title.toLowerCase()}</Button>
              </div>
            </div>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>

    <CodeExample
      title="Stable readout with detail=&quot;panel&quot;"
      description="The rail stays rigid — rows never change height. The focused node's detail renders in a panel beside the rail on wide viewports and docks to the viewport bottom on narrow ones. Pick this for long chronicles or when the detail is tall."
      isolate
    >
      <div class="w-full">
        <JourneyTimeline items={shipment} detail="panel">
          {#snippet node(item)}
            <div class="flex flex-col items-start gap-2">
              <p class="text-text-primary text-sm font-medium">{item.title}</p>
              <p class="text-text-secondary text-sm">
                Scans, carrier and location history for this stage.
              </p>
              {#if item.segmentLabel}
                <Badge size="xs" intent="neutral" variant="soft">{item.segmentLabel}</Badge>
              {/if}
            </div>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>

    <CodeExample
      title="Horizontal lifecycle"
      description="Horizontal always renders the shared panel below the rail — the same rail + readout model, rotated. Meta renders as a kicker line above each title."
      isolate
    >
      <div class="w-full">
        <JourneyTimeline items={lifecycle} orientation="horizontal">
          {#snippet node(item)}
            <p class="text-text-secondary text-sm">
              Invoice events during “{item.title}” — issued, reminders, payments.
            </p>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>

    <CodeExample
      title="Cockpit rows: glyph markers, attention + trailing"
      description="The rich-row recipe: the marker snippet puts glyphs inside the status dots (scaled up via slotClasses.marker), status attention flags the optional-but-noteworthy row, and the trailing snippet adds badges and a help action per row. Trailing renders outside the trigger button — pressing “?” never moves the focus."
      isolate
    >
      <div class="flex w-full max-w-lg flex-col gap-3">
        <p class="text-text-tertiary text-xs" aria-live="polite">
          {lastHelp ? `Help requested for “${lastHelp}”.` : 'No help requested yet.'}
        </p>
        <JourneyTimeline
          items={cockpit}
          slotClasses={{ marker: 'size-5 mt-1.5', markerColumn: 'w-5' }}
        >
          {#snippet marker(item)}
            <span class={['text-2xs leading-none font-bold', glyphTone[item.status]]}>
              {glyphs[item.status]}
            </span>
          {/snippet}
          {#snippet trailing(item)}
            {#if item.status === 'blocked'}
              <Badge size="xs" intent="danger" variant="soft">must · blocks close</Badge>
            {:else if item.status === 'attention'}
              <Badge size="xs" intent="warning" variant="soft">optional</Badge>
            {/if}
            {#if item.focusable !== false}
              <Button size="xs" variant="ghost" onclick={() => (lastHelp = item.title)}>?</Button>
            {/if}
          {/snippet}
          {#snippet node(item)}
            <p class="text-text-secondary text-sm">
              Why “{item.title}” matters, its consequences and the next action live here.
            </p>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Statuses ─── -->
<Section marker="03" id="statuses" title="Statuses">
  <div class="space-y-4">
    <p class="text-text-secondary text-sm">
      Each node's <code>status</code> maps to a semantic dot: <strong>complete</strong> (success,
      filled), <strong>active</strong> (primary, ringed), <strong>pending</strong> (hollow),
      <strong>attention</strong> (hollow on the warning token — worth a look, does not block),
      <strong>blocked</strong> (danger — the title turns danger too, so colour is never the only
      cue) and <strong>skipped</strong> (muted). The connector leaving a completed node reads as
      “travelled”. Set <code>focusable: false</code> for pure waypoints — they render a marker and label
      but never take focus and are skipped by keyboard navigation.
    </p>
    <CodeExample
      title="All statuses"
      description="A node per status, including a non-focusable automatic step."
      isolate
    >
      <div class="w-full max-w-lg">
        <JourneyTimeline items={statuses} defaultFocusId="s-active">
          {#snippet node(item)}
            <p class="text-text-secondary text-sm">
              This node is <code>{item.status}</code> — its detail renders only while focused.
            </p>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── When to use ─── -->
<Section marker="04" id="when-to-use" title="JourneyTimeline vs. Stepper vs. Tab">
  <div class="space-y-4">
    <p class="text-text-secondary text-sm">
      Three components, three different jobs — the overlap is smaller than it looks:
    </p>
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="border-border-subtle rounded-lg border p-4">
        <p class="text-text-primary text-sm font-semibold">JourneyTimeline</p>
        <p class="text-text-secondary mt-2 text-sm">
          <strong>Retrospective observation.</strong> An ordered record of what happened / where
          things stand: shipment tracking, audit trails, billing runs, travel logs. Time (<code
            >meta</code
          >) is the first axis; connectors and segment labels describe the stretches between events.
          Focus reveals detail — it never advances a process.
        </p>
      </div>
      <div class="border-border-subtle rounded-lg border p-4">
        <p class="text-text-primary text-sm font-semibold">Stepper</p>
        <p class="text-text-secondary mt-2 text-sm">
          <strong>Prospective process.</strong> A wizard the user walks through: checkout, onboarding,
          multi-step forms. Steps are tasks to complete (often with embedded inputs), progress moves forward,
          and the component may gate navigation. No time axis — the user is the timeline.
        </p>
      </div>
      <div class="border-border-subtle rounded-lg border p-4">
        <p class="text-text-primary text-sm font-semibold">Tab</p>
        <p class="text-text-secondary mt-2 text-sm">
          <strong>Peer views.</strong> Unordered, equivalent surfaces of one thing — Account / Billing
          / Team. No sequence, no status, no chronology. If reordering the items would change their meaning,
          they are not tabs.
        </p>
      </div>
    </div>
    <p class="text-text-secondary text-sm">
      Rule of thumb: does each item carry a <em>status</em> and does their
      <em>order tell a story</em>? JourneyTimeline. Does the user <em>complete</em> the items one by
      one? Stepper. Are the items just <em>alternative views</em>? Tab.
    </p>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker="05" id="customization" title="Customization">
  <div class="space-y-4">
    <p class="text-text-secondary text-sm">
      Every family member supports <code>unstyled</code>, <code>slotClasses</code> and
      <code>preset</code>. Slots: <code>base</code>, <code>rail</code>, <code>node</code>,
      <code>metaColumn</code>, <code>meta</code>, <code>markerColumn</code>, <code>marker</code>,
      <code>connector</code>, <code>content</code>, <code>card</code>, <code>header</code>,
      <code>trigger</code>, <code>trailing</code>, <code>labelGroup</code>, <code>title</code>,
      <code>subtitle</code>, <code>segment</code>, <code>detail</code>, <code>detailInner</code>,
      <code>detailContent</code> and <code>panel</code>.
    </p>
    <CodeExample
      title="Restyle markers and the docked panel"
      code={`<JourneyTimeline
  items={stages}
  detail="panel"
  slotClasses={{
    marker: 'ring-2 ring-offset-2 ring-primary/20',
    panel: 'sm:top-20'  /* clear a fixed page header */
  }}
>
  {#snippet node(item)}…{/snippet}
</JourneyTimeline>`}
      language="svelte"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker="06" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Structure and ARIA">
      <p>
        The rail is an ordered list. Each node carries
        <code class="text-text-primary">aria-current="step"</code> while its status is
        <code class="text-text-primary">active</code>; the focusable trigger exposes
        <code class="text-text-primary">aria-expanded</code> and
        <code class="text-text-primary">aria-controls</code> for its detail region (a per-node
        inline region, or the shared panel in panel/horizontal mode). The status is announced
        through a visually-hidden label, so the dot markers stay decorative — including any glyphs
        rendered through the <code class="text-text-primary">marker</code> snippet.
      </p>
    </Note>
    <Note title="Trailing content stays outside the trigger">
      <p>
        <code class="text-text-primary">trailing</code> content renders <em>outside</em> the trigger button,
        as a sibling in the header row: buttons and links inside it are valid HTML, become regular tab
        stops after the header, and activating them never changes the focused node. Arrow-key roving stays
        on the node headers only.
      </p>
    </Note>
    <Note title="Keyboard">
      <ul class="space-y-1">
        <li>
          <Kbd keys="↑" /> / <Kbd keys="↓" /> (vertical) or <Kbd keys="←" /> / <Kbd keys="→" /> (horizontal)
          move the roving focus between node headers without changing the focused node.
        </li>
        <li><Kbd keys="Home" /> / <Kbd keys="End" /> jump to the first / last focusable node.</li>
        <li><Kbd keys="Enter" /> / <Kbd keys="Space" /> put the header's node in focus.</li>
      </ul>
    </Note>
    <Note title="Motion">
      <p>
        Expand/collapse runs on the motion-duration tokens, which collapse to 1&nbsp;ms under
        <code class="text-text-primary">prefers-reduced-motion: reduce</code>. When activating a
        node makes another card collapse above it, the component counter-scrolls so the activated
        header stays visually stationary — real user scrolling cancels this immediately.
      </p>
    </Note>
  </NoteList>
</Section>
