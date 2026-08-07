<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Badge,
    FileIcon,
    FolderOpenIcon,
    Kbd,
    SparklesIcon,
    SplitPane
  } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let sidebarCollapsed = $state(false);
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="IDE layout — file tree + editor"
      description="The canonical two-pane workspace: a narrow, resizable file tree next to the editor. Each pane clips its own overflow, so long lists and long files scroll independently. Drag the divider or focus it and use the arrow keys; double-click resets to defaultRatio."
      isolate
      previewClass="w-full"
    >
      <div class="border-border-subtle h-80 w-full overflow-hidden rounded-xl border">
        <SplitPane defaultRatio={0.28} min="18%" max="55%">
          {#snippet start()}
            <nav aria-label="Demo sidebar" class="bg-surface-elevated h-full overflow-auto p-3">
              <p class="text-text-tertiary mb-2 px-1 text-xs font-semibold tracking-wide uppercase">
                Explorer
              </p>
              <ul class="space-y-0.5 text-sm">
                <li class="text-text-secondary flex items-center gap-2 px-1 py-1">
                  <FolderOpenIcon class="size-4" /> src
                </li>
                <li class="text-text-secondary flex items-center gap-2 px-1 py-1 pl-5">
                  <FileIcon class="size-4" /> App.svelte
                </li>
                <li
                  class="text-text-primary bg-primary-subtle flex items-center gap-2 rounded px-1 py-1 pl-5 font-medium"
                >
                  <FileIcon class="size-4" /> main.ts
                </li>
                <li class="text-text-secondary flex items-center gap-2 px-1 py-1 pl-5">
                  <FileIcon class="size-4" /> styles.css
                </li>
                <li class="text-text-secondary flex items-center gap-2 px-1 py-1">
                  <FileIcon class="size-4" /> README.md
                </li>
              </ul>
            </nav>
          {/snippet}
          {#snippet end()}
            <main class="h-full overflow-auto p-4 font-mono text-sm">
              <p class="text-text-tertiary">// main.ts</p>
              <p class="text-text-secondary">import App from './App.svelte';</p>
              <p class="text-text-secondary">import './styles.css';</p>
              <p class="text-text-secondary mt-2">export default new App(options);</p>
            </main>
          {/snippet}
        </SplitPane>
      </div>
    </CodeExample>

    <CodeExample
      title="Vertical split — output over log"
      description="Set orientation='vertical' to stack the panes with a horizontal divider. Ideal for a preview or output region above a scrolling console. The arrow-key axis follows the layout: Up/Down resize a vertical split."
      isolate
      previewClass="w-full"
    >
      <div class="border-border-subtle h-96 w-full overflow-hidden rounded-xl border">
        <SplitPane orientation="vertical" defaultRatio={0.55} min="20%" max="85%">
          {#snippet start()}
            <section aria-label="Preview" class="bg-surface-elevated h-full overflow-auto p-4">
              <p class="text-text-primary mb-1 text-sm font-semibold">Preview</p>
              <p class="text-text-secondary text-sm leading-relaxed">
                Rendered output goes here. Resize the divider below to give the log more room when
                you need to read a long stack trace.
              </p>
            </section>
          {/snippet}
          {#snippet end()}
            <section aria-label="Build log" class="h-full overflow-auto p-4 font-mono text-xs">
              <p class="text-success">✓ build succeeded in 412ms</p>
              <p class="text-text-tertiary">→ 24 modules transformed</p>
              <p class="text-text-tertiary">→ dist/index.js 12.4 kB</p>
              <p class="text-text-secondary">! 1 unused export in utils.ts</p>
              <p class="text-text-tertiary">→ watching for changes…</p>
            </section>
          {/snippet}
        </SplitPane>
      </div>
    </CodeExample>

    <CodeExample
      title="Collapsible sidebar with onCollapsedChange"
      description="With collapsible, dragging the first pane below collapseThreshold — or pressing Enter on the focused divider — snaps it fully shut with hysteresis, and onCollapsedChange fires on the transition. Track that flag to swap a 'Show panel' affordance in and out."
      isolate
      previewClass="w-full"
    >
      <div class="w-full space-y-3">
        <div class="flex items-center gap-3">
          <Badge intent={sidebarCollapsed ? 'neutral' : 'success'} variant="soft" size="sm">
            {sidebarCollapsed ? 'sidebar collapsed' : 'sidebar visible'}
          </Badge>
          <span class="text-text-tertiary text-xs"
            >Drag the divider left, or focus it and press Enter.</span
          >
        </div>
        <div class="border-border-subtle h-72 w-full overflow-hidden rounded-xl border">
          <SplitPane
            collapsible
            defaultRatio={0.3}
            min="15%"
            max="60%"
            onCollapsedChange={(c) => (sidebarCollapsed = c)}
          >
            {#snippet start()}
              <nav aria-label="Demo sidebar" class="bg-surface-elevated h-full overflow-auto p-3">
                <p class="text-text-primary mb-2 text-sm font-semibold">Filters</p>
                <ul class="text-text-secondary space-y-1 text-sm">
                  <li>Status</li>
                  <li>Assignee</li>
                  <li>Priority</li>
                  <li>Label</li>
                </ul>
              </nav>
            {/snippet}
            {#snippet end()}
              <main class="h-full overflow-auto p-4">
                <p class="text-text-secondary text-sm leading-relaxed">
                  Main content. Collapse the sidebar to reclaim its width; re-expand it by pressing
                  Enter on the divider — the previous ratio is restored.
                </p>
              </main>
            {/snippet}
          </SplitPane>
        </div>
      </div>
    </CodeExample>

    <CodeExample
      title="Chat beside a live artifact"
      description="An AI pattern: the conversation on the left, the generated artifact on the right. Compose SplitPane with the Chat surfaces — see the Chat component for the message list and PromptInput composer that fill the left pane."
      isolate
      previewClass="w-full"
    >
      <div class="border-border-subtle h-96 w-full overflow-hidden rounded-xl border">
        <SplitPane defaultRatio={0.42} min="25%" max="65%">
          {#snippet start()}
            <div class="flex h-full flex-col">
              <div class="flex-1 space-y-3 overflow-auto p-4">
                <div class="bg-surface-elevated ml-auto max-w-[80%] rounded-2xl px-3 py-2 text-sm">
                  Build me a pricing table.
                </div>
                <div class="text-text-secondary flex max-w-[85%] items-start gap-2 text-sm">
                  <SparklesIcon class="text-primary mt-0.5 size-4 shrink-0" />
                  <span>Done — the component is rendering in the panel on the right.</span>
                </div>
              </div>
              <div class="border-border-subtle border-t p-3">
                <div
                  class="border-border-default text-text-tertiary rounded-xl border px-3 py-2 text-sm"
                >
                  Ask a follow-up…
                </div>
              </div>
            </div>
          {/snippet}
          {#snippet end()}
            <section aria-label="Preview" class="bg-surface-elevated h-full overflow-auto p-6">
              <p class="text-text-primary mb-4 text-sm font-semibold">Artifact preview</p>
              <div class="border-border-subtle grid grid-cols-3 gap-3">
                {#each ['Starter', 'Pro', 'Team'] as tier (tier)}
                  <div class="border-border-subtle rounded-xl border p-3 text-center">
                    <p class="text-text-primary text-sm font-semibold">{tier}</p>
                    <p class="text-text-tertiary text-xs">per month</p>
                  </div>
                {/each}
              </div>
            </section>
          {/snippet}
        </SplitPane>
      </div>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      For a permanent navigation rail rather than two rebalanceable content regions, reach for
      <a href={resolve('/blocks/components/sidebar-layout')} class="text-primary hover:underline"
        >SidebarLayout</a
      >
      or
      <a href={resolve('/blocks/primitives/sidebar')} class="text-primary hover:underline"
        >Sidebar</a
      >
      instead — SplitPane is for when both panes are primary content.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note>
      {#snippet titleSnippet()}
        The "window splitter" pattern
      {/snippet}
      <p>
        The divider follows the WAI-ARIA <em>window splitter</em> pattern. It renders as
        <code class="text-text-primary">role="separator"</code>
        made focusable (<code class="text-text-primary">tabindex="0"</code>), carries
        <code class="text-text-primary">aria-controls</code>
        pointing at the first pane, and exposes its position as
        <code class="text-text-primary">aria-valuenow</code>
        /
        <code class="text-text-primary">aria-valuemin</code>
        /
        <code class="text-text-primary">aria-valuemax</code>
        (percentages, clamped into the configured
        <code class="text-text-primary">min</code>/<code class="text-text-primary">max</code>). Its
        <code class="text-text-primary">aria-orientation</code>
        is the axis of movement — <code class="text-text-primary">vertical</code> for a horizontal
        layout, <code class="text-text-primary">horizontal</code> for a vertical one. Give it a
        meaningful name via <code class="text-text-primary">handleLabel</code> (default "Resize
        panes"). When <code class="text-text-primary">disabled</code>, the divider drops out of the
        tab order and reports <code class="text-text-primary">aria-disabled</code>.
      </p>
    </Note>
    <Note title="Keyboard">
      <div class="text-text-secondary space-y-2 text-sm leading-relaxed">
        <p>
          <Kbd keys="Tab" />
          moves focus to the divider. The arrow keys follow the layout axis:
        </p>
        <ul class="ml-1 space-y-1.5">
          <li>
            <Kbd keys="←" />
            /
            <Kbd keys="→" />
            (horizontal) or
            <Kbd keys="↑" />
            /
            <Kbd keys="↓" />
            (vertical) resize by ±2%.
          </li>
          <li>
            Hold
            <Kbd keys="Shift" />
            with an arrow for a ±10% step.
          </li>
          <li>
            <Kbd keys="Home" />
            /
            <Kbd keys="End" />
            jump to the <code class="text-text-primary">min</code> /
            <code class="text-text-primary">max</code> limit.
          </li>
          <li>
            <Kbd keys="Enter" />
            toggles collapse when <code class="text-text-primary">collapsible</code> is set;
            otherwise it resets to <code class="text-text-primary">defaultRatio</code> — the keyboard
            equivalent of the double-click reset.
          </li>
        </ul>
      </div>
    </Note>
    <Note title="Pointer & touch target">
      <p>
        Drag uses <code class="text-text-primary">setPointerCapture</code>, so a resize keeps
        tracking even if the pointer leaves the divider — no stray window listeners to leak. The
        divider is a comfortable, full-length hit area along the split axis rather than a hairline,
        keeping it reachable for touch and coarse pointers. The
        <code class="text-text-primary">data-dragging</code>
        and <code class="text-text-primary">data-collapsed</code> attributes on the root expose the live
        state for CSS-only styling.
      </p>
    </Note>
  </NoteList>
</Section>
