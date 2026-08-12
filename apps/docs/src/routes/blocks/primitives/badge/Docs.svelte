<!-- urbicon-ignore raw-tailwind-color — the Customization demo gives the badge a frosted-glass
     look with one `class`. The pill shape and padding stay. Only the fill, border and blur are raw,
     because frosted glass has no token equivalent. Every other section on this page stays under the
     rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Avatar, Badge, Button, Kbd } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let filters = $state<string[]>(['Active', 'Premium', 'Last 7 days']);
  const removeFilter = (f: string) => (filters = filters.filter((x) => x !== f));
</script>

<!-- ─── Purpose ─── -->

<Section marker id="purpose" title="Purpose">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Three props shape a badge. <code class="text-text-primary">purpose</code> sets what it is,
    <code class="text-text-primary">intent</code> sets the colour, and
    <code class="text-text-primary">variant</code> sets how much weight it carries: a solid
    <code class="text-text-primary">filled</code>, a quiet
    <code class="text-text-primary">soft</code>, or a light
    <code class="text-text-primary">outlined</code>.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold"><code class="text-text-primary">purpose</code></th>
          <th class="py-2 pr-4 font-semibold">What it renders</th>
          <th class="py-2 font-semibold">Example</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top">
            <code class="text-text-primary">status</code>
            <span class="text-text-tertiary">(default)</span>
          </td>
          <td class="py-3 pr-4 align-top">A coloured label for an entity's state.</td>
          <td class="py-3 align-top"><Badge variant="soft" intent="success">Active</Badge></td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">tag</code></td>
          <td class="py-3 pr-4 align-top">
            A neutral label for a category. Defaults
            <code class="text-text-primary">intent</code> to
            <code class="text-text-primary">neutral</code>, because a category carries no severity.
          </td>
          <td class="py-3 align-top"><Badge purpose="tag" variant="outlined">Beta</Badge></td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">counter</code></td>
          <td class="py-3 pr-4 align-top">A circular numeric pill for a count.</td>
          <td class="py-3 align-top"><Badge intent="primary" purpose="counter">8</Badge></td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">dot</code></td>
          <td class="py-3 pr-4 align-top">A contentless indicator for presence or unread state.</td>
          <td class="py-3 align-top"><Badge intent="success" purpose="dot" /></td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">chip</code></td>
          <td class="py-3 pr-4 align-top">
            An interactive label (focusable, <code class="text-text-primary">role="button"</code>).
            Pair with <code class="text-text-primary">onclick</code>.
          </td>
          <td class="py-3 align-top">
            <Badge purpose="chip" variant="soft" intent="primary" onclick={() => {}}
              >Clickable</Badge
            >
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
    <code class="text-text-primary">removable</code> is separate from
    <code class="text-text-primary">purpose</code>. It adds a dismiss button to any badge, so a
    <code class="text-text-primary">tag</code> or <code class="text-text-primary">status</code> can be
    removed too (see Filter chips below).
  </p>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Status labels"
      description="An entity's state. Use `soft` for ambient lists and `outlined` where a table needs more contrast."
      isolate
      previewClass="flex flex-wrap items-center gap-3"
    >
      <Badge variant="soft" intent="success">Active</Badge>
      <Badge variant="soft" intent="warning">Pending</Badge>
      <Badge variant="soft" intent="danger">Suspended</Badge>
      <Badge variant="outlined" intent="neutral">Draft</Badge>
      <Badge variant="outlined" intent="primary">Published</Badge>
    </CodeExample>

    <CodeExample
      title="Counters and dots on other components"
      description="Anchor a badge to an edge or corner of any `position: relative` parent with `placement`. Over a coloured surface, `border` cuts a ring in the page background so the badge stays legible."
      isolate
      previewClass="flex flex-wrap items-center gap-8"
    >
      <div class="relative inline-block">
        <Button variant="filled" intent="primary">Messages</Button>
        <Badge intent="danger" purpose="counter" placement="top-end" border size="sm">8</Badge>
      </div>
      <div class="relative inline-block">
        <Avatar name="Ada Lovelace" randomColor />
        <Badge intent="danger" purpose="counter" placement="top-end" border size="sm">3</Badge>
      </div>
      <div class="relative inline-block">
        <Button variant="filled" intent="neutral">Alerts</Button>
        <Badge intent="success" purpose="dot" placement="top-end" border />
      </div>
    </CodeExample>

    <CodeExample
      title="Filter chips"
      description="`removable` adds a dismiss button for user-applied filters or selected tags. Pair it with `onRemove`."
      isolate
      previewClass="flex flex-wrap items-center gap-2"
    >
      {#each filters as filter (filter)}
        <Badge
          variant="soft"
          intent="primary"
          removable
          onRemove={() => removeFilter(filter)}
          size="sm"
        >
          {filter}
        </Badge>
      {/each}
      {#if filters.length === 0}
        <span class="text-text-tertiary text-sm">No filters · </span>
        <button
          class="text-primary text-sm underline"
          onclick={() => (filters = ['Active', 'Premium', 'Last 7 days'])}
        >
          reset
        </button>
      {/if}
    </CodeExample>

    <CodeExample
      title="Inline tags"
      description="`purpose=tag` keeps a category label neutral inside prose, and `variant=outlined` keeps it light against body text."
      isolate
    >
      <p class="text-text-secondary text-sm leading-loose">
        The <Badge purpose="tag" variant="outlined" size="sm">Beta</Badge> release adds support for
        <Badge purpose="tag" variant="outlined" size="sm">OKLCH</Badge>
        color tokens and a redesigned
        <Badge purpose="tag" variant="outlined" size="sm">Tier API</Badge>. Existing consumers can
        opt-in per component.
      </p>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Frosted glass"
      description="One `class` gives the badge a frosted-glass look for a dark or photographic background: a translucent fill, a hairline border, and a blur behind it. It keeps the pill shape and padding."
      isolate
      previewClass="flex items-center gap-3 rounded-xl bg-linear-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-6"
    >
      <Badge size="sm" class="border-white/20 bg-white/15 text-white backdrop-blur-md">PRO</Badge>
      <Badge size="sm" class="border-white/20 bg-white/15 text-white backdrop-blur-md">Beta</Badge>
      <Badge size="sm" class="border-white/20 bg-white/15 text-white backdrop-blur-md">Live</Badge>
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
        Badges render with <code class="text-text-primary">role="status"</code> by default,
        announcing content changes to screen readers. An interactive badge (<code
          class="text-text-primary">onclick</code
        >
        or
        <code class="text-text-primary">purpose="chip"</code>) is announced as a
        <code class="text-text-primary">button</code> instead. Removable badges include an
        accessible label for the remove button. Set
        <code class="text-text-primary">role="alert"</code> for time-sensitive notifications.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        An interactive badge (<code class="text-text-primary">onclick</code> or
        <code class="text-text-primary">purpose="chip"</code>) is focusable via
        <Kbd keys="Tab" /> and carries <code class="text-text-primary">role="button"</code>. With an
        <code class="text-text-primary">onclick</code> it activates on
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />. On a removable badge the remove button takes focus, and
        <Kbd keys="Delete" />
        /
        <Kbd keys="Backspace" /> there removes it.
      </p>
    </Note>
  </NoteList>
</Section>
