<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Dialog, Button, Input } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let basicOpen = $state(false);
  let topOpen = $state(false);
  let formOpen = $state(false);
  let scrollOpen = $state(false);
  let customOpen = $state(false);
  let unstyledOpen = $state(false);

  let formName = $state('');
  let formEmail = $state('');
</script>

<!-- Examples: Confirmation (content-only) -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Confirmation (content-only)"
      description="Without a title prop, Dialog renders your content directly — ideal for short confirmation flows with full layout freedom."
      code={`<Dialog bind:open>
  <p class="text-text-primary text-sm font-medium">Delete this item?</p>
  <p class="text-text-tertiary mt-1 text-sm">This action cannot be undone.</p>
  <div class="flex justify-end gap-2 mt-4">
    <Button variant="ghost" onclick={() => open = false}>Cancel</Button>
    <Button intent="danger" onclick={() => open = false}>Delete</Button>
  </div>
</Dialog>`}
    >
      <Button intent="danger" variant="outlined" onclick={() => (basicOpen = true)}>
        Delete Item
      </Button>
      <Dialog bind:open={basicOpen}>
        <div class="flex gap-4">
          <div
            class="bg-danger/10 text-danger flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          >
            <svg
              class="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </div>
          <div>
            <p class="text-text-primary text-sm font-medium">Delete this item?</p>
            <p class="text-text-tertiary mt-1 text-sm">
              This action is permanent. All associated data will be removed and cannot be recovered.
            </p>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onclick={() => (basicOpen = false)}>Cancel</Button>
          <Button intent="danger" onclick={() => (basicOpen = false)}>Delete</Button>
        </div>
      </Dialog>
    </CodeExample>

    <!-- Examples: Form Dialog (structured) -->

    <CodeExample
      title="Form Dialog"
      description="Pass a title to enable the structured layout with header, scrollable body, and footer — the standard pattern for forms and editors."
      code={`<Dialog bind:open title="Create Account" size="md">
  <form>
    <Input label="Name" bind:value={name} />
    <Input label="Email" bind:value={email} />
  </form>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => open = false}>Cancel</Button>
    <Button type="submit">Create</Button>
  {/snippet}
</Dialog>`}
    >
      <Button onclick={() => (formOpen = true)}>Create Account</Button>
      <Dialog bind:open={formOpen} title="Create Account" size="md">
        <form
          class="space-y-3"
          onsubmit={(e: SubmitEvent) => {
            e.preventDefault();
            formOpen = false;
          }}
        >
          <Input label="Full Name" bind:value={formName} placeholder="Jane Doe" />
          <Input label="Email" type="email" bind:value={formEmail} placeholder="jane@example.com" />
        </form>
        {#snippet footer()}
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onclick={() => (formOpen = false)}>Cancel</Button>
            <Button onclick={() => (formOpen = false)}>Create</Button>
          </div>
        {/snippet}
      </Dialog>
    </CodeExample>

    <!-- Examples: Top Placement (command palette) -->

    <CodeExample
      title="Top Placement (command palette)"
      description="Use placement='top' for search or command-palette flows — anchored near the top of the viewport so results don't shift below the fold as users type."
      code={`<Dialog bind:open placement="top" size="md">
  <input type="text" placeholder="Search..." />
  ...results...
</Dialog>`}
    >
      <Button variant="outlined" onclick={() => (topOpen = true)}>Open Search</Button>
      <Dialog bind:open={topOpen} placement="top" size="md">
        <div class="border-border-subtle flex items-center gap-2 border-b pb-3">
          <svg
            class="text-text-tertiary h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Search commands..."
            class="text-text-primary placeholder:text-text-tertiary w-full border-none bg-transparent text-sm outline-none"
          />
          <kbd
            class="bg-surface-base border-border-subtle text-text-tertiary rounded-modify border px-1.5 py-0.5 text-xs"
          >
            Esc
          </kbd>
        </div>
        <div class="space-y-1 pt-3">
          {#each ['Create new project', 'Open settings', 'Switch workspace', 'View documentation'] as item (item)}
            <button
              class="text-text-secondary hover:bg-surface-hover rounded-modify w-full px-2 py-1.5 text-left text-sm transition-colors"
              onclick={() => (topOpen = false)}
            >
              {item}
            </button>
          {/each}
        </div>
      </Dialog>
    </CodeExample>

    <!-- Examples: Scrollable Content -->

    <CodeExample
      title="Scrollable Content"
      description="Long body content scrolls automatically while header and footer stay pinned — useful for terms, changelogs, or any read-heavy dialog."
      code={`<Dialog bind:open title="Terms of Service" size="lg">
  <div class="space-y-4"><p>Long content here...</p></div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => open = false}>Decline</Button>
    <Button onclick={() => open = false}>Accept</Button>
  {/snippet}
</Dialog>`}
    >
      <Button variant="outlined" onclick={() => (scrollOpen = true)}>View Terms</Button>
      <Dialog bind:open={scrollOpen} title="Terms of Service" size="lg">
        <div class="space-y-4">
          <h3 class="text-text-primary text-sm font-semibold">1. Acceptance of Terms</h3>
          <p>
            By accessing and using this service, you acknowledge that you have read, understood, and
            agree to be bound by these Terms of Service.
          </p>
          <h3 class="text-text-primary text-sm font-semibold">2. Use License</h3>
          <p>
            Permission is granted to temporarily use this service for personal, non-commercial
            transitory viewing only.
          </p>
          <h3 class="text-text-primary text-sm font-semibold">3. User Responsibilities</h3>
          <p>
            Users are responsible for maintaining the confidentiality of their account credentials
            and for all activities that occur under their account.
          </p>
          <h3 class="text-text-primary text-sm font-semibold">4. Privacy Policy</h3>
          <p>
            Your use of this service is also governed by our Privacy Policy, which is incorporated
            into these terms by reference.
          </p>
          <h3 class="text-text-primary text-sm font-semibold">5. Intellectual Property</h3>
          <p>
            All content, features, and functionality of this service are owned by us and are
            protected by international copyright, trademark, and other intellectual property laws.
          </p>
          <h3 class="text-text-primary text-sm font-semibold">6. Limitation of Liability</h3>
          <p>
            In no event shall we be liable for any indirect, incidental, special, consequential, or
            punitive damages.
          </p>
        </div>
        {#snippet footer()}
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onclick={() => (scrollOpen = false)}>Decline</Button>
            <Button onclick={() => (scrollOpen = false)}>Accept</Button>
          </div>
        {/snippet}
      </Dialog>
    </CodeExample>
  </div>
</Section>

<!-- Customization -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Slot Class Overrides"
      description="Fine-tune individual slots without going fully unstyled."
      code={`<Dialog
  bind:open
  title="Quick Settings"
  slotClasses={{
    panel: 'rounded-2xl',
    header: 'bg-surface-subtle',
    body: 'bg-surface-base',
    footer: 'bg-surface-subtle'
  }}
>
  ...
</Dialog>`}
    >
      <Button variant="outlined" onclick={() => (customOpen = true)}>Quick Settings</Button>
      <Dialog
        bind:open={customOpen}
        title="Quick Settings"
        slotClasses={{
          panel: 'rounded-2xl',
          header: 'bg-surface-subtle',
          body: 'bg-surface-base',
          footer: 'bg-surface-subtle'
        }}
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-text-primary text-sm">Dark Mode</span>
            <span class="text-text-tertiary text-sm">System</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-text-primary text-sm">Notifications</span>
            <span class="text-text-tertiary text-sm">On</span>
          </div>
        </div>
        {#snippet footer()}
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onclick={() => (customOpen = false)}>Cancel</Button>
            <Button onclick={() => (customOpen = false)}>Save</Button>
          </div>
        {/snippet}
      </Dialog>
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Strip defaults with unstyled and rebuild the look entirely via slotClasses."
      code={`<Dialog
  unstyled
  bind:open
  slotClasses={{
    dialog: 'fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4',
    backdrop: 'fixed inset-0 bg-black/80',
    panel: 'relative w-full max-w-xs border border-green-500/30 bg-black text-green-400',
    content: 'p-5 font-mono text-xs'
  }}
>
  ...
</Dialog>`}
    >
      <Button variant="ghost" onclick={() => (unstyledOpen = true)}>Launch Terminal</Button>
      <Dialog
        unstyled
        bind:open={unstyledOpen}
        slotClasses={{
          dialog: 'fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4',
          backdrop: 'fixed inset-0 bg-black/80',
          panel:
            'relative w-full max-w-xs border border-green-500/30 bg-black text-green-400 rounded-none shadow-[0_0_30px_rgba(34,197,94,0.15)]',
          content: 'p-5 font-mono text-xs'
        }}
      >
        <div class="mb-3 flex items-center gap-2 border-b border-green-500/20 pb-2">
          <span class="inline-block h-2 w-2 rounded-full bg-green-500"></span>
          <span class="text-3xs tracking-widest text-green-500/70 uppercase">System</span>
        </div>
        <p class="leading-relaxed opacity-80">
          &gt; Connection established.<br />
          &gt; Awaiting confirmation...<br />
          &gt; Proceed? [Y/n]
        </p>
        <div class="mt-4 flex gap-2">
          <button
            class="flex-1 cursor-pointer rounded-none border border-green-500/30 bg-transparent px-3 py-1.5 font-mono text-xs text-green-400 transition-colors hover:bg-green-500/10"
            onclick={() => (unstyledOpen = false)}
          >
            [n] Abort
          </button>
          <button
            class="flex-1 cursor-pointer rounded-none border border-green-500 bg-green-500/10 px-3 py-1.5 font-mono text-xs text-green-400 transition-colors hover:bg-green-500/20"
            onclick={() => (unstyledOpen = false)}
          >
            [Y] Confirm
          </button>
        </div>
      </Dialog>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A dialog chrome shared across the app belongs in <code class="text-text-primary"
        >presets.Dialog</code
      >
      on
      <code class="text-text-primary">BlocksProvider</code> — and because ConfirmDialog forwards its
      styling props to the inner Dialog, the same preset covers both components. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- Accessibility -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Native Dialog">
      <p>
        Built on <code class="text-text-primary">&lt;dialog&gt;</code> with
        <code class="text-text-primary">showModal()</code> for native inertness and stacking
        context. Screen readers announce it automatically via
        <code class="text-text-primary">aria-modal="true"</code>. When a
        <code class="text-text-primary">title</code> is set, it is linked via
        <code class="text-text-primary">aria-labelledby</code>.
      </p>
    </Note>
    <Note title="Focus Trap">
      <p>
        When open, focus is trapped inside the dialog.
        <kbd
          class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
          >Tab</kbd
        >
        cycles through interactive elements. On close, focus returns to the element that opened the dialog.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <kbd
          class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
          >Escape</kbd
        >
        closes the dialog (configurable via <code class="text-text-primary">closeOnEscape</code>).
      </p>
    </Note>
    <Note title="Scroll Lock">
      <p>While open, body scroll is locked. Long dialog content scrolls within the panel itself.</p>
    </Note>
  </NoteList>
</Section>
