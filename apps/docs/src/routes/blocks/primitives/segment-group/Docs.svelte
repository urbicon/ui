<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Card, Kbd, SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  const teams = [
    { id: 'atlas', name: 'Atlas', meta: '12 members' },
    { id: 'nova', name: 'Nova', meta: '8 members' },
    { id: 'orbit', name: 'Orbit', meta: '5 members' }
  ];
  const rangeLabels: Record<string, string> = {
    '1d': 'day',
    '1w': 'week',
    '1m': 'month',
    '1y': 'year'
  };

  // `item` is SegmentItem's slot, not the group's — the group only owns `base`
  // and `indicator`. Shared here so the two items stay in step.
  const tintedLabel = {
    item: 'text-primary-text data-[state=active]:text-text-on-primary'
  };

  let view = $state('cards');
  let range = $state('1w');
  let theme = $state('system');
  let plan = $state('yearly');

  // Stands in for the fetch a real dashboard would fire here.
  let loadedRange = $state(rangeLabels['1w']);
  function loadRevenue(next: string) {
    loadedRange = rangeLabels[next];
  }
</script>

<!-- ─── Purpose ─── -->

<Section marker id="purpose" title="Purpose">
  <p class="text-text-secondary mb-4 text-sm leading-relaxed">
    Reach for a SegmentGroup when a handful of options are mutually exclusive and switching between
    them is the whole interaction: a view mode, a time range, a display density. It shows every
    option at once and slides the selection between them.
  </p>

  <p class="text-text-secondary mb-4 text-sm leading-relaxed">
    Each option is a <code class="text-text-primary">SegmentItem</code> with a
    <code class="text-text-primary">value</code>, and the group's
    <code class="text-text-primary">value</code> is whichever one is selected.
    <code class="text-text-primary">bind:value</code> keeps it in a variable,
    <code class="text-text-primary">onValueChange</code> gives you the new value for a side effect
    like refetching. Where the row runs out of width,
    <code class="text-text-primary">collapseOnOverflow</code> turns it into a vertical stack instead of
    letting it overflow, so every option stays visible.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold">Component</th>
          <th class="py-2 font-semibold">Reach for it when</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">SegmentGroup</code></td>
          <td class="py-3 align-top">
            2–5 mutually exclusive views or modes, in one neutral style. The group hands you a value
            and you decide what to render with it.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <code class="text-text-primary">ButtonGroup</code>
            <span class="text-text-tertiary">selection="single"</span>
          </td>
          <td class="py-3 align-top">
            You need button variants and intents, connected borders, or multi-select.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">RadioGroup</code></td>
          <td class="py-3 align-top">
            You're collecting a value in a form: labels, descriptions, helper and error text.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">Tab</code></td>
          <td class="py-3 align-top">
            Each option owns a panel that assistive technology should tie to it. Tab renders
            <code class="text-text-primary">role="tablist"</code> with
            <code class="text-text-primary">aria-controls</code>, where a SegmentGroup is a
            <code class="text-text-primary">radiogroup</code> that knows nothing about your markup.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="View switcher"
      description="The common case: one dataset, a few mutually exclusive views."
      isolate
      previewClass="flex flex-col items-center gap-5"
    >
      <SegmentGroup bind:value={view} size="sm" ariaLabel="View mode">
        <SegmentItem value="list">List</SegmentItem>
        <SegmentItem value="cards">Cards</SegmentItem>
      </SegmentGroup>

      {#if view === 'list'}
        <ul
          class="border-border-subtle divide-border-subtle w-full max-w-md divide-y rounded-xl border"
        >
          {#each teams as team (team.id)}
            <li class="flex items-center justify-between px-4 py-3">
              <span class="text-text-primary text-sm font-medium">{team.name}</span>
              <span class="text-text-tertiary text-xs">{team.meta}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="grid w-full max-w-md grid-cols-3 gap-3">
          {#each teams as team (team.id)}
            <Card variant="outlined" padding="sm" class="text-center">
              <p class="text-text-primary text-sm font-medium">{team.name}</p>
              <p class="text-text-tertiary mt-1 text-xs">{team.meta}</p>
            </Card>
          {/each}
        </div>
      {/if}
    </CodeExample>

    <CodeExample
      title="Time-range selector"
      description="A compact range switch for a chart or dashboard header. `bind:value` keeps the current range, and `onValueChange` is where the refetch goes. Two to five options fit, past that reach for a Menu."
      isolate
      previewClass="flex flex-col items-center gap-4"
    >
      <SegmentGroup bind:value={range} onValueChange={loadRevenue} size="sm" ariaLabel="Time range">
        <SegmentItem value="1d">1D</SegmentItem>
        <SegmentItem value="1w">1W</SegmentItem>
        <SegmentItem value="1m">1M</SegmentItem>
        <SegmentItem value="1y">1Y</SegmentItem>
      </SegmentGroup>
      <p class="text-text-secondary text-sm">
        Showing revenue for the last
        <span class="text-text-primary font-medium">{loadedRange}</span>.
      </p>
    </CodeExample>

    <CodeExample
      title="Inside a settings panel"
      description="`mint=scale` grows a segment slightly while the pointer rests on it, which suits a control that sits quietly in a settings row until someone reaches for it."
      isolate
      previewClass="flex justify-center"
    >
      <div
        class="border-border-subtle bg-surface-elevated flex w-full max-w-sm items-center justify-between rounded-2xl border p-4"
      >
        <span class="text-text-primary text-sm font-medium">Appearance</span>
        <SegmentGroup bind:value={theme} size="sm" mint="scale" ariaLabel="Theme preference">
          <SegmentItem value="light">Light</SegmentItem>
          <SegmentItem value="dark">Dark</SegmentItem>
          <SegmentItem value="system">System</SegmentItem>
        </SegmentGroup>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Primary-tinted control"
      description="The track and the sliding indicator take the `primary` intent tokens through the group's `slotClasses`; the label rides `item`, which belongs to each SegmentItem. Note the two text roles: `primary-text` is the AA-rated step for a label on paper, `text-on-primary` the one that reads on the indicator's fill. Radius tier, padding, shadow and the slide animation stay, and because the look rides the intent palette it re-themes with the rest of the app."
      isolate
      previewClass="flex justify-center"
    >
      <SegmentGroup
        bind:value={plan}
        ariaLabel="Billing plan"
        slotClasses={{
          base: 'bg-primary-subtle',
          indicator: 'bg-primary'
        }}
      >
        <SegmentItem value="monthly" slotClasses={tintedLabel}>Monthly</SegmentItem>
        <SegmentItem value="yearly" slotClasses={tintedLabel}>Yearly</SegmentItem>
      </SegmentGroup>
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
    <Note title="Built-in ARIA">
      <p>
        The container is a <code class="text-text-primary">role="radiogroup"</code> and each segment
        a
        <code class="text-text-primary">role="radio"</code> carrying
        <code class="text-text-primary">aria-checked</code>, so the active option is announced as a
        selected radio. The sliding indicator is
        <code class="text-text-primary">aria-hidden</code>, so it is never announced. Pass
        <code class="text-text-primary">ariaLabel</code> to name the group's purpose.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Arrow" /> keys move between segments and select as they go.
        <Kbd keys="Home" />
        and
        <Kbd keys="End" /> do the same for the first and last, so both of them change the value. Only
        the active segment is in the tab order (roving
        <code class="text-text-primary">tabindex</code>), so
        <Kbd keys="Tab" /> enters and leaves the group as a single stop.
      </p>
    </Note>
    <Note title="Reduced motion">
      <p>
        Under <code class="text-text-primary">prefers-reduced-motion</code> the indicator moves to
        its new segment without the slide, and a
        <code class="text-text-primary">mint</code> preset plays nothing at all.
      </p>
    </Note>
  </NoteList>
</Section>
