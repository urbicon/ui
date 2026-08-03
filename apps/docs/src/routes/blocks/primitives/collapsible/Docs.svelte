<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Badge, Button, Collapsible, Kbd } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let controlledOpen = $state(false);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <!-- FAQ item -->
    <CodeExample
      title="FAQ item"
      description="Stack multiple independent Collapsibles to build a FAQ list. Each panel opens and closes on its own — for single-open-at-a-time coordination, reach for Accordion instead."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <div class="flex w-full max-w-lg flex-col gap-3">
        <Collapsible variant="card" title="What are design tokens?" defaultOpen>
          <p class="text-text-secondary text-sm leading-relaxed">
            Named values — colors, spacing, radii — that form the single source of truth for your
            design system. They bridge the gap between design tools and code.
          </p>
        </Collapsible>
        <Collapsible variant="card" title="Do I need to learn Tailwind?">
          <p class="text-text-secondary text-sm leading-relaxed">
            No. Every component ships with sensible defaults. Tailwind helps when you want to
            override styles via <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs"
              >slotClasses</code
            >, but it's optional.
          </p>
        </Collapsible>
        <Collapsible variant="card" title="Can I use this with SvelteKit?">
          <p class="text-text-secondary text-sm leading-relaxed">
            Yes. The components are SSR-safe and hydrate without layout shift. See the SvelteKit
            adapter docs for setup details.
          </p>
        </Collapsible>
      </div>
    </CodeExample>

    <!-- Controlled (section toggle) -->
    <CodeExample
      title="Controlled section toggle"
      description="Drive the open state from outside via bind:open — useful for filter panels, settings sections, or any UI that needs to coordinate state with the rest of the page."
      isolate
    >
      <div class="flex w-full max-w-lg flex-col gap-4">
        <div class="flex items-center gap-3">
          <Button size="sm" variant="outlined" onclick={() => (controlledOpen = !controlledOpen)}>
            {controlledOpen ? 'Hide filters' : 'Show filters'}
          </Button>
          <Badge size="xs" intent={controlledOpen ? 'success' : 'neutral'} variant="soft">
            {controlledOpen ? 'open' : 'closed'}
          </Badge>
        </div>
        <Collapsible variant="card" bind:open={controlledOpen} title="Advanced filters">
          <p class="text-text-secondary text-sm">
            This panel is controlled via <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs"
              >bind:open</code
            >. Toggle it with the button above or by clicking the trigger.
          </p>
        </Collapsible>
      </div>
    </CodeExample>

    <!-- Custom trigger -->
    <CodeExample
      title="Release-notes item with custom trigger"
      description="Replace the default trigger via the trigger snippet to surface rich metadata — icons, badges, secondary text — while keeping the expand/collapse mechanics."
      isolate
    >
      <div class="w-full max-w-lg">
        <Collapsible variant="card" defaultOpen>
          {#snippet trigger({
            open,
            toggle
          }: {
            open: boolean;
            toggle: () => void;
            disabled: boolean;
            triggerId: string;
            contentId: string;
          })}
            <button
              onclick={toggle}
              class="hover:bg-surface-hover flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
            >
              <div
                class="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg text-sm"
              >
                📋
              </div>
              <div class="flex-1">
                <p class="text-text-primary text-sm font-semibold">Release Notes v3.2</p>
                <p class="text-text-tertiary text-xs">3 new features, 2 bug fixes</p>
              </div>
              <Badge size="xs" intent={open ? 'primary' : 'neutral'} variant="soft">
                {open ? 'Expanded' : 'Collapsed'}
              </Badge>
            </button>
          {/snippet}
          <div class="space-y-2 px-4 pb-4">
            <p class="text-text-secondary text-sm">
              <strong>Features:</strong> New Collapsible component, improved Accordion internals, Stepper
              navigation.
            </p>
            <p class="text-text-secondary text-sm">
              <strong>Fixes:</strong> Dialog focus trap on Safari, Tooltip positioning near edges.
            </p>
          </div>
        </Collapsible>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <!-- slotClasses -->
    <CodeExample
      title="slotClasses Override"
      description="Restyle individual slots — trigger background, content padding, chevron color."
      isolate
      previewClass="w-full"
    >
      <div class="w-full max-w-lg">
        <Collapsible
          variant="card"
          defaultOpen
          title="Custom styled"
          slotClasses={{
            base: 'border-primary/20',
            trigger: 'hover:text-primary font-semibold',
            chevron: 'text-primary',
            contentInner: 'text-text-secondary text-sm leading-relaxed'
          }}
        >
          Override individual slots without touching the component source. The card gets a
          primary-tinted border, the trigger uses a semibold font, and the chevron matches the
          primary intent.
        </Collapsible>
      </div>
    </CodeExample>

    <!-- Glassmorphism -->
    <CodeExample
      title="Glassmorphism (unstyled)"
      description="Fully custom frosted-glass panel built entirely with class overrides."
      isolate
      previewClass="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8"
    >
      <div class="w-full max-w-lg">
        <Collapsible
          unstyled
          defaultOpen
          title="Frosted Glass"
          class="overflow-hidden rounded-xl"
          slotClasses={{
            trigger:
              'flex w-full items-center justify-between rounded-t-xl bg-white/15 px-5 py-3.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-white/20',
            chevron: 'size-4 text-white/60 transition-transform duration-200',
            contentInner: 'bg-white/10 px-5 py-4 text-sm text-white/80 backdrop-blur-sm'
          }}
        >
          The component strips all defaults in unstyled mode. Every visual detail is hand-crafted
          through class props — background, blur, text color, spacing, and border radius.
        </Collapsible>
      </div>
    </CodeExample>

    <!-- Terminal -->
    <CodeExample
      title="Terminal (unstyled)"
      description="Monospace hacker aesthetic built entirely with class overrides."
      isolate
      previewClass="rounded-2xl bg-neutral-950 p-6"
    >
      <div class="w-full max-w-lg">
        <Collapsible
          unstyled
          defaultOpen
          title="$ cat /etc/config"
          class="font-mono"
          slotClasses={{
            trigger:
              'flex w-full items-center justify-between py-3 text-xs text-emerald-300 transition-colors hover:text-emerald-400',
            chevron: 'size-3.5 text-emerald-400 transition-transform duration-200',
            contentInner: 'pb-3 text-xs leading-relaxed text-emerald-200'
          }}
        >
          <p>NODE_ENV=production</p>
          <p>PORT=3000</p>
          <p>LOG_LEVEL=info</p>
          <p class="mt-2 text-emerald-300">Process exited with code 0</p>
        </Collapsible>
      </div>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      Panel skins that recur (glass, terminal) belong in a <code class="text-text-primary"
        >BlocksProvider</code
      >
      preset (<code class="text-text-primary">presets.Collapsible</code>), applied per instance via
      <code class="text-text-primary">preset</code>
      — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        The default trigger uses <code class="text-text-primary">aria-expanded</code> and
        <code class="text-text-primary">aria-controls</code>
        to link to the content panel. The content panel has
        <code class="text-text-primary">role="region"</code>
        with
        <code class="text-text-primary">aria-labelledby</code>
        pointing back to the trigger. The
        <code class="text-text-primary">data-state</code>
        attribute exposes <code class="text-text-primary">open</code> /
        <code class="text-text-primary">closed</code> for CSS-only styling.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="Tab" />
        moves focus to the trigger.
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />
        toggle the content. Focus rings use
        <code class="text-text-primary">focus-visible:</code> so they only appear on keyboard navigation.
      </p>
    </Note>
    <Note title="Custom Triggers">
      <p>
        When using the <code class="text-text-primary">trigger</code> snippet, the component passes
        <code class="text-text-primary">triggerId</code>
        and
        <code class="text-text-primary">contentId</code>
        so you can wire up
        <code class="text-text-primary">aria-expanded</code>
        and
        <code class="text-text-primary">aria-controls</code> yourself. The content region always
        gets the correct <code class="text-text-primary">aria-labelledby</code>.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        The expand/collapse animation uses CSS
        <code class="text-text-primary">grid-template-rows</code> transitions. When
        <code class="text-text-primary">prefers-reduced-motion</code> is enabled, transition durations
        are reduced via the design token system.
      </p>
    </Note>
  </NoteList>
</Section>
