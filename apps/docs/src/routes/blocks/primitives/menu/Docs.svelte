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

  import { CodeExample, InfoCard, Section } from '@urbicon-ui/docs';
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'variant',
          'intent',
          'size',
          'tier',
          'itemSize',
          'placement',
          'chevronAnimation',
          'placeholder'
        ],
        defaults: {
          variant: 'outlined',
          size: 'md',
          tier: 'commit',
          intent: 'neutral',
          placement: 'bottom-start',
          chevronAnimation: 'rotate'
        },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, groupBy: 'category', enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'Menu Component', showToc: true }
  };
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
      title="Custom header & footer"
      description="Inject custom header and footer regions via the customHeader and customFooter snippets. Useful for sign-in banners or destructive footer actions."
      code={customHeaderFooterCode}
    >
      <CustomHeaderFooter />
    </CodeExample>

    <CodeExample
      title="Custom per-item renderer"
      description="Full control over each list item via the customItem snippet. Receives the item and an activate() callback that dispatches the item's onSelect and closes the menu."
      code={customItemRendererCode}
    >
      <CustomItemRenderer />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Uses <code class="text-text-primary">role="menu"</code> on the panel and
          <code class="text-text-primary">role="menuitem"</code> on each item, with
          <code class="text-text-primary">aria-haspopup="menu"</code> +
          <code class="text-text-primary">aria-expanded</code> on the trigger. Sub-menus add
          <code class="text-text-primary">aria-haspopup="menu"</code> on the submenu trigger.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          on the trigger to open. Items are reachable via
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          (W3C menu pattern);
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          activates an item.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Escape</kbd
          >
          closes the menu and restores focus to the trigger.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Focus Management</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          On activation the menu closes and focus returns to the trigger. Items with
          <code class="text-text-primary">keepOpen</code> dispatch their action without closing — useful
          for repeated actions like "Add tag".
        </p>
      </div>
    </div>
  </div>
</Section>
