<!-- urbicon-ignore raw-tailwind-color — the Customization demo restyles the dialog panel into a
     terminal with `slotClasses`: it keeps the panel's radius tier, centering, focus trap and
     scroll lock, and only the fill, border and neon glow are raw — a terminal green the token
     palette has no equivalent for. Every other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Dialog, Input, Kbd, SearchIcon, TrashIcon } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let basicOpen = $state(false);
  let topOpen = $state(false);
  let formOpen = $state(false);
  let scrollOpen = $state(false);
  let terminalOpen = $state(false);

  let formName = $state('');
  let formEmail = $state('');
</script>

<!-- Examples: Confirmation (content-only) -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Confirmation (content-only)"
      description="Without a title, Dialog renders your content straight into the panel with no header or close button, so you wire the actions yourself. Reach for it in short confirmation flows."
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
            <TrashIcon size={20} />
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
      description="Pass a title to switch on the structured layout: a header with a built-in close button, a scrollable body, and a footer. The standard pattern for forms and editors."
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
      description="Use placement='top' for search or command-palette flows: anchored near the top of the viewport, results don't shift below the fold as the user types."
      code={`<Dialog bind:open placement="top" size="md">
  <input type="text" placeholder="Search..." />
  ...results...
</Dialog>`}
    >
      <Button variant="outlined" onclick={() => (topOpen = true)}>Open Search</Button>
      <Dialog bind:open={topOpen} placement="top" size="md">
        <div class="border-border-subtle flex items-center gap-2 border-b pb-3">
          <SearchIcon size={16} class="text-text-tertiary" />
          <input
            type="text"
            placeholder="Search commands..."
            class="text-text-primary placeholder:text-text-tertiary w-full border-none bg-transparent text-sm outline-none"
          />
          <Kbd keys="Esc" />
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
      description="Long body content scrolls within the panel while the header and footer stay pinned. Reach for it for terms, changelogs, or any read-heavy dialog."
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

<Section marker id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Neon terminal"
      description="Restyle the panel with slotClasses. It keeps the dialog's radius tier, centering, focus trap and scroll lock. Only the fill, border and neon glow are raw (a terminal green the token palette has no equivalent for)."
      code={`<Dialog
  bind:open
  slotClasses={{
    panel: 'border-green-500/30 bg-black text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.15)]',
    content: 'font-mono text-xs'
  }}
>
  ...
</Dialog>`}
    >
      <Button variant="ghost" onclick={() => (terminalOpen = true)}>Launch Terminal</Button>
      <Dialog
        bind:open={terminalOpen}
        slotClasses={{
          panel:
            'border-green-500/30 bg-black text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.15)]',
          content: 'font-mono text-xs'
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
            onclick={() => (terminalOpen = false)}
          >
            [n] Abort
          </button>
          <button
            class="flex-1 cursor-pointer rounded-none border border-green-500 bg-green-500/10 px-3 py-1.5 font-mono text-xs text-green-400 transition-colors hover:bg-green-500/20"
            onclick={() => (terminalOpen = false)}
          >
            [Y] Confirm
          </button>
        </div>
      </Dialog>
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

<!-- Accessibility -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Native Dialog">
      <p>
        Built on the native <code class="text-text-primary">&lt;dialog&gt;</code> element opened
        with
        <code class="text-text-primary">showModal()</code>, so the page behind it goes inert. A
        <code class="text-text-primary">title</code> becomes the dialog's accessible name through
        <code class="text-text-primary">aria-labelledby</code>.
      </p>
    </Note>
    <Note title="Focus Trap">
      <p>
        On open, focus moves to the first interactive element inside the panel. While open, focus is
        trapped: <Kbd keys="Tab" /> cycles the interactive elements and never leaves. On close, focus
        returns to the element that opened the dialog.
      </p>
    </Note>
    <Note title="Dismissal">
      <p>
        <Kbd keys="Escape" />
        closes the dialog (<code class="text-text-primary">closeOnEscape</code>), and so does a
        click on the backdrop (<code class="text-text-primary">closeOnBackdropClick</code>). Both
        are on by default. <code class="text-text-primary">onClose</code> fires on any dismissal, so reset
        your state there.
      </p>
    </Note>
    <Note title="Scroll Lock">
      <p>While open, body scroll is locked. Long dialog content scrolls within the panel itself.</p>
    </Note>
  </NoteList>
</Section>
