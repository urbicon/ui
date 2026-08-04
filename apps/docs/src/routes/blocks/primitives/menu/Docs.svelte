<script lang="ts">
  import {
    BasicSingle,
    CustomHeaderFooter,
    CustomItemRenderer,
    CustomTriggerContent,
    DeclarativeChildren
  } from './examples';
  import basicSingleCode from './examples/BasicSingle.svelte?raw';
  import customHeaderFooterCode from './examples/CustomHeaderFooter.svelte?raw';
  import customItemRendererCode from './examples/CustomItemRenderer.svelte?raw';
  import customTriggerContentCode from './examples/CustomTriggerContent.svelte?raw';
  import declarativeChildrenCode from './examples/DeclarativeChildren.svelte?raw';

  import { CodeExample, InfoCard, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, Menu } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  // The snippet example shows two demo files in one code block — each keeps its
  // own script block, so they are labelled rather than spliced together.
  const customSnippetsCode = [
    '<!-- CustomHeaderFooter.svelte -->',
    customHeaderFooterCode.trimEnd(),
    '',
    '<!-- CustomItemRenderer.svelte -->',
    customItemRendererCode.trimEnd()
  ].join('\n');
</script>

<!-- ─── When Menu vs Select ─── -->

<Section marker="01" id="when-to-use" title="When to use Menu (vs. Select)">
  <InfoCard intent="info" title="Menu is for actions, not selection">
    <p class="text-text-secondary text-sm leading-relaxed">
      <strong>Menu</strong> (<code>role="menu"</code>) is for invoking verbs — Edit, Delete, Share,
      Export. Each item dispatches an <code>onSelect</code> callback when activated.
    </p>
    <p class="text-text-secondary mt-2 text-sm leading-relaxed">
      To pick a value from a list use <strong>Select</strong> (<code>role="listbox"</code>) — it
      supports single + multi modes, validation, and binds to form values.
      <strong>Combobox</strong> is the searchable variant.
    </p>
  </InfoCard>
</Section>

<!-- ─── Examples ─── -->

<Section marker="02" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Basic actions"
      description="Items array — each item carries an onSelect callback. Sections group related actions; the menu closes after activation unless keepOpen is set on the item."
      code={basicSingleCode}
    >
      <BasicSingle />
    </CodeExample>

    <CodeExample
      title="Declarative children"
      description="Build the menu with MenuItem, MenuSection and MenuDivider instead of an items array. Pass onSelect on each MenuItem to wire the action."
      code={declarativeChildrenCode}
    >
      <DeclarativeChildren />
    </CodeExample>

    <CodeExample
      title="Custom trigger (icon button)"
      description="Replace the default trigger entirely via the customTrigger snippet. Receives dismiss + open — typical pattern is an icon-only button like MoreHorizontal."
      code={customTriggerContentCode}
    >
      <CustomTriggerContent />
    </CodeExample>

    <CodeExample
      title="Custom snippets"
      description="customHeader, customFooter and customItem replace the regions an items array cannot express — a sign-in banner, a destructive footer action, a row with an avatar and a shortcut. customItem takes one positional argument, the item, and should render visible content only: Menu already provides the surrounding role='menuitem' button, so an interactive element inside the snippet nests one control in another and fires the action twice."
      code={customSnippetsCode}
    >
      <div class="flex flex-col gap-6">
        <CustomHeaderFooter />
        <CustomItemRenderer />
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Soft panel via slotClasses"
      description="Menu exposes its full anatomy as slots — trigger, content, item, section, divider, indicator, submenu, and footer among them. Here the floating panel gets a softer radius and shadow while the items pick up a primary hover tint; placement, keyboard navigation, and dark mode stay untouched."
      isolate
    >
      <Menu
        placeholder="Actions"
        items={['Rename', 'Duplicate', 'Archive']}
        slotClasses={{
          content: 'rounded-xl shadow-[var(--blocks-shadow-lg)]',
          item: 'rounded-lg hover:bg-primary/10 hover:text-primary'
        }}
      />
    </CodeExample>
    <p class="text-text-secondary text-sm leading-relaxed">
      <code class="text-text-primary">unstyled</code> strips the default classes from every slot
      while keeping <code class="text-text-primary">role="menu"</code> semantics, roving focus, and
      dismiss behavior — rebuild the look entirely through
      <code class="text-text-primary">slotClasses</code>. A context-menu skin you repeat across the
      app belongs in a <code class="text-text-primary">BlocksProvider</code> preset (registered
      under <code class="text-text-primary">presets.Menu</code>, applied per instance via
      <code class="text-text-primary">preset</code>) — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        Uses <code class="text-text-primary">role="menu"</code> on the panel and
        <code class="text-text-primary">role="menuitem"</code> on each item, with
        <code class="text-text-primary">aria-haspopup="menu"</code> +
        <code class="text-text-primary">aria-expanded</code> on the trigger. Sub-menus add
        <code class="text-text-primary">aria-haspopup="menu"</code> on the submenu trigger.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />
        on the trigger to open. Arrow keys move focus between items (roving tabindex),
        <Kbd keys="Home" />
        /
        <Kbd keys="End" />
        jump to the first/last item, and
        <Kbd keys="Tab" />
        moves focus out and closes the menu (W3C menu pattern);
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />
        activates an item.
        <Kbd keys="Escape" />
        closes the menu and restores focus to the trigger.
      </p>
    </Note>
    <Note title="Focus Management">
      <p>
        On activation the menu closes and focus returns to the trigger. Items with
        <code class="text-text-primary">keepOpen</code> dispatch their action without closing — useful
        for repeated actions like "Add tag".
      </p>
    </Note>
  </NoteList>
</Section>
