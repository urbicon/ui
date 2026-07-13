<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Button, Drawer, Input, Separator, Toggle } from '@urbicon-ui/blocks';
  import { r } from '$lib/route';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['placement', 'size', 'hideCloseButton'],
        defaults: { placement: 'right', size: 'md' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'variants', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Drawer Component', showToc: true }
  };

  let rightOpen = $state(false);
  let leftOpen = $state(false);
  let topOpen = $state(false);
  let bottomOpen = $state(false);
  let settingsOpen = $state(false);
  let navOpen = $state(false);
  let footerOpen = $state(false);
</script>

<!-- ─── When to use ─── -->

<Section marker="01" id="usage" title="When to use">
  <p class="text-text-secondary text-sm leading-relaxed">
    <strong>Drawer</strong> is a <code>&lt;dialog&gt;</code> — always modal, with a backdrop and a
    focus trap. Use it for a transient panel that opens on user action, pulls focus, and closes when
    the action is done. The four <code>placement</code> values (left / right / top / bottom) cover side
    sheets, top notification bars, and mobile bottom-sheets.
  </p>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    Pick a different overlay if you need:
  </p>
  <ul class="text-text-secondary mt-2 list-inside list-disc space-y-1.5 text-sm">
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

<Section marker="02" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample title="Placements" isolate>
      <Button variant="outlined" onclick={() => (leftOpen = true)}>Left</Button>
      <Button variant="outlined" onclick={() => (rightOpen = true)}>Right</Button>
      <Button variant="outlined" onclick={() => (topOpen = true)}>Top</Button>
      <Button variant="outlined" onclick={() => (bottomOpen = true)}>Bottom</Button>

      <Drawer bind:open={leftOpen} title="Left Drawer" placement="left">
        <p>This drawer slides in from the left edge.</p>
      </Drawer>
      <Drawer bind:open={rightOpen} title="Right Drawer" placement="right">
        <p>This drawer slides in from the right edge.</p>
      </Drawer>
      <Drawer bind:open={topOpen} title="Top Drawer" placement="top">
        <p>This drawer slides in from the top edge.</p>
      </Drawer>
      <Drawer bind:open={bottomOpen} title="Bottom Drawer" placement="bottom">
        <p>This drawer slides in from the bottom edge.</p>
      </Drawer>
    </CodeExample>

    <CodeExample
      title="With Footer"
      description="Action buttons rendered in a sticky footer area."
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
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Settings Panel"
      description="A realistic settings drawer with form controls."
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
      description="A mobile-style navigation drawer from the left."
      isolate
    >
      <Button onclick={() => (navOpen = true)}>Open Menu</Button>
      <Drawer bind:open={navOpen} title="Menu" placement="left" size="sm">
        <nav class="flex flex-col gap-1">
          {#each ['Dashboard', 'Projects', 'Team', 'Settings', 'Help'] as item (item)}
            <button
              class="text-text-primary hover:bg-surface-subtle rounded-modify px-3 py-2.5 text-left text-sm transition-colors"
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

<!-- ─── Stacking & Nesting ─── -->

<Section marker="04" id="stacking" title="Stacking & Nested Drawers">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <p class="text-text-secondary mb-4 text-sm leading-relaxed">
      Multiple Drawers can be open at the same time — for example a wizard that opens a preview,
      which opens a calculation trace. Drawer is rendered with a native
      <code class="text-text-primary">&lt;dialog&gt;</code>, so the browser handles the top-layer
      stacking order automatically.
    </p>
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Stack order is LIFO</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The most recently opened Drawer renders on top. Pressing
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          closes the topmost drawer; the underlying ones stay open. Each Drawer manages its own focus-trap,
          so keyboard navigation stays inside the topmost panel.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Backdrop & body-scroll</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Each open Drawer adds its own backdrop. The body-scroll lock is reference-counted — scroll
          stays locked until <em>every</em> Drawer is closed. Closing the topmost panel revives keyboard
          interaction with the panel underneath.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Recommended depth: 2–3</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Two or three layers (e.g. <em>wizard → preview → trace</em>) work well in practice. Beyond
          that, the visual stack becomes cramped, especially on mobile. Consider a
          <em>master-detail</em> pattern (list + replaceable detail panel) instead of deep nesting.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Mobile caveat</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Each Drawer caps its size at <code class="text-text-primary">100dvw</code> /
          <code class="text-text-primary">100dvh</code>, so a stacked Drawer on a 320 px viewport
          becomes effectively full-width. Two or three identical-size Drawers stack visually as a
          single panel — open them with different sizes (e.g. <code>md</code> →
          <code>lg</code>) so the user can see the layering on narrow screens.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">
          Programmatic <code class="text-text-primary">overlayStack</code>
        </h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Drawer, Dialog, and (mobile) Sidebar all auto-register with a shared
          <code class="text-text-primary">overlayStack</code> singleton on open. Use this for app-level
          cleanup that has to span unknown overlay depth — typically logout, route changes, or auth expiry.
          The stack stays untouched on Desktop sidebars (they're persistent layout, not modal overlays).
        </p>
        <pre class="text-text-primary bg-surface-subtle rounded-modify mt-2 p-3 text-xs"><code
            >{`import { overlayStack } from '@urbicon-ui/blocks';

// Close every open Drawer, Dialog, and mobile Sidebar (top-down)
overlayStack.closeAll();

// Inspect the stack
overlayStack.depth;   // number
overlayStack.topId;   // string | null`}</code
          ></pre>
      </div>
    </div>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="05" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Focus Trap</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          When open, focus is trapped inside the drawer panel.
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          cycles through focusable elements. On close, focus returns to the element that triggered the
          drawer.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Uses native <code class="text-text-primary">&lt;dialog&gt;</code> with
          <code class="text-text-primary">aria-labelledby</code> linked to the title and
          <code class="text-text-primary">aria-describedby</code> linked to the body content. The
          close button has an <code class="text-text-primary">aria-label</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          closes the drawer (configurable via
          <code class="text-text-primary">closeOnEscape</code>). Backdrop click dismiss is also
          configurable.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Slide and fade transitions respect
          <code class="text-text-primary">prefers-reduced-motion</code>. The drawer appears and
          disappears instantly without animation.
        </p>
      </div>
    </div>
  </div>
</Section>
