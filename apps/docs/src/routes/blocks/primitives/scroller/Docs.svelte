<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Badge, Scroller } from '@urbicon-ui/blocks';

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
    'Mine'
  ];
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="The same row, twice — it scrolls only when it must"
      description="Identical markup in a wide and a narrow container. Above there is room for every card, so it stays an ordinary row: no scrollbar, no buttons, no tab stop, and none of the duties a scroll container carries. Below, the same row runs out of room and picks up snapping, a keyboard-reachable scroll region and its jump controls. Nothing is hidden where there is space for it — which is why a desktop layout needs no arrows and no dots."
      isolate
      previewClass="w-full"
      code={`<!-- one component, two containers -->
<Scroller label="Main features" itemBasis="13rem">
  {#each features as feature (feature.id)}
    <FeatureCard {...feature} />
  {/each}
</Scroller>`}
    >
      <div class="space-y-8">
        <div>
          <p class="text-text-tertiary mb-2 text-xs font-medium tracking-wide uppercase">
            Room for all three — an ordinary row
          </p>
          <Scroller label="Main features, wide" itemBasis="13rem">
            {#each features.slice(0, 3) as feature (feature.id)}
              <article class="border-border-subtle bg-surface-elevated rounded-contain border p-4">
                <h4 class="text-text-primary text-sm font-semibold">{feature.title}</h4>
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
            Same markup, out of room — now a scroll region
          </p>
          <Scroller label="Main features, narrow" itemBasis="13rem">
            {#each features.slice(0, 3) as feature (feature.id)}
              <article class="border-border-subtle bg-surface-elevated rounded-contain border p-4">
                <h4 class="text-text-primary text-sm font-semibold">{feature.title}</h4>
                <p class="text-text-secondary mt-1 text-sm">{feature.body}</p>
              </article>
            {/each}
          </Scroller>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Centred stage"
      description="A different job from the row above: not “compare five cards side by side”, but “see that there are five, and read one of them”. The card width is chosen so the row always overflows — that is what gives it a middle to centre. Neighbours stay at full opacity: the peeking cards are what carry the “there is more” message, so dimming them would destroy the point. Dots supply the count a partly-visible row can no longer show."
      isolate
      previewClass="w-full"
      code={`<Scroller
  label="Main features"
  itemBasis="22rem"
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
        itemBasis="22rem"
        align="center"
        emphasis="strong"
        indicator="dots"
      >
        {#each features as feature (feature.id)}
          <article class="border-border-subtle bg-surface-elevated rounded-contain border p-6">
            <h4 class="text-text-primary text-base font-semibold">{feature.title}</h4>
            <p class="text-text-secondary mt-2 text-sm">{feature.body}</p>
          </article>
        {/each}
      </Scroller>
    </CodeExample>

    <CodeExample
      title="Filter bar"
      description="Narrow items, tight gap, no indicator — a dot per chip would be noise, and the chips already label themselves. Because the items are small, the jump buttons travel a viewport at a time rather than one chip."
      isolate
      previewClass="w-full"
      code={`<Scroller label="Filters" itemBasis="auto" gap="sm">
  {#each filters as filter (filter)}
    <Badge variant="outlined">{filter}</Badge>
  {/each}
</Scroller>`}
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

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-10">
    <CodeExample
      title="Responsive item widths"
      description="itemBasis takes any CSS length, so a clamp() covers the whole range without a media query — and the row keeps deciding for itself when it overflows. For anything more involved, target the items through the viewport slot."
      preview={false}
      language="svelte"
      code={`<!-- one length, every viewport -->
<Scroller label="Products" itemBasis="clamp(14rem, 70vw, 22rem)">…</Scroller>

<!-- or take over per-item layout entirely -->
<Scroller
  label="Products"
  slotClasses={{ viewport: '[&>*]:basis-[70vw] md:[&>*]:basis-72' }}
>…</Scroller>`}
    />

    <CodeExample
      title="Inside a grid or a flexbox: give the parent min-w-0"
      description="The Scroller itself carries min-w-0, but a grid or flex ITEM defaults to min-width:auto and refuses to shrink below its content. Drop a row into such a column without min-w-0 and it will widen the column instead of scrolling — the row looks broken, and the cause is one level up. This is the single most common way to make a Scroller misbehave."
      preview={false}
      language="svelte"
      code={`<div class="grid lg:grid-cols-[1fr_20rem]">
  <div class="min-w-0">          <!-- ← without this the row pushes the column wide -->
    <Scroller label="Main features" itemBasis="14rem">…</Scroller>
  </div>
  <aside>…</aside>
</div>`}
    />

    <CodeExample
      title="Retuning the emphasis lift"
      description="The lift reads two custom properties, so its size and elevation tune per instance without a prop for each. Keep it small: past roughly 1.05 the row wobbles while scrolling and pulls attention away from reading."
      preview={false}
      language="svelte"
      code={`<Scroller
  label="Main features"
  align="center"
  emphasis="strong"
  style="--blocks-scroller-emphasis-scale: 1.06;
         --blocks-scroller-emphasis-shadow: var(--blocks-shadow-lg);"
>…</Scroller>`}
    />

    <CodeExample
      title="Slots"
      description="root (the column holding the row and its control bar) · viewport (the scroll container, and where per-item rules live) · controls (the bar under the row) · control (a jump button) · indicator (the dot group) · dot. `unstyled` strips all of it — including the layout rules that make the row scroll and snap, so rebuild those too."
      preview={false}
      language="svelte"
      code={`<Scroller
  label="Main features"
  slotClasses={{
    controls: 'justify-end pt-2',
    dot: 'size-8'
  }}
>…</Scroller>`}
    />
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="space-y-6">
    <div class="space-y-3">
      <h3 class="text-text-primary text-base font-semibold">Keyboard</h3>
      <p class="text-text-secondary text-sm">
        While the row overflows, the scroll container takes a tab stop and becomes a named
        <code class="text-text-primary text-xs">role="group"</code>. This is the defect in most
        media rows on the web: a scrollable container that is not focusable cannot be scrolled by
        keyboard at all — Safari does not adopt it into the tab order on its own. The tab stop is
        conditional because the inverse is a defect too: a stop on a row with nothing to scroll
        costs a press and does nothing.
      </p>
      <p class="text-text-secondary text-sm">
        Arrow keys, Home, End and Page Up/Down scroll the focused container — handled by the
        browser, with the platform's own snapping and inertia. The component adds no key handling of
        its own, so nothing competes with the native behaviour. Items that are themselves focusable
        (links, buttons) stay in the tab order and scroll into view when focused.
      </p>
    </div>

    <div class="space-y-3">
      <h3 class="text-text-primary text-base font-semibold">Controls and indicator</h3>
      <p class="text-text-secondary text-sm">
        The jump buttons are real buttons with labels, disabled at the ends rather than hidden — a
        control that disappears takes its width with it and shifts the row. Dots are buttons that
        jump to their item and carry
        <code class="text-text-primary text-xs">aria-current</code>; decorative dots that merely
        look clickable are worse than none. Both appear only while the row overflows.
      </p>
      <p class="text-text-secondary text-sm">
        A dot stands for a <em>resting place</em>, not for an item. On a centred row that is the
        same thing — every item has its own turn. On a start-aligned row the trailing items share
        the end of the scroll range, so they share one dot, labelled with their range ("Items 4–5 of
        5"): a row has only as many distinct resting places as it can scroll to, and a dot per item
        would light up elsewhere than the press. Every dot therefore does exactly what it promises.
      </p>
      <p class="text-text-secondary text-sm">
        The native scrollbar stays visible while nothing else makes the promise that there is more
        to see. Once jump buttons or dots are on screen they carry it, and the scrollbar steps aside
        rather than stacking a third indicator on the other two.
      </p>
    </div>

    <div class="space-y-3">
      <h3 class="text-text-primary text-base font-semibold">Motion</h3>
      <p class="text-text-secondary text-sm">
        Smooth scrolling and the emphasis lift both collapse under
        <code class="text-text-primary text-xs">prefers-reduced-motion</code>. The lift is driven by
        <code class="text-text-primary text-xs">animation-timeline: view()</code>, so it follows
        scroll position rather than a clock — where that is unsupported (Firefox before 156) the row
        behaves identically, just flat. Nothing here moves on its own: there is no auto-rotation, by
        design. Motion the user did not ask for competes with reading, and the click-through
        evidence on rotating banners has been unambiguous for over a decade.
      </p>
    </div>

    <div class="space-y-3">
      <h3 class="text-text-primary text-base font-semibold">Choosing this over a tab panel</h3>
      <p class="text-text-secondary text-sm">
        A Scroller fits when the items are comparable and the user should be able to sweep across
        them. When one item at a time should be <em>presented</em> — a screenshot, a live demo — a
        tab panel is the stronger pattern, and
        <code class="text-text-primary text-xs">Tab</code> already provides it with the right semantics.
      </p>
    </div>
  </div>
</Section>
