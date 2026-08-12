<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Badge, Kbd, Scroller } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  const features = [
    { id: 'sync', title: 'Sync', body: 'Keeps every device on the same page, offline included.' },
    { id: 'audit', title: 'Audit', body: 'Every change recorded, with who changed it and when.' },
    { id: 'reports', title: 'Reports', body: 'Numbers your board actually reads.' },
    { id: 'access', title: 'Access', body: 'Roles, invitations and passkeys out of the box.' },
    { id: 'api', title: 'API', body: 'Everything the interface does, scriptable.' }
  ];

  const filters = [
    'All',
    'Active',
    'Draft',
    'Archived',
    'Shared with me',
    'Recently changed',
    'Needs review',
    'Assigned to me',
    'Due this week',
    'Waiting on client',
    'Blocked',
    'Done'
  ];
</script>

<!-- ─── Purpose ─── -->

<Section marker id="purpose" title="Purpose">
  <p class="text-text-secondary mb-4 text-sm leading-relaxed">
    A Scroller is a horizontal row that scrolls only when it runs out of room. Where every item fits
    it stays an ordinary row, by default without a scrollbar, buttons or a tab stop. Once it
    overflows it becomes a focusable <code class="text-text-primary">role="group"</code> the keyboard
    can scroll, with snapping and jump buttons.
  </p>

  <p class="text-text-secondary mb-4 text-sm leading-relaxed">
    Every direct child is one item. The row sets each child's width from
    <code class="text-text-primary">itemBasis</code> and stretches them to a common height, so a
    card component you already have drops in unchanged. It takes any CSS length (<code
      class="text-text-primary">16rem</code
    >
    by default, a
    <code class="text-text-primary">clamp()</code> for a responsive row) or
    <code class="text-text-primary">auto</code>, which leaves every item at its own content width.
    <code class="text-text-primary">label</code> is required, because an unnamed group is a nameless box
    to a screen reader.
  </p>

  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    The jump buttons appear on their own once the row overflows.
    <code class="text-text-primary">controls="none"</code> leaves the row to the scrollbar and the
    keyboard, <code class="text-text-primary">controls="always"</code> keeps them mounted and
    disables them at the ends, and <code class="text-text-primary">indicator="dots"</code> adds a dot
    per position the row can scroll to.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold"><code class="text-text-primary">align</code></th>
          <th class="py-2 font-semibold">Reach for it when</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top">
            <code class="text-text-primary">start</code>
            <span class="text-text-tertiary">(default)</span>
          </td>
          <td class="py-3 align-top">
            Comparable, equal-rank items you sweep across: feature cards, media, filter chips.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">center</code></td>
          <td class="py-3 align-top">
            One item leads at a time and the count should stay visible. Pair it with
            <code class="text-text-primary">emphasis</code> to lift the centred item and
            <code class="text-text-primary">indicator="dots"</code> to show the count.
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
    Reach for a <a href={resolve('/blocks/primitives/tab')} class="text-primary hover:underline"
      >Tab</a
    >
    panel instead when one item should be <em>presented</em> at a time, like a screenshot or a live demo.
    It carries the right semantics for that. A Scroller is for items you compare by sweeping across them.
  </p>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Same row, two widths"
      description="`itemBasis` sets each item's width, which decides when the row overflows. The same three cards sit in a wide and a narrow container. Below, the row runs out of room and picks up snapping, a tab stop and its jump buttons. The narrow cell needs `min-w-0`, which the snippet shows."
      previewClass="w-full"
      code={`<!-- In a container with room for every card: an ordinary row. -->
<Scroller label="Main features" itemBasis="13rem">
  {#each features as feature (feature.id)}
    <FeatureCard {...feature} />
  {/each}
</Scroller>

<!-- The same row in a narrow grid or flex cell. Without min-w-0 the cell
     refuses to shrink below its content and widens its column instead of
     letting the row scroll. -->
<div class="min-w-0 max-w-[22rem]">
  <Scroller label="Main features" itemBasis="13rem">
    {#each features as feature (feature.id)}
      <FeatureCard {...feature} />
    {/each}
  </Scroller>
</div>`}
    >
      <div class="space-y-8">
        <div>
          <p class="text-text-tertiary mb-2 text-xs font-medium tracking-wide uppercase">
            Room for all three, a plain row
          </p>
          <Scroller label="Main features, wide" itemBasis="13rem">
            {#each features.slice(0, 3) as feature (feature.id)}
              <article class="border-border-subtle bg-surface-elevated rounded-contain border p-4">
                <p class="text-text-primary text-sm font-semibold">{feature.title}</p>
                <p class="text-text-secondary mt-1 text-sm">{feature.body}</p>
              </article>
            {/each}
          </Scroller>
        </div>

        <!-- min-w-0 on the wrapper, not on the Scroller: a grid/flex item
             defaults to min-width:auto and refuses to shrink below its content,
             so without it the row pushes its column wide instead of scrolling. -->
        <div class="max-w-[22rem] min-w-0">
          <p class="text-text-tertiary mb-2 text-xs font-medium tracking-wide uppercase">
            Same cards, out of room, now scrollable
          </p>
          <Scroller label="Main features, narrow" itemBasis="13rem">
            {#each features.slice(0, 3) as feature (feature.id)}
              <article class="border-border-subtle bg-surface-elevated rounded-contain border p-4">
                <p class="text-text-primary text-sm font-semibold">{feature.title}</p>
                <p class="text-text-secondary mt-1 text-sm">{feature.body}</p>
              </article>
            {/each}
          </Scroller>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Centred stage"
      description="`align=center` makes the middle item the subject and pads the track so the first and last can reach the centre. Keep `itemBasis` narrow enough that a neighbour still peeks in beside the centred item: make the items much wider and the padding takes over the row, which the component warns about in DEV. `emphasis=strong` lifts whichever card has arrived in the middle, and `indicator=dots` shows a count the partly-visible row cannot."
      previewClass="w-full"
      code={`<Scroller
  label="Main features"
  itemBasis="15rem"
  align="center"
  emphasis="strong"
  indicator="dots"
>
  {#each features as feature (feature.id)}
    <FeatureCard {...feature} />
  {/each}
</Scroller>`}
    >
      <Scroller
        label="Main features, centred"
        itemBasis="15rem"
        align="center"
        emphasis="strong"
        indicator="dots"
      >
        {#each features as feature (feature.id)}
          <article class="border-border-subtle bg-surface-elevated rounded-contain border p-6">
            <p class="text-text-primary text-base font-semibold">{feature.title}</p>
            <p class="text-text-secondary mt-2 text-sm">{feature.body}</p>
          </article>
        {/each}
      </Scroller>
    </CodeExample>

    <CodeExample
      title="Filter bar"
      description="`itemBasis=auto` lets each chip keep its own width instead of taking a shared one, and a tight `gap` holds the bar together. No indicator: a dot per chip would be noise, and the chips already label themselves."
      isolate
      previewClass="w-full"
    >
      <Scroller label="Filters" itemBasis="auto" gap="sm">
        {#each filters as filter (filter)}
          <Badge variant="outlined">{filter}</Badge>
        {/each}
      </Scroller>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Tinted rail"
      description="`slotClasses` reaches the inner slots by name. The `viewport` slot is the scroll track, so a wash and a container radius there frame the row as a tray while the cards keep their elevated surface. The other slots are `root`, `controls`, `control`, `indicator` and `dot`, listed with the rest of the props below."
      previewClass="w-full"
      code={`<Scroller
  label="Main features"
  itemBasis="14rem"
  slotClasses={{ viewport: 'bg-primary-subtle rounded-contain px-4 py-3' }}
>
  {#each features as feature (feature.id)}
    <FeatureCard {...feature} />
  {/each}
</Scroller>`}
    >
      <Scroller
        label="Main features, tinted"
        itemBasis="14rem"
        slotClasses={{ viewport: 'bg-primary-subtle rounded-contain px-4 py-3' }}
      >
        {#each features as feature (feature.id)}
          <article class="border-border-subtle bg-surface-elevated rounded-contain border p-4">
            <p class="text-text-primary text-sm font-semibold">{feature.title}</p>
            <p class="text-text-secondary mt-1 text-sm">{feature.body}</p>
          </article>
        {/each}
      </Scroller>
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
    <Note title="Keyboard">
      <p>
        While the row overflows, the scroll container takes a tab stop and becomes a named
        <code class="text-text-primary text-xs">role="group"</code>, which is what
        <code class="text-text-primary">label</code> names. A row that fits takes no stop, so a keyboard
        user never pays a press for a row with nothing to scroll.
      </p>
      <p class="mt-3">
        Once the container has focus, <Kbd keys="←" />
        <Kbd keys="→" />, <Kbd keys="Home" />,
        <Kbd keys="End" /> and <Kbd keys="Page Up" /> / <Kbd keys="Page Down" /> scroll it. The browser
        handles those, with the platform's own snapping and inertia, and the component adds no key handling
        of its own. Items that are themselves focusable (links, buttons) stay in the tab order and scroll
        into view when focused, so a row of clickable cards keeps working without the container stop.
      </p>
    </Note>

    <Note title="Controls and indicator">
      <p>
        Jump buttons and dots are real buttons with labels. Dots appear only while the row overflows
        and has more than one position to rest at, and so do the jump buttons unless
        <code class="text-text-primary">controls="always"</code> pins them. The dot the row
        currently rests at carries <code class="text-text-primary text-xs">aria-current</code>. A
        jump button moves the row by one viewport where
        <code class="text-text-primary">align</code> is
        <code class="text-text-primary">start</code>, and by one item where it is
        <code class="text-text-primary">center</code>, so a long chip bar pages instead of stepping
        through thirty chips.
      </p>
      <p class="mt-3">
        A dot stands for a position the row can scroll to, not for an item. On a centred row that
        comes to one dot per item. On a start-aligned row the last items share the end of the scroll
        range, so one dot covers them and says so (“Items 4–5 of 5”). Where that count would confuse
        more than it orients, leave <code class="text-text-primary">indicator</code> off.
      </p>
    </Note>

    <Note title="Motion">
      <p>
        Smooth scrolling and the emphasis lift both collapse under
        <code class="text-text-primary text-xs">prefers-reduced-motion</code>. The lift follows
        scroll position rather than a clock, and where the browser does not support that (Firefox
        before 156) the row behaves identically, just flat.
      </p>
    </Note>
  </NoteList>
</Section>
