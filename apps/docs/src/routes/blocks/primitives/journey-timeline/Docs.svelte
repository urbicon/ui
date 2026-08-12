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
  import { resolve } from '$app/paths';

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

  // A document-approval flow — the Customization restyle subject.
  const approval: JourneyNode[] = [
    { id: 'submitted', title: 'Submitted', status: 'complete' },
    { id: 'review', title: 'In review', status: 'active' },
    { id: 'revise', title: 'Revisions', status: 'attention', subtitle: 'Two comments to address' },
    { id: 'approved', title: 'Approved', status: 'pending' },
    { id: 'published', title: 'Published', status: 'pending' }
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
<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Each node needs an <code class="text-text-primary">id</code>, a
    <code class="text-text-primary">title</code> and a
    <code class="text-text-primary">status</code>.
    <code class="text-text-primary">subtitle</code>,
    <code class="text-text-primary">meta</code> (its label on the time axis),
    <code class="text-text-primary">connector</code> and
    <code class="text-text-primary">segmentLabel</code> are optional. One focusable node holds focus
    at a time and renders its detail through the <code class="text-text-primary">node</code>
    snippet, starting at <code class="text-text-primary">defaultFocusId</code> or the first
    <code class="text-text-primary">active</code> node and readable or drivable with
    <code class="text-text-primary">bind:focusId</code>.
  </p>

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
                Full record for <strong>{item.title}</strong>: assignments, anomalies and the audit
                trail live here.
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
      title="Stable readout with detail=panel"
      description="The rail stays rigid: rows never change height. The focused node's detail renders in a panel beside the rail on wide viewports and docks to the viewport bottom on narrow ones. Reach for this on long chronicles, or when the detail is tall."
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
      description="Horizontal always renders the shared panel below the rail: the same rail and readout model, rotated. Meta renders as a kicker line above each title."
      isolate
    >
      <div class="w-full">
        <JourneyTimeline items={lifecycle} orientation="horizontal">
          {#snippet node(item)}
            <p class="text-text-secondary text-sm">
              Invoice events during “{item.title}”: issued, reminders, payments.
            </p>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>

    <CodeExample
      title="Cockpit rows: glyph markers, attention and trailing"
      description="The rich-row recipe: the marker snippet puts glyphs inside the status dots (scaled up via slotClasses.marker), status attention flags the optional-but-noteworthy row, and the trailing snippet adds badges and a help action per row. Trailing renders outside the trigger button, so pressing the help button never moves the focus."
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
<Section marker id="statuses" title="Statuses">
  <div class="space-y-4">
    <p class="text-text-secondary text-sm">
      Each node's <code>status</code> sets its marker and its title tone:
    </p>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-text-primary border-border-subtle border-b">
          <tr>
            <th class="py-2 pr-4 font-semibold"><code class="text-text-primary">status</code></th>
            <th class="py-2 pr-4 font-semibold">Marker</th>
            <th class="py-2 font-semibold">Meaning</th>
          </tr>
        </thead>
        <tbody class="text-text-secondary divide-border-subtle divide-y">
          <tr>
            <td class="py-3 pr-4 align-top"><code class="text-text-primary">complete</code></td>
            <td class="py-3 pr-4 align-top">Filled success dot</td>
            <td class="py-3 align-top">Done. The connector leaving it reads as “travelled”.</td>
          </tr>
          <tr>
            <td class="py-3 pr-4 align-top"><code class="text-text-primary">active</code></td>
            <td class="py-3 pr-4 align-top">Ringed primary dot</td>
            <td class="py-3 align-top">The step in progress right now.</td>
          </tr>
          <tr>
            <td class="py-3 pr-4 align-top"><code class="text-text-primary">pending</code></td>
            <td class="py-3 pr-4 align-top">Hollow dot</td>
            <td class="py-3 align-top">Work not yet started.</td>
          </tr>
          <tr>
            <td class="py-3 pr-4 align-top"><code class="text-text-primary">attention</code></td>
            <td class="py-3 pr-4 align-top">Hollow warning dot</td>
            <td class="py-3 align-top">Worth a look, but it does not block.</td>
          </tr>
          <tr>
            <td class="py-3 pr-4 align-top"><code class="text-text-primary">blocked</code></td>
            <td class="py-3 pr-4 align-top">Danger dot, and the title turns danger too</td>
            <td class="py-3 align-top">A hard stop, so colour is never the only cue.</td>
          </tr>
          <tr>
            <td class="py-3 pr-4 align-top"><code class="text-text-primary">skipped</code></td>
            <td class="py-3 pr-4 align-top">Muted dot</td>
            <td class="py-3 align-top">Not applicable to this run.</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-text-secondary text-sm">
      Set <code>focusable: false</code> for pure waypoints: they render a marker and label but never take
      focus and are skipped by keyboard navigation.
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
              This node is <code>{item.status}</code>. Its detail renders only while focused.
            </p>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── When to use ─── -->
<Section marker id="when-to-use" title="JourneyTimeline vs. Stepper vs. Tab">
  <div class="space-y-4">
    <p class="text-text-secondary text-sm">
      Three components, three different jobs, and the overlap is smaller than it looks:
    </p>
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="text-text-primary border-border-subtle border-b">
          <tr>
            <th class="py-2 pr-4 font-semibold">Component</th>
            <th class="py-2 pr-4 font-semibold">Its job</th>
            <th class="py-2 font-semibold">Reach for it when</th>
          </tr>
        </thead>
        <tbody class="text-text-secondary divide-border-subtle divide-y">
          <tr>
            <td class="text-text-primary py-3 pr-4 align-top font-semibold">JourneyTimeline</td>
            <td class="py-3 pr-4 align-top">Retrospective observation</td>
            <td class="py-3 align-top">
              An ordered record of what happened or where things stand: shipment tracking, audit
              trails, billing runs, travel logs. Time (<code class="text-text-primary">meta</code>)
              is the first axis, and connectors and segment labels describe the stretches between
              events. Focus reveals detail. It never advances a process.
            </td>
          </tr>
          <tr>
            <td class="text-text-primary py-3 pr-4 align-top font-semibold">Stepper</td>
            <td class="py-3 pr-4 align-top">Prospective process</td>
            <td class="py-3 align-top">
              A wizard the user walks through: checkout, onboarding, multi-step forms. Steps are
              tasks to complete (often with embedded inputs), progress moves forward, and the
              component may gate navigation. No time axis. The user is the timeline.
            </td>
          </tr>
          <tr>
            <td class="text-text-primary py-3 pr-4 align-top font-semibold">Tab</td>
            <td class="py-3 pr-4 align-top">Peer views</td>
            <td class="py-3 align-top">
              Unordered, equivalent surfaces of one thing: Account, Billing, Team. No sequence, no
              status, no chronology. If reordering the items would change their meaning, they are
              not tabs.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-text-secondary text-sm">
      Rule of thumb: does each item carry a <em>status</em> and does their
      <em>order tell a story</em>? JourneyTimeline. Does the user <em>complete</em> the items one by
      one? Stepper. Are the items just <em>alternative views</em>? Tab.
    </p>
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="A primary-accented readout"
      description="slotClasses haloes the markers and tints the docked panel into a milestone look the props don't offer. It stays token-native, so it tracks light and dark, and keeps the panel's radius tier, shadow and docking behaviour."
      isolate
    >
      <div class="w-full">
        <JourneyTimeline
          items={approval}
          detail="panel"
          slotClasses={{
            marker: 'ring-2 ring-primary/30 ring-offset-2 ring-offset-surface-base',
            panel: 'bg-surface-selected border-primary/40'
          }}
        >
          {#snippet node(item)}
            <p class="text-text-secondary text-sm">
              Comments, reviewers and version history for “{item.title}” live here.
            </p>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->
<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Structure and ARIA">
      <p>
        The rail is an ordered list. Each node carries
        <code class="text-text-primary">aria-current="step"</code> while its status is
        <code class="text-text-primary">active</code>. The focusable trigger exposes
        <code class="text-text-primary">aria-expanded</code> and
        <code class="text-text-primary">aria-controls</code> for its detail region (a per-node
        inline region, or the shared panel in panel/horizontal mode). The status is announced
        through a visually-hidden label, so the dot markers stay decorative, including any glyphs
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
        header stays visually stationary. Real user scrolling cancels it immediately.
      </p>
    </Note>
  </NoteList>
</Section>
