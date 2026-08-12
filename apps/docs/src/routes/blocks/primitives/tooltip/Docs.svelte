<!-- urbicon-ignore raw-tailwind-color — the Customization demo tints the tooltip panel with
     `class`: it keeps the tooltip's radius tier, fade and layering, and only the fill, border and
     blur are raw — a frosted-glass look the token palette has no equivalent for. Every other
     section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Badge, Button, Kbd, Separator, Toolbar, Tooltip } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  const services = [
    {
      service: 'API Gateway',
      status: 'Operational',
      intent: 'success',
      detail: 'API Gateway, 99.99% uptime over 30 days'
    },
    {
      service: 'Auth Service',
      status: 'Degraded',
      intent: 'warning',
      detail: 'Auth Service, elevated latency since 14:20 UTC'
    },
    {
      service: 'Database',
      status: 'Incident',
      intent: 'danger',
      detail: 'Database, failover active, primary unreachable'
    }
  ] as const;

  const files = [
    { name: 'Q4-roadmap-final-with-stakeholder-feedback-v3.pdf', size: '2.4 MB' },
    { name: 'design-system-token-migration-notes.md', size: '18 KB' },
    { name: 'customer-interview-transcripts-jan-2026.zip', size: '14.2 MB' }
  ];
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Wrap the trigger element as the child and pass the hint text in
    <code class="text-text-primary">label</code>. The tooltip opens on hover or focus after
    <code class="text-text-primary">showDelay</code> (200 ms) and follows
    <code class="text-text-primary">placement</code> (default
    <code class="text-text-primary">top</code>, auto-flipping when clipped). Set
    <code class="text-text-primary">disabled</code> to suppress it, or turn off the
    <code class="text-text-primary">arrow</code> for a plain chip.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Formatting toolbar"
      description="Icon-only controls need a name. The tooltip carries the label and its keyboard shortcut, on hover or focus."
      isolate
      previewClass="flex justify-center py-6"
    >
      <Toolbar aria-label="Text formatting">
        <Tooltip label="Bold (⌘B)" size="sm">
          <Button variant="ghost" size="sm"><span class="font-bold">B</span></Button>
        </Tooltip>
        <Tooltip label="Italic (⌘I)" size="sm">
          <Button variant="ghost" size="sm"><span class="italic">I</span></Button>
        </Tooltip>
        <Tooltip label="Underline (⌘U)" size="sm">
          <Button variant="ghost" size="sm"><span class="underline">U</span></Button>
        </Tooltip>
        <Separator orientation="vertical" size="sm" />
        <Tooltip label="Strikethrough (⌘⇧X)" size="sm">
          <Button variant="ghost" size="sm"><span class="line-through">S</span></Button>
        </Tooltip>
      </Toolbar>
    </CodeExample>

    <CodeExample
      title="Severity-matched tooltips"
      description="`intent` tints the tooltip to the state it reports, so the colour reinforces the message."
      isolate
      previewClass="flex flex-wrap items-center justify-center gap-3 py-6"
    >
      {#each services as row (row.service)}
        <Tooltip label={row.detail} intent={row.intent} placement="bottom">
          <Badge variant="soft" intent={row.intent}>{row.status}</Badge>
        </Tooltip>
      {/each}
    </CodeExample>

    <CodeExample
      title="Reveal truncated text"
      description="Wrap clipped text so the full value shows on hover."
      isolate
      previewClass="w-full"
    >
      <ul class="divide-border-subtle mx-auto w-full max-w-sm divide-y text-sm">
        {#each files as file (file.name)}
          <li class="flex items-center justify-between gap-3 py-2.5">
            <Tooltip label={file.name} placement="top-start" size="sm">
              <span class="text-text-primary block max-w-[14rem] truncate">{file.name}</span>
            </Tooltip>
            <span class="text-text-tertiary shrink-0 text-xs">{file.size}</span>
          </li>
        {/each}
      </ul>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Frosted glass"
      description="Tint just the panel with `class`. It keeps the tooltip's radius tier, fade and layering. The arrow is turned off, since a translucent panel reads cleaner as a plain chip. Raw colours because glass has no token equivalent."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-rose-500 via-fuchsia-500 to-indigo-500 px-8 py-12"
    >
      <Tooltip
        label="Frosted glass tooltip"
        arrow={false}
        class="border border-white/20 bg-white/15 text-white shadow-[var(--blocks-shadow-lg)] backdrop-blur-xl"
      >
        <Button
          class="border border-white/30 bg-white/10 text-white shadow-none backdrop-blur-sm hover:bg-white/20"
        >
          Hover for glass
        </Button>
      </Tooltip>
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
        Renders with <code class="text-text-primary">role="tooltip"</code> and links the trigger to
        it through <code class="text-text-primary">aria-describedby</code>. Each instance gets a
        unique id automatically, so a screen reader reads the tooltip as the trigger's description.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Tooltips open on hover or focus and dismiss with
        <Kbd keys="Escape" />. The panel itself is never focusable. It only supplements the
        trigger's accessible description.
      </p>
    </Note>
    <Note title="Timing">
      <p>
        A <code class="text-text-primary">showDelay</code> (default 200 ms) keeps the tooltip from
        flashing as the pointer passes over the trigger. A
        <code class="text-text-primary">hideDelay</code> (default 100 ms) lets the pointer cross a small
        gap without dismissing it.
      </p>
    </Note>
    <Note title="Reduced motion">
      <p>
        The fade runs on the <code class="text-text-primary">--blocks-tooltip-duration</code> token,
        an alias of <code class="text-text-primary">--blocks-duration-fast</code>. Under
        <code class="text-text-primary">prefers-reduced-motion</code>, that token collapses to 1 ms,
        so the tooltip appears and hides without a visible fade.
      </p>
    </Note>
    <Note title="Valid inside a paragraph">
      <p>
        Trigger, panel and arrow are all <code class="text-text-primary">&lt;span&gt;</code>, so a
        tooltip is valid inside a paragraph, the position it is built for. Two things stay yours:
        the trigger's own content has to be phrasing-level too, and the trigger wrapper is
        <code class="text-text-primary">inline-flex</code>, so a multi-word trigger is atomic and
        will not wrap across lines the way surrounding text does.
      </p>
    </Note>
  </NoteList>
</Section>
