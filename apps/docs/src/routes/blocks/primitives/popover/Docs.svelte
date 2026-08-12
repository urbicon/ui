<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Badge,
    BarChartIcon,
    Button,
    Kbd,
    LogOutIcon,
    Popover,
    SettingsIcon,
    UserIcon
  } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let controlledOpen = $state(false);
</script>

<!-- ─── Purpose ─── -->

<Section marker id="purpose" title="Purpose">
  <p class="text-text-secondary text-sm leading-relaxed">
    <strong>Popover</strong> is a floating panel anchored to a trigger. Reach for it for contextual surfaces
    like pickers, inline help or a profile panel that sit next to the element the user acted on without
    blocking the page. You supply the trigger button and the panel content. The popover positions itself,
    flips when space runs out, and opens and closes on its own.
  </p>

  <div class="mt-6 overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold">Reach for</th>
          <th class="py-2 pr-4 font-semibold">When you need</th>
          <th class="py-2 font-semibold">Focus</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top">
            <span class="text-text-primary font-medium">Popover</span>
            <span class="text-text-tertiary">(this)</span>
          </td>
          <td class="py-3 pr-4 align-top">
            A contextual panel by the trigger: a picker, inline help, a profile panel.
          </td>
          <td class="py-3 align-top">Non-modal; focus flows past.</td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/tooltip')} class="text-primary hover:underline"
              >Tooltip</a
            >
          </td>
          <td class="py-3 pr-4 align-top">
            A short hover/focus description tied to
            <code class="text-text-primary">aria-describedby</code>.
          </td>
          <td class="py-3 align-top">Non-interactive.</td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/menu')} class="text-primary hover:underline"
              >Menu</a
            >
          </td>
          <td class="py-3 pr-4 align-top">
            A list of selectable actions with arrow-key navigation.
          </td>
          <td class="py-3 align-top">Roving focus.</td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top">
            <a href={resolve('/blocks/primitives/dialog')} class="text-primary hover:underline"
              >Dialog</a
            >
            /
            <a href={resolve('/blocks/primitives/drawer')} class="text-primary hover:underline"
              >Drawer</a
            >
          </td>
          <td class="py-3 pr-4 align-top"
            >A blocking, modal flow: confirmation, form, edge sheet.</td
          >
          <td class="py-3 align-top">Focus trapped.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
    <strong class="text-text-secondary font-medium">Inside flowing text:</strong> a trigger that
    sits in a paragraph needs <code class="text-text-primary">inline</code>, which makes its wrapper
    a
    <code class="text-text-primary">&lt;span&gt;</code> so a
    <code class="text-text-primary">&lt;div&gt;</code> panel cannot break the surrounding
    <code class="text-text-primary">&lt;p&gt;</code>.
  </p>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Rich content"
      description="A popover carries structured content a Menu cannot. You provide the trigger button in the `trigger` snippet, and the panel is whatever markup you put inside."
      code={`<Popover placement="bottom-end">
  {#snippet trigger()}
    <button aria-label="Open user menu">JD</button>
  {/snippet}
  <div class="w-64">
    <!-- profile header, actions, sign-out -->
  </div>
</Popover>`}
      isolate
      previewClass="flex justify-center"
    >
      <Popover placement="bottom-end">
        {#snippet trigger()}
          <button
            type="button"
            aria-label="Open user menu"
            class="bg-primary/10 text-primary-emphasis hover:ring-primary/30 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-sm font-semibold transition hover:ring-2"
          >
            JD
          </button>
        {/snippet}
        <div class="w-64">
          <div class="border-border-subtle border-b px-4 py-3">
            <div class="flex items-center gap-3">
              <div
                class="bg-primary/10 text-primary-emphasis flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              >
                JD
              </div>
              <div class="min-w-0">
                <div class="text-text-primary truncate text-sm font-semibold">Jane Doe</div>
                <div class="text-text-tertiary truncate text-xs">jane@urbicon.dev</div>
              </div>
              <Badge size="xs" intent="success" class="ml-auto shrink-0">Pro</Badge>
            </div>
          </div>
          <div class="py-1">
            {#each [{ icon: UserIcon, label: 'Profile' }, { icon: SettingsIcon, label: 'Settings' }, { icon: BarChartIcon, label: 'Analytics' }] as item (item.label)}
              <button
                class="text-text-secondary hover:bg-surface-hover hover:text-text-primary flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors"
              >
                <item.icon size={16} />
                {item.label}
              </button>
            {/each}
          </div>
          <div class="border-border-subtle border-t py-1">
            <button
              class="text-danger hover:bg-danger/5 flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors"
            >
              <LogOutIcon size={16} />
              Sign out
            </button>
          </div>
        </div>
      </Popover>
    </CodeExample>

    <CodeExample
      title="Controlled open state"
      description="`bind:open` lets outside code read and drive the panel."
      code={`<` +
        `script>
  let open = $state(false);
<` +
        `/script>

<Popover bind:open>
  {#snippet trigger()}
    <Button>{open ? 'Viewing' : 'View'} status</Button>
  {/snippet}
  <div class="p-3">...</div>
  <Button onclick={() => (open = false)}>Dismiss</Button>
</Popover>`}
      isolate
      previewClass="flex justify-center"
    >
      <Popover bind:open={controlledOpen}>
        {#snippet trigger()}
          <Button
            variant={controlledOpen ? 'filled' : 'outlined'}
            intent={controlledOpen ? 'primary' : 'neutral'}
          >
            {controlledOpen ? 'Viewing' : 'View'} status
          </Button>
        {/snippet}
        <div class="w-56 p-3">
          <div class="mb-2 flex items-center gap-2">
            <span class="bg-success h-2 w-2 rounded-full"></span>
            <span class="text-text-primary text-sm font-semibold">All systems operational</span>
          </div>
          <p class="text-text-tertiary mb-3 text-xs leading-relaxed">
            Last checked 2 min ago. Uptime 99.98 % over 30 days.
          </p>
          <Button
            variant="ghost"
            size="xs"
            intent="primary"
            onclick={() => (controlledOpen = false)}
          >
            Dismiss
          </Button>
        </div>
      </Popover>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Primary-framed callout"
      description="One `class` frames the panel in the primary token, a `border-primary` edge and a soft primary ring, to mark a branded or high-priority surface. Only the border and ring change. The fill, radius and motion stay as they are."
      isolate
      previewClass="flex justify-center"
    >
      <Popover class="border-primary ring-primary/35 ring-2">
        {#snippet trigger()}
          <Button intent="primary">Upgrade plan</Button>
        {/snippet}
        <div class="w-60 p-1">
          <div class="text-primary-emphasis text-sm font-semibold">Go Premium</div>
          <p class="text-text-secondary mt-1 mb-3 text-xs leading-relaxed">
            Unlock advanced analytics, priority support and unlimited projects.
          </p>
          <Button intent="primary" size="sm" class="w-full">Start free trial</Button>
        </div>
      </Popover>
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
    <Note title="ARIA attributes">
      <p>
        The trigger's first interactive element receives
        <code class="text-text-primary">aria-haspopup="dialog"</code> and
        <code class="text-text-primary">aria-expanded</code> reflecting the open state. The floating
        panel carries <code class="text-text-primary">role="dialog"</code> by default.
        <code class="text-text-primary">aria-modal</code> is passed through as an attribute only.
        The popover never traps focus, so leave it unset and reach for
        <code class="text-text-primary">Dialog</code> when a flow is genuinely modal.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" /> toggle the popover when the trigger is focused.
        <Kbd keys="Escape" /> closes it and returns focus to the trigger.
        <Kbd keys="Tab" /> moves through the focusable content inside.
      </p>
    </Note>
    <Note title="Focus & dismissal">
      <p>
        Clicking outside dismisses the popover automatically. Set
        <code class="text-text-primary">closeOnClickOutside</code> to
        <code class="text-text-primary">false</code> to pin it open until you toggle
        <code class="text-text-primary">open</code> yourself. For a flow that must hold focus until
        dismissed, use <code class="text-text-primary">Dialog</code> or
        <code class="text-text-primary">ConfirmDialog</code> instead.
      </p>
    </Note>
    <Note title="Motion & reduced motion">
      <p>
        The panel fades and scales in over about 150 ms. Override the timing per instance with
        <code class="text-text-primary">transitionDuration</code> /
        <code class="text-text-primary">transitionEasing</code>, and under
        <code class="text-text-primary">prefers-reduced-motion</code> the motion collapses to near-instant.
      </p>
    </Note>
  </NoteList>
</Section>
