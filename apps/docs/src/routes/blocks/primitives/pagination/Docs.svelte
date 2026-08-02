<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Pagination } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let pg3 = $state(7);
  let pg6 = $state(1);
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Layouts"
      description="Four layout presets cover the common contexts: a full page bar for list views, prev/next-only for article flows, a table footer with row counts, and a minimal page indicator for tight UI."
      isolate
      previewClass="flex flex-col gap-10"
    >
      <div class="flex flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Default — full page bar
        </p>
        <Pagination
          currentPage={pg3}
          totalPages={20}
          showFirstLast
          visiblePages={5}
          onPageChange={(p: number) => (pg3 = p)}
        />
      </div>
      <div class="flex flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Navigation — prev / next only
        </p>
        <Pagination
          currentPage={pg3}
          totalPages={20}
          layout="navigation"
          onPageChange={(p: number) => (pg3 = p)}
        />
      </div>
      <div class="flex flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Table — info + controls
        </p>
        <Pagination
          currentPage={pg3}
          totalPages={20}
          layout="table"
          itemsPerPage={25}
          totalItems={500}
          onPageChange={(p: number) => (pg3 = p)}
        />
      </div>
      <div class="flex flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Minimal — page indicator
        </p>
        <Pagination currentPage={pg3} totalPages={20} layout="minimal" />
      </div>
    </CodeExample>

    <CodeExample
      title="Data Table Row"
      description="Table layout embedded in a surface panel — a common real-world pattern."
      isolate
      previewClass="w-full"
    >
      <div class="border-border-subtle bg-surface-elevated rounded-xl border px-5 py-3">
        <Pagination
          currentPage={pg6}
          totalPages={42}
          layout="table"
          variant="ghost"
          intent="neutral"
          size="sm"
          itemsPerPage={25}
          totalItems={1042}
          onPageChange={(p: number) => (pg6 = p)}
        />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="slotClasses Override"
      description="Widen the gap, tint the info text, and style the ellipsis."
      isolate
    >
      <Pagination
        currentPage={pg6}
        totalPages={15}
        showInfo
        slotClasses={{
          base: 'gap-2',
          info: 'text-primary font-medium',
          ellipsis: 'text-danger font-bold'
        }}
        onPageChange={(p: number) => (pg6 = p)}
      />
    </CodeExample>

    <CodeExample
      title="Pill Buttons"
      description="Round buttons via slotClasses on the controls slot."
      isolate
    >
      <Pagination
        currentPage={pg6}
        totalPages={10}
        variant="filled"
        intent="secondary"
        slotClasses={{ controls: '[&>*]:rounded-full' }}
        onPageChange={(p: number) => (pg6 = p)}
      />
    </CodeExample>

    <CodeExample
      title="Terminal Style (unstyled)"
      description="Drop all defaults for a monospace, dark-themed pagination."
      isolate
      previewClass="rounded-xl bg-neutral-950 px-6 py-4"
    >
      <Pagination
        unstyled
        currentPage={4}
        totalPages={12}
        showInfo
        showNumbers={false}
        variant="ghost"
        intent="neutral"
        class="terminal-pagination flex items-center justify-between gap-4 font-mono text-sm text-emerald-300"
        slotClasses={{
          info: 'tabular-nums text-emerald-300',
          controls: 'flex gap-2'
        }}
        previousLabel="← prev"
        nextLabel="next →"
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      Used on more than one list, the pill or terminal styles above become one
      <code class="text-text-primary">BlocksProvider</code> preset (<code class="text-text-primary"
        >presets.Pagination</code
      >) applied via <code class="text-text-primary">preset</code> — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        The root <code class="text-text-primary">&lt;nav&gt;</code> carries
        <code class="text-text-primary">role="navigation"</code> and an
        <code class="text-text-primary">aria-label</code>. The active page button sets
        <code class="text-text-primary">aria-current="page"</code>. Disabled boundary buttons expose
        <code class="text-text-primary">aria-disabled</code> so screen readers can announce their state.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <kbd
          class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
          >Tab</kbd
        >
        moves focus between pagination buttons in DOM order.
        <kbd
          class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
          >Enter</kbd
        >
        /
        <kbd
          class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
          >Space</kbd
        >
        activates the focused button. First/last, prev/next, and numbered buttons are all focusable in
        natural tab order.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        Mint effects respect
        <code class="text-text-primary">prefers-reduced-motion</code>. Transitions and hover/active
        feedback are reduced or removed when the user has requested less motion.
      </p>
    </Note>
  </NoteList>
</Section>

<style>
  /* Terminal-style pagination: force emerald text on every nested button/link.
     Tailwind child-selector utilities lose the specificity war against the
     Button component's compound variant classes, so plain CSS with
     :where() keeps the override simple without raising specificity noise. */
  :global(.terminal-pagination :is(button, a)),
  :global(.terminal-pagination :is(button, a) *) {
    color: var(--color-emerald-300);
  }
  :global(.terminal-pagination :is(button, a):hover),
  :global(.terminal-pagination :is(button, a):hover *) {
    color: var(--color-emerald-200);
  }
</style>
