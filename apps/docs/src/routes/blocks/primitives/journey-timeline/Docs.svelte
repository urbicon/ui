<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Badge, Button, JourneyTimeline, type JourneyNode } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: true, order: 1 },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: { include: true },
    meta: { title: 'JourneyTimeline Component', showToc: true }
  };

  // Vertical billing journey with a controlled focus.
  const billing: JourneyNode[] = [
    { id: 'readings', title: 'Meter readings', status: 'complete', subtitle: 'Collected 3 Jun' },
    {
      id: 'allocate',
      title: 'Cost allocation',
      status: 'active',
      subtitle: 'Splitting shared costs'
    },
    { id: 'review', title: 'Review', status: 'pending', subtitle: 'Awaiting sign-off' },
    { id: 'dispatch', title: 'Dispatch', status: 'pending', subtitle: 'Send statements' }
  ];
  let focusId = $state('allocate');

  // Horizontal lifecycle.
  const lifecycle: JourneyNode[] = [
    { id: 'draft', title: 'Draft', status: 'complete' },
    { id: 'open', title: 'Open', status: 'active' },
    { id: 'due', title: 'Due', status: 'pending' },
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
    { id: 's-blocked', title: 'Blocked', status: 'blocked', subtitle: 'Missing data' },
    { id: 's-skipped', title: 'Skipped', status: 'skipped', subtitle: 'Not applicable' }
  ];
</script>

<!-- ─── Examples ─── -->
<Section marker="02" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Vertical journey with inline detail"
      description="Data-driven items; the focused node expands inline to reveal the node snippet. Bind focusId to drive or observe the open node."
      isolate
    >
      <div class="flex w-full max-w-lg flex-col gap-3">
        <div class="flex items-center gap-2">
          <span class="text-text-tertiary text-xs font-medium">Open node:</span>
          <Badge size="xs" intent="primary" variant="soft">{focusId}</Badge>
        </div>
        <JourneyTimeline items={billing} bind:focusId>
          {#snippet node(item)}
            <div class="flex flex-col gap-2 py-1">
              <p class="text-text-secondary text-sm">
                Details for <strong>{item.title}</strong> ({item.subtitle}).
              </p>
              <div>
                <Button size="sm" variant="outlined">Open {item.title}</Button>
              </div>
            </div>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>

    <CodeExample
      title="Horizontal with a shared detail panel"
      description="In horizontal orientation the markers form a rail and the focused node's detail renders in a single panel beneath it."
      isolate
    >
      <div class="w-full">
        <JourneyTimeline items={lifecycle} orientation="horizontal">
          {#snippet node(item)}
            <p class="text-text-secondary text-sm">Phase “{item.title}” details go here.</p>
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
      Each node's <code>status</code> maps to a semantic marker colour and glyph:
      <strong>complete</strong> (success ✓), <strong>active</strong> (primary ◉),
      <strong>pending</strong> (empty outline), <strong>blocked</strong> (danger ⊘) and
      <strong>skipped</strong> (muted −). The connector leaving a completed node reads as
      “travelled”. Set <code>focusable: false</code> for pure waypoints — they render a marker and label
      but never expand and are skipped by keyboard navigation.
    </p>
    <CodeExample
      title="All statuses"
      description="A node per status, including a non-focusable automatic step."
      isolate
    >
      <div class="w-full max-w-lg">
        <JourneyTimeline items={statuses} defaultFocusId="s-active">
          {#snippet node(item)}
            <p class="text-text-secondary text-sm">{item.subtitle}</p>
          {/snippet}
        </JourneyTimeline>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Scroll-spy ─── -->
<Section marker="04" id="scroll-spy" title="Scroll-spy">
  <div class="space-y-4">
    <p class="text-text-secondary text-sm">
      Opt in with <code>scrollSpy</code> to let the focus follow the node scrolled to the top of the
      viewport — the travel-log feel. It only <em>follows</em> real scrolling: mounting keeps your
      resolved default (or controlled) focus, and it never force-scrolls, so it stays
      <code>prefers-reduced-motion</code> friendly. Leave it off (the default) for a controlled focus
      driven by click and keyboard.
    </p>
    <CodeExample
      title="Scroll-driven focus"
      code={`<JourneyTimeline items={stages} scrollSpy>
  {#snippet node(item)}
    <StageDetail id={item.id} />
  {/snippet}
</JourneyTimeline>`}
      language="svelte"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Customization ─── -->
<Section marker="05" id="customization" title="Customization">
  <div class="space-y-4">
    <p class="text-text-secondary text-sm">
      Every family member supports <code>unstyled</code>, <code>slotClasses</code> and
      <code>preset</code>. Slots: <code>base</code>, <code>rail</code>, <code>node</code>,
      <code>trigger</code>, <code>marker</code>, <code>connectorColumn</code>,
      <code>connector</code>,
      <code>labelGroup</code>, <code>title</code>, <code>subtitle</code>, <code>body</code>,
      <code>detail</code>, <code>detailInner</code>, <code>detailContent</code> and
      <code>panel</code>.
    </p>
    <CodeExample
      title="Restyle the marker column with slotClasses"
      code={`<JourneyTimeline
  items={stages}
  slotClasses={{
    marker: 'ring-2 ring-offset-2 ring-primary/20',
    connector: 'rounded-none'
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
  <div class="text-text-secondary space-y-4 text-sm">
    <p>
      The rail is an ordered list. Each node carries <code>aria-current="step"</code> while its
      status is <code>active</code>; the focusable trigger exposes <code>aria-expanded</code> and
      <code>aria-controls</code> for its detail region (an inline region when vertical, the shared panel
      when horizontal). The status is announced through a visually-hidden label, so the marker glyph can
      stay decorative.
    </p>
    <div>
      <p class="text-text-primary mb-2 font-medium">Keyboard</p>
      <ul class="list-inside list-disc space-y-1">
        <li>
          <kbd>↑</kbd> / <kbd>↓</kbd> (vertical) or <kbd>←</kbd> / <kbd>→</kbd> (horizontal) move the
          roving focus between node headers.
        </li>
        <li><kbd>Home</kbd> / <kbd>End</kbd> jump to the first / last focusable node.</li>
        <li><kbd>Enter</kbd> / <kbd>Space</kbd> expand the focused node.</li>
      </ul>
    </div>
    <p>
      Expand/collapse and colour transitions run on the motion-duration tokens, which collapse to
      1&nbsp;ms under <code>prefers-reduced-motion: reduce</code>.
    </p>
  </div>
</Section>
