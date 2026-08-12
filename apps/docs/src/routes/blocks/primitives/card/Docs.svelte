<!-- urbicon-ignore raw-tailwind-color — the Customization demo tints the card into a glass look
     with one `class`: it keeps the container radius tier, spacing and behaviour, and only the
     fill, border and blur are raw — a glass look the token palette has no equivalent for. Every
     other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Avatar, Badge, BookOpenIcon, Button, Card, CheckIcon, Kbd } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Variants ─── -->

<Section marker id="variants" title="Variants">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    <code class="text-text-primary">variant</code> sets a card's visual weight, from a flat in-page tint
    to a lifted, shadowed surface. Pick the lightest one that still reads as a distinct region.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold"><code class="text-text-primary">variant</code></th>
          <th class="py-2 pr-4 font-semibold">What it renders</th>
          <th class="w-44 py-2 pr-6 font-semibold">Example</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-4 pr-4 align-top">
            <code class="text-text-primary">quiet</code>
            <span class="text-text-tertiary">(default)</span>
          </td>
          <td class="py-4 pr-4 align-top">
            A barely-tinted fill, no border or shadow. The reading-flow default for grouping content
            in place.
          </td>
          <td class="w-44 py-4 pr-6 align-top">
            <Card variant="quiet" padding="sm">
              <span class="text-text-tertiary text-xs">Inline section</span>
            </Card>
          </td>
        </tr>
        <tr>
          <td class="py-4 pr-4 align-top"><code class="text-text-primary">outlined</code></td>
          <td class="py-4 pr-4 align-top">
            A hairline border over a transparent fill. Delineates a region without lifting it off
            the page.
          </td>
          <td class="w-44 py-4 pr-6 align-top">
            <Card variant="outlined" padding="sm">
              <span class="text-text-tertiary text-xs">Grouped fields</span>
            </Card>
          </td>
        </tr>
        <tr>
          <td class="py-4 pr-4 align-top"><code class="text-text-primary">elevated</code></td>
          <td class="py-4 pr-4 align-top">
            A shadow over a raised surface, no border. Lifts the card so it reads above the page.
          </td>
          <td class="w-44 py-4 pr-6 align-top">
            <Card variant="elevated" padding="sm">
              <span class="text-text-tertiary text-xs">Summary panel</span>
            </Card>
          </td>
        </tr>
        <tr>
          <td class="py-4 pr-4 align-top"><code class="text-text-primary">floating</code></td>
          <td class="py-4 pr-4 align-top">
            A larger shadow over a raised surface, for popover-family surfaces above arbitrary
            backgrounds.
          </td>
          <td class="w-44 py-4 pr-6 align-top">
            <Card variant="floating" padding="sm">
              <span class="text-text-tertiary text-xs">Popover surface</span>
            </Card>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    A card's default content is its body. Add <code class="text-text-primary">header</code> and
    <code class="text-text-primary">footer</code> snippets for content above and below it, and
    <code class="text-text-primary">dividers</code> to draw a hairline between the three regions.
    Set
    <code class="text-text-primary">href</code> to render the whole card as a link, or
    <code class="text-text-primary">onclick</code> to render it as a button.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Stat tile"
      description="Pair a metric with a delta and a trend hint. A small tinted tile reads as content rather than architecture, so it takes the `bridge` radius tier for a softer corner."
      isolate
      previewClass="flex justify-center max-w-xs w-full mx-auto"
    >
      <Card tier="bridge" padding="md">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Monthly Revenue
        </p>
        <p class="text-text-primary mt-2 text-3xl font-bold">$48,210</p>
        <div class="mt-2 flex items-center gap-2">
          <Badge size="xs" intent="success">+12.4%</Badge>
          <span class="text-text-tertiary text-xs">vs. last month</span>
        </div>
      </Card>
    </CodeExample>

    <CodeExample
      title="Profile card"
      description="Compose a header, body and footer from the library's own components. `dividers` draws a hairline between the three regions for a structured look."
      isolate
      previewClass="flex justify-center max-w-sm w-full mx-auto"
    >
      <Card variant="outlined" dividers>
        {#snippet header()}
          <div class="flex items-center gap-3">
            <Avatar name="Ada Lovelace" randomColor />
            <div>
              <p class="text-text-primary font-semibold">Ada Lovelace</p>
              <p class="text-text-tertiary text-xs">Product Designer</p>
            </div>
          </div>
          <Badge size="xs" variant="soft" intent="success">Online</Badge>
        {/snippet}

        <p class="text-text-secondary text-sm">
          Working on the design-token pipeline and the component gallery. Based in London.
        </p>

        {#snippet footer()}
          <div class="flex justify-end gap-2">
            <Button variant="ghost" size="sm">Message</Button>
            <Button variant="filled" intent="primary" size="sm">Follow</Button>
          </div>
        {/snippet}
      </Card>
    </CodeExample>

    <CodeExample
      title="Clickable navigation card"
      description="Set `href` to render as `<a>`, or `onclick` to render as `<button>`. Hover and focus styles activate automatically. Pair with `mint=scale` for a subtle press affordance."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <Card href="#documentation" mint="scale">
        <div class="flex items-start gap-3">
          <div
            class="bg-primary/10 text-primary rounded-modify flex h-10 w-10 shrink-0 items-center justify-center"
          >
            <BookOpenIcon size={20} />
          </div>
          <div>
            <p class="text-text-primary font-semibold">Read the documentation</p>
            <p class="text-text-secondary mt-1 text-sm">
              Browse component APIs, design tokens, and integration guides.
            </p>
          </div>
        </div>
      </Card>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Glass pricing card"
      description="One `class` tints the card into a glass look. It keeps the container radius tier, spacing and behaviour. Only the fill, border and blur change, using raw colours because glass has no token equivalent."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-rose-500 via-fuchsia-500 to-indigo-500 px-8 py-10"
    >
      <Card
        class="w-72 border border-white/20 bg-white/10 text-white shadow-[var(--blocks-shadow-lg)] backdrop-blur-xl"
      >
        <p class="text-sm font-medium tracking-wider text-white/70 uppercase">Premium</p>
        <p class="mt-2 text-4xl font-bold">
          $29<span class="text-lg font-normal text-white/60">/mo</span>
        </p>
        <ul class="mt-4 space-y-2 text-sm text-white/80">
          {#each ['Unlimited projects', 'Priority support', 'Custom integrations'] as perk (perk)}
            <li class="flex items-center gap-2"><CheckIcon size={16} /> {perk}</li>
          {/each}
        </ul>
        <Button
          class="mt-6 w-full border-transparent bg-white font-semibold text-fuchsia-600 hover:bg-white/90"
        >
          Subscribe
        </Button>
      </Card>
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
        Cards render as <code class="text-text-primary">&lt;div&gt;</code> by default. When
        <code class="text-text-primary">clickable</code>
        or
        <code class="text-text-primary">onclick</code> is set, the card renders as a
        <code class="text-text-primary">&lt;button&gt;</code>. When
        <code class="text-text-primary">href</code> is provided, it becomes an
        <code class="text-text-primary">&lt;a&gt;</code>. Disabled cards set
        <code class="text-text-primary">aria-disabled</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Interactive cards are focusable via
        <Kbd keys="Tab" /> and show a focus ring. A card rendered as an
        <code class="text-text-primary">&lt;a&gt;</code> activates on
        <Kbd keys="Enter" />. A card rendered as a
        <code class="text-text-primary">&lt;button&gt;</code> (via
        <code class="text-text-primary">clickable</code> or
        <code class="text-text-primary">onclick</code>) activates on
        <Kbd keys="Enter" /> or <Kbd keys="Space" />. Non-interactive cards are skipped in the tab
        order.
      </p>
    </Note>
    <Note title="Structure">
      <p>
        Header and footer snippets render above and below the body in DOM order, so screen readers
        encounter them in the right sequence. Use a heading inside the header to give the card a
        scannable outline.
      </p>
    </Note>
  </NoteList>
</Section>
