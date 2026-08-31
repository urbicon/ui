<script lang="ts">
  import {
    BasicSingle,
    CustomHeaderFooter,
    CustomTriggerContent,
    SelectableItems
  } from './examples';
  import basicSingleCode from './examples/BasicSingle.svelte?raw';
  import customHeaderFooterCode from './examples/CustomHeaderFooter.svelte?raw';
  import customTriggerContentCode from './examples/CustomTriggerContent.svelte?raw';
  import selectableItemsCode from './examples/SelectableItems.svelte?raw';

  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd, Menu } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── When to use Menu ─── -->

<Section marker id="when-to-use" title="When to use Menu">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Menu invokes actions. To pick a value that binds to a form, reach for
    <a href={resolve('/blocks/primitives/select')} class="text-primary hover:underline">Select</a>
    or
    <a href={resolve('/blocks/primitives/combobox')} class="text-primary hover:underline"
      >Combobox</a
    > instead.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead class="text-text-primary border-border-subtle border-b">
        <tr>
          <th class="py-2 pr-4 font-semibold">Component</th>
          <th class="py-2 pr-4 font-semibold">Role</th>
          <th class="py-2 font-semibold">Reach for it when</th>
        </tr>
      </thead>
      <tbody class="text-text-secondary divide-border-subtle divide-y">
        <tr>
          <td class="py-3 pr-4 align-top">
            <code class="text-text-primary">Menu</code>
            <span class="text-text-tertiary">(this)</span>
          </td>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">menu</code></td>
          <td class="py-3 align-top">
            The items are verbs: Edit, Delete, Share, Export. Each runs its
            <code class="text-text-primary">onSelect</code>. An item given
            <code class="text-text-primary">checked</code> also displays a setting — Menu shows the state
            you supply but never stores a selection.
          </td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">Select</code></td>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">listbox</code></td>
          <td class="py-3 align-top">The user commits a value to a form. Single or multiple.</td>
        </tr>
        <tr>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">Combobox</code></td>
          <td class="py-3 pr-4 align-top"><code class="text-text-primary">listbox</code></td>
          <td class="py-3 align-top">A value from a long list, narrowed by type-ahead.</td>
        </tr>
      </tbody>
    </table>
  </div>
</Section>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <p class="text-text-secondary mb-6 text-sm leading-relaxed">
    Each item is an object with a <code class="text-text-primary">label</code> and an
    <code class="text-text-primary">onSelect</code> that runs when it is activated (a bare string is
    shorthand for a label-only item). Add
    <code class="text-text-primary">id</code>, <code class="text-text-primary">disabled</code>,
    <code class="text-text-primary">keepOpen</code> for repeated picks,
    <code class="text-text-primary">checked</code> for a selectable setting,
    <code class="text-text-primary">detail</code> for a right-aligned readout, or
    <code class="text-text-primary">children</code> for a submenu, and a
    <code class="text-text-primary">type: 'section'</code> entry heads a group and owns every item
    up to the next header;
    <code class="text-text-primary">&#123; type: 'divider' &#125;</code> draws a rule between two
    runs. Build the menu from an
    <code class="text-text-primary">items</code> array, or declaratively with
    <code class="text-text-primary">&lt;MenuItem&gt;</code>,
    <code class="text-text-primary">&lt;MenuSection&gt;</code> and
    <code class="text-text-primary">&lt;MenuDivider&gt;</code> children — there a section takes the
    items it names as its own children. When the built-in icon-label-detail row is not enough, a
    <code class="text-text-primary">customItem</code> snippet takes over each row's inner content — render
    visible content only, since Menu supplies the surrounding button.
  </p>

  <div class="space-y-8">
    <CodeExample
      title="Basic actions"
      description="Each item runs its onSelect when activated, and the menu closes again unless the item sets keepOpen. A section wraps the rows it names, so screen readers announce them as its group &#8212; the items array expresses the same shape with &#123; type: 'section' &#125; and &#123; type: 'divider' &#125; entries."
      code={basicSingleCode}
    >
      <BasicSingle />
    </CodeExample>

    <CodeExample
      title="Icon-only trigger"
      description="customTrigger replaces the default button. It receives toggle and open. Wire toggle to onclick and open to aria-expanded. The usual shape is a compact icon button for row or card overflow actions."
      code={customTriggerContentCode}
    >
      <CustomTriggerContent />
    </CodeExample>

    <CodeExample
      title="Account menu"
      description="customHeader and customFooter frame the item list with regions the array cannot express: a signed-in banner above, a destructive Sign out below."
      code={customHeaderFooterCode}
    >
      <CustomHeaderFooter />
    </CodeExample>

    <CodeExample
      title="Selectable settings"
      description="checked turns a row into role=menuitemradio with a checkmark; the parent row's detail shows the current value while the submenu is collapsed. The state lives in the consumer — each onSelect updates it, Menu only displays it."
      code={selectableItemsCode}
    >
      <SelectableItems />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Primary-accented panel via slotClasses"
      description="slotClasses reaches any slot by name. Open the menu: the panel takes a primary-tinted border and a lifted shadow, and hovering an item tints it primary. Radius, spacing and dismiss behavior stay on the component."
      isolate
    >
      <Menu
        placeholder="Actions"
        items={['Rename', 'Duplicate', 'Archive']}
        slotClasses={{
          content: 'border-primary/30 shadow-[var(--blocks-shadow-lg)]',
          item: 'hover:bg-primary/10 hover:text-primary'
        }}
      />
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
        Uses <code class="text-text-primary">role="menu"</code> on the panel and
        <code class="text-text-primary">role="menuitem"</code> on each item, with
        <code class="text-text-primary">aria-haspopup="menu"</code> +
        <code class="text-text-primary">aria-expanded</code> on the trigger. An item given
        <code class="text-text-primary">checked</code> renders as
        <code class="text-text-primary">role="menuitemradio"</code> with
        <code class="text-text-primary">aria-checked</code>, so the active setting is announced, not
        just marked. Sub-menus add
        <code class="text-text-primary">aria-haspopup="menu"</code> on the submenu trigger. A
        section renders its header as
        <code class="text-text-primary">role="presentation"</code> and wraps the items it names in a
        <code class="text-text-primary">role="group"</code> labelled by that header, so a radio set
        is announced with the group it belongs to;
        <code class="text-text-primary">role="separator"</code> is reserved for the divider.
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
        moves focus out and closes the menu (W3C menu pattern).
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
        <code class="text-text-primary">keepOpen</code> dispatch their action without closing. Useful
        for repeated actions like "Add tag".
      </p>
    </Note>
  </NoteList>
</Section>
