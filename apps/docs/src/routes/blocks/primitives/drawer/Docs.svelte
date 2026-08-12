<!-- urbicon-ignore raw-tailwind-color — the Customization demo tints the drawer panel into a
     frosted-glass sheet with `class` + `slotClasses`: it keeps the drawer's contain radius tier,
     slide animation, focus trap and scroll lock, and only the fill, borders and blur are raw — a
     glass look the token palette has no equivalent for. Every other section on this page stays
     under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Drawer, Input, Kbd, Separator, Toggle } from '@urbicon-ui/blocks';
  import { r } from '$lib/route';

  let settingsOpen = $state(false);
  let navOpen = $state(false);
  let footerOpen = $state(false);
  let glassOpen = $state(false);
</script>

<!-- ─── When to use ─── -->

<Section marker id="usage" title="When to use">
  <p class="text-text-secondary text-sm leading-relaxed">
    <strong>Drawer</strong> is a <code>&lt;dialog&gt;</code>: always modal, with a backdrop and a
    focus trap. Use it for a transient panel that opens on user action, pulls focus, and closes when
    the action is done. The four <code>placement</code> values (left / right / top / bottom) cover side
    sheets, top notification bars, and mobile bottom-sheets.
  </p>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    Pick a different overlay if you need:
  </p>
  <ul class="text-text-secondary mt-2 list-outside list-disc space-y-1.5 pl-5 text-sm">
    <li>
      A side panel that is <em>part of the page layout</em> (persistent on desktop, no backdrop) →
      <a href={r('/blocks/primitives/sidebar')} class="text-primary hover:underline">Sidebar</a>.
    </li>
    <li>
      A floating panel anchored to a specific trigger element (date picker, action list) →
      <a href={r('/blocks/primitives/popover')} class="text-primary hover:underline">Popover</a>.
    </li>
    <li>
      A centered modal for confirmations or short forms →
      <a href={r('/blocks/primitives/dialog')} class="text-primary hover:underline">Dialog</a>.
    </li>
  </ul>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="With Footer"
      description="bind:open drives the drawer from your own trigger. A title gives it a header with a built-in close button, and the footer snippet holds the actions."
      isolate
    >
      <Button onclick={() => (footerOpen = true)}>Open with Footer</Button>
      <Drawer bind:open={footerOpen} title="Confirm Changes">
        <p>Are you sure you want to apply these changes? This action cannot be undone.</p>
        {#snippet footer()}
          <Button variant="ghost" onclick={() => (footerOpen = false)}>Cancel</Button>
          <Button intent="primary" onclick={() => (footerOpen = false)}>Confirm</Button>
        {/snippet}
      </Drawer>
    </CodeExample>

    <CodeExample
      title="Settings Panel"
      description="placement sets the edge the drawer slides from and size its width. Here, the right edge at sm."
      isolate
    >
      <Button onclick={() => (settingsOpen = true)}>Open Settings</Button>
      <Drawer bind:open={settingsOpen} title="Settings" placement="right" size="sm">
        <div class="space-y-4">
          <Input label="Display name" placeholder="Your name" />
          <Input label="Email" placeholder="name@example.com" type="email" />
          <Separator />
          <Toggle label="Email notifications" checked />
          <Toggle label="Dark mode" />
          <Toggle label="Analytics" checked />
        </div>
        {#snippet footer()}
          <Button variant="ghost" onclick={() => (settingsOpen = false)}>Cancel</Button>
          <Button intent="primary" onclick={() => (settingsOpen = false)}>Save</Button>
        {/snippet}
      </Drawer>
    </CodeExample>

    <CodeExample
      title="Navigation Menu"
      description="A left-side navigation menu, the common mobile pattern. Each item closes the drawer when picked."
      isolate
    >
      <Button onclick={() => (navOpen = true)}>Open Menu</Button>
      <Drawer bind:open={navOpen} title="Menu" placement="left" size="sm">
        <nav class="flex flex-col gap-1">
          {#each ['Dashboard', 'Projects', 'Team', 'Settings', 'Help'] as item (item)}
            <button
              class="text-text-primary hover:bg-surface-hover rounded-modify px-3 py-2.5 text-left text-sm transition-colors"
              onclick={() => (navOpen = false)}
            >
              {item}
            </button>
          {/each}
        </nav>
      </Drawer>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Frosted glass sheet"
      description="Tint the panel into frosted glass with `class`, wash the backdrop in colour, and neutralise the header and footer hairlines with `slotClasses`. The contain radius tier, slide animation, focus trap and scroll lock all stay. Raw colours because glass has no token equivalent."
      code={`<Drawer
  bind:open
  title="Filters"
  placement="right"
  size="sm"
  class="border-white/20 bg-white/10 text-white backdrop-blur-xl"
  slotClasses={{
    backdrop: 'bg-linear-to-br from-fuchsia-600/50 via-purple-600/50 to-indigo-700/50',
    header: 'border-white/15',
    title: 'text-white',
    closeButton: 'text-white/70 hover:bg-white/10',
    footer: 'border-white/15'
  }}
>
  …
</Drawer>`}
    >
      <Button variant="ghost" onclick={() => (glassOpen = true)}>Open glass panel</Button>
      <Drawer
        bind:open={glassOpen}
        title="Filters"
        placement="right"
        size="sm"
        class="border-white/20 bg-white/10 text-white backdrop-blur-xl"
        slotClasses={{
          backdrop: 'bg-linear-to-br from-fuchsia-600/50 via-purple-600/50 to-indigo-700/50',
          header: 'border-white/15',
          title: 'text-white',
          closeButton: 'text-white/70 hover:bg-white/10',
          footer: 'border-white/15'
        }}
      >
        <div class="space-y-3 text-sm text-white/90">
          {#each ['Available now', 'Free cancellation', 'Breakfast included', 'Pet friendly'] as label (label)}
            <label class="flex items-center gap-3">
              <input type="checkbox" class="h-4 w-4 accent-white" />
              {label}
            </label>
          {/each}
        </div>
        {#snippet footer()}
          <Button
            variant="ghost"
            class="border-transparent text-white/80 hover:bg-white/10"
            onclick={() => (glassOpen = false)}>Clear</Button
          >
          <Button
            class="border-white/20 bg-white/15 text-white shadow-none hover:bg-white/25"
            onclick={() => (glassOpen = false)}>Apply</Button
          >
        {/snippet}
      </Drawer>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={r('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Stacking & Nesting ─── -->

<Section marker id="stacking" title="Stacking & Nested Drawers">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Several Drawers can be open at once: a wizard that opens a preview, which opens a calculation
    trace. Each renders through its own native <code class="text-text-primary">&lt;dialog&gt;</code
    >, so the browser stacks them in the top layer for you.
  </p>

  <NoteList>
    <Note title="Stack order is LIFO">
      <p>
        The most recently opened Drawer renders on top.
        <Kbd keys="Escape" /> closes that topmost panel and leaves the ones beneath it open. Each Drawer
        keeps its own focus trap, so keyboard focus stays inside the top panel.
      </p>
    </Note>
    <Note title="Backdrop and body scroll">
      <p>
        Every open Drawer adds its own backdrop. The body-scroll lock is reference-counted: the page
        stays locked until the last Drawer closes, and closing the top panel hands keyboard control
        back to the one underneath.
      </p>
    </Note>
    <Note title="Keep the depth to two or three">
      <p>
        A wizard, then a preview, then a trace reads well; past three layers the panels crowd each
        other, especially on mobile. For a deeper flow, reach for a master-detail pattern (a list
        beside one replaceable detail panel) instead of nesting.
      </p>
    </Note>
    <Note title="Vary the size on narrow screens">
      <p>
        Each Drawer caps at <code class="text-text-primary">100dvw</code> /
        <code class="text-text-primary">100dvh</code>, so on a 320px viewport a stacked Drawer fills
        the screen and identical sizes merge into one panel. Give stacked Drawers different sizes (<code
          class="text-text-primary">md</code
        >
        then <code class="text-text-primary">lg</code>) so the layering stays legible.
      </p>
    </Note>
    <Note title="Close every overlay at once">
      <p>
        Drawer, Dialog, and the mobile Sidebar register with a shared
        <code class="text-text-primary">overlayStack</code> singleton on open. Reach for it when app-level
        cleanup spans an unknown overlay depth: logout, a route change, or an expired session. Desktop
        Sidebars stay out of the stack, since they are persistent layout rather than modal overlays.
      </p>
    </Note>
  </NoteList>

  <div class="mt-6">
    <CodeExample
      title="overlayStack"
      code={`import { overlayStack } from '@urbicon-ui/blocks';

// Close every open Drawer, Dialog, and mobile Sidebar (top-down)
overlayStack.closeAll();

// Inspect the stack
overlayStack.depth; // number
overlayStack.topId; // string | null`}
      language="ts"
      preview={false}
    />
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Focus Trap">
      <p>
        When open, focus is trapped inside the drawer panel.
        <Kbd keys="Tab" />
        cycles through focusable elements. On close, focus returns to the element that triggered the drawer.
      </p>
    </Note>
    <Note title="ARIA">
      <p>
        Uses native <code class="text-text-primary">&lt;dialog&gt;</code> with
        <code class="text-text-primary">aria-labelledby</code> linked to the title and
        <code class="text-text-primary">aria-describedby</code> linked to the body content. The
        close button has an <code class="text-text-primary">aria-label</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Escape" />
        closes the drawer (<code class="text-text-primary">closeOnEscape</code>) and so does a click
        on the backdrop (<code class="text-text-primary">closeOnBackdropClick</code>). Both are on
        by default.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        The slide and fade run on the overlay duration tokens (<code class="text-text-primary"
          >--blocks-overlay-enter-duration</code
        >
        /
        <code class="text-text-primary">--blocks-overlay-exit-duration</code>). Under
        <code class="text-text-primary">prefers-reduced-motion</code> they collapse to 1ms, so the drawer
        opens and closes in place.
      </p>
    </Note>
  </NoteList>
</Section>
