<!-- urbicon-ignore raw-tailwind-color — the Customization demo tints the panel into a glass look
     with `class` + `slotClasses`: it keeps the card radius tier, padding and the grid-rows expand
     animation, and only the fill, border, blur and text are raw — a frosted-glass look the token
     palette has no equivalent for. Every other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Badge, Button, ClipboardListIcon, Collapsible, Kbd } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let controlledOpen = $state(false);
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    A Collapsible is a single panel: <code class="text-text-primary">title</code> sets its trigger
    text and the default slot is the content it reveals. Leave it uncontrolled with
    <code class="text-text-primary">defaultOpen</code>, or drive it from your own state with
    <code class="text-text-primary">bind:open</code>. For a set of panels where only one stays open
    at a time, reach for Accordion instead.
  </p>

  <div class="space-y-8">
    <!-- FAQ item -->
    <CodeExample
      title="FAQ item"
      description="Stack independent Collapsibles to build a FAQ list where any number of panels can be open at once."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <div class="flex w-full max-w-lg flex-col gap-3">
        <Collapsible variant="card" title="What are design tokens?" defaultOpen>
          <p class="text-text-secondary text-sm leading-relaxed">
            Named values (colors, spacing, radii) that form the single source of truth for your
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
      description="Drive the open state from outside via bind:open. Useful for filter panels, settings sections, or any UI that coordinates state with the rest of the page."
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
      description="Replace the default trigger via the trigger snippet to surface rich metadata (icons, badges, secondary text) while keeping the expand/collapse mechanics."
      isolate
    >
      <div class="w-full max-w-lg">
        <Collapsible variant="card" defaultOpen>
          {#snippet trigger({
            open,
            toggle,
            triggerId,
            contentId
          }: {
            open: boolean;
            toggle: () => void;
            triggerId: string;
            contentId: string;
          })}
            <button
              id={triggerId}
              type="button"
              onclick={toggle}
              aria-expanded={open}
              aria-controls={contentId}
              class="hover:bg-surface-hover focus-visible:ring-primary/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
            >
              <div
                class="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg"
              >
                <ClipboardListIcon size={16} />
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

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Frosted glass"
      description="`class` tints the panel and `slotClasses` recolours the trigger, chevron and content. It keeps the card radius tier, padding and the expand animation. Only the fill, border, blur and text change, in raw colours because glass has no token equivalent."
      isolate
      previewClass="flex justify-center rounded-xl bg-linear-to-br from-rose-500 via-fuchsia-500 to-indigo-500 px-8 py-10"
    >
      <div class="w-full max-w-sm">
        <Collapsible
          variant="card"
          defaultOpen
          title="Frosted Glass"
          class="border-white/20 bg-white/10 shadow-[var(--blocks-shadow-lg)] backdrop-blur-xl"
          slotClasses={{
            trigger: 'text-white hover:text-white',
            chevron: 'text-white/60',
            contentInner: 'text-sm text-white/80'
          }}
        >
          Frosted surfaces read best over a photograph or gradient, where the blur lifts the panel
          off the busy background behind it.
        </Collapsible>
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
        The expand/collapse is tied to the
        <code class="text-text-primary">--blocks-collapse-duration</code>
        token. Under <code class="text-text-primary">prefers-reduced-motion</code> that token collapses
        to 1 ms, so the panel opens and closes without a visible slide.
      </p>
    </Note>
  </NoteList>
</Section>
