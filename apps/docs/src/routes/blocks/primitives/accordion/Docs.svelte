<script lang="ts">
  import { resolve } from '$app/paths';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Accordion,
    AccordionItem,
    Badge,
    BlocksProvider,
    Collapsible,
    GiftIcon,
    Kbd,
    ZapIcon
  } from '@urbicon-ui/blocks';

  let faqValue = $state<string>('what-is');
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <p class="text-text-secondary text-sm leading-relaxed">
      Each <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">AccordionItem</code> takes a
      <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">value</code> that identifies it, a
      <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">title</code> for its header, and its
      panel content as children.
    </p>

    <!-- FAQ real-world example -->
    <CodeExample
      title="FAQ Section"
      description="A FAQ with the first panel open on load via defaultValue."
      isolate
    >
      <div
        class="bg-surface-elevated border-border-subtle w-full overflow-hidden rounded-2xl border"
      >
        <div class="border-border-subtle border-b px-6 py-4">
          <h3 class="text-text-primary font-semibold">Frequently Asked Questions</h3>
          <p class="text-text-tertiary mt-0.5 text-sm">
            Everything you need to know to get started.
          </p>
        </div>
        <div class="px-6 py-2">
          <Accordion defaultValue="faq-1">
            <AccordionItem value="faq-1" title="Do I need to know Svelte to use this?">
              <p class="text-text-secondary text-sm leading-relaxed">
                Basic Svelte knowledge helps, but our components are designed with simple,
                declarative APIs. If you can write HTML and pass props, you're good to go. Check the <a
                  href={resolve('/getting-started')}
                  class="text-primary underline">Getting Started guide</a
                > for a gentle introduction.
              </p>
            </AccordionItem>
            <AccordionItem value="faq-2" title="How does dark mode work?">
              <p class="text-text-secondary text-sm leading-relaxed">
                We use a 3-layer token system: foundation, semantic, and interaction tokens. Dark
                mode is handled automatically via <code
                  class="bg-surface-base rounded px-1.5 py-0.5 text-xs">light-dark()</code
                >. No manual
                <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">dark:</code> classes needed.
              </p>
            </AccordionItem>
            <AccordionItem value="faq-3" title="Can I use only some components?">
              <p class="text-text-secondary text-sm leading-relaxed">
                Absolutely. Every component is tree-shakeable. Import only what you need and your
                bundle stays lean.
              </p>
            </AccordionItem>
            <AccordionItem value="faq-4" title="Is it accessible?">
              <p class="text-text-secondary text-sm leading-relaxed">
                Yes. All components follow WAI-ARIA patterns, support keyboard navigation, and
                include proper focus management. We test with screen readers and respect <code
                  class="bg-surface-base rounded px-1.5 py-0.5 text-xs">prefers-reduced-motion</code
                >.
              </p>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </CodeExample>

    <!-- Controlled value -->
    <CodeExample
      title="Controlled State"
      description="Bind the open item with bind:value when its selection drives other UI."
      isolate
    >
      <div class="flex w-full flex-col gap-4">
        <div class="flex items-center gap-2">
          <span class="text-text-tertiary text-xs font-medium">Open:</span>
          <Badge size="xs" intent="primary" variant="soft">{faqValue || '(none)'}</Badge>
        </div>
        <Accordion variant="card" bind:value={faqValue}>
          <AccordionItem value="what-is" title="What is Urbicon UI?">
            A Svelte 5 component library with built-in i18n, semantic design tokens, and zero-config
            dark mode.
          </AccordionItem>
          <AccordionItem value="pricing" title="Is it free?">
            Yes. Urbicon UI is free and open-source under the MIT license.
          </AccordionItem>
          <AccordionItem value="support" title="Where do I get help?">
            Check the documentation, open a GitHub issue, or join the community Discord.
          </AccordionItem>
        </Accordion>
      </div>
    </CodeExample>

    <!-- Multiple open -->
    <CodeExample
      title="Several panels open"
      description="type=multiple lets any number of panels stay open at once. value and defaultValue are then arrays of the open item values."
      isolate
      previewClass="mx-auto w-full max-w-lg"
    >
      <Accordion type="multiple" variant="card" defaultValue={['shipping', 'items']}>
        <AccordionItem value="items" title="Items (2)">
          Two products, shipped together in one parcel.
        </AccordionItem>
        <AccordionItem value="shipping" title="Shipping address">
          Ada Lovelace, 12 Analytical Ave, London.
        </AccordionItem>
        <AccordionItem value="payment" title="Payment">
          Visa ending 4242, billed monthly.
        </AccordionItem>
      </Accordion>
    </CodeExample>

    <!-- Custom Trigger -->
    <CodeExample
      title="Custom Trigger"
      description="A trigger snippet replaces the header label with your own markup: icons, badges, multi-line metadata. The chevron and the toggle behaviour stay."
      isolate
    >
      <Accordion variant="card" defaultValue="pro">
        <AccordionItem value="free">
          {#snippet trigger({ open: _open })}
            <div class="flex w-full items-center gap-3">
              <div
                class="bg-surface-hover text-text-secondary rounded-modify flex size-8 items-center justify-center"
              >
                <GiftIcon size={16} />
              </div>
              <div class="flex-1 text-left">
                <p class="text-text-primary text-sm font-semibold">Free Plan</p>
                <p class="text-text-tertiary text-xs">Up to 3 projects</p>
              </div>
              <Badge size="xs" intent="neutral" variant="soft">$0/mo</Badge>
            </div>
          {/snippet}
          <p class="text-text-secondary text-sm">
            Includes community support, basic components, and public repos only.
          </p>
        </AccordionItem>
        <AccordionItem value="pro">
          {#snippet trigger({ open: _open })}
            <div class="flex w-full items-center gap-3">
              <div
                class="bg-primary/10 text-primary rounded-modify flex size-8 items-center justify-center"
              >
                <ZapIcon size={16} />
              </div>
              <div class="flex-1 text-left">
                <p class="text-text-primary text-sm font-semibold">Pro Plan</p>
                <p class="text-text-tertiary text-xs">Unlimited projects</p>
              </div>
              <Badge size="xs" intent="primary" variant="filled">$29/mo</Badge>
            </div>
          {/snippet}
          <p class="text-text-secondary text-sm">
            Priority support, private repos, advanced theming, and early access to new components.
          </p>
        </AccordionItem>
      </Accordion>
    </CodeExample>
  </div>
</Section>

<!-- ─── Collapsible Foundation ─── -->

<Section marker id="collapsible" title="Accordion or Collapsible">
  <div class="space-y-8">
    <CodeExample
      title="Accordion vs Collapsible"
      description="Accordion coordinates several panels together. For a single expand/collapse panel, use Collapsible directly."
      isolate
      previewClass="flex flex-col gap-8 w-full"
    >
      <div class="flex w-full max-w-lg flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Single panel → Collapsible
        </p>
        <Collapsible variant="card" title="Standalone expand/collapse" defaultOpen>
          <p class="text-text-secondary text-sm">
            Use <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">Collapsible</code> when you
            need a single panel that manages its own state. No context, no coordination, just expand and
            collapse.
          </p>
        </Collapsible>
      </div>
      <div class="flex w-full max-w-lg flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Multi-panel → Accordion
        </p>
        <Accordion variant="card" defaultValue="a1">
          <AccordionItem value="a1" title="Coordinated panel A">
            Opening this closes panel B. Accordion coordinates multiple Collapsible panels via a
            shared context.
          </AccordionItem>
          <AccordionItem value="a2" title="Coordinated panel B">
            Single, multiple and non-collapsible modes, all managed by the Accordion wrapper.
          </AccordionItem>
        </Accordion>
      </div>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      See the <a href={resolve('/blocks/primitives/collapsible')} class="text-primary underline"
        >Collapsible</a
      > page for that standalone case.
    </p>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="One provider default"
      description="One BlocksProvider default styles every AccordionItem at once, so the tint is set in one place rather than repeated on each item. The card variant keeps its padding, spacing, animation and focus ring."
      isolate
      previewClass="mx-auto w-full max-w-lg"
    >
      <BlocksProvider
        defaults={{
          AccordionItem: {
            slotClasses: {
              item: 'border border-primary/40 bg-primary/10',
              chevron: 'text-primary'
            }
          }
        }}
      >
        <Accordion variant="card" defaultValue="brand-1">
          <AccordionItem value="brand-1" title="How is this styled?">
            A single provider default paints every item from one place.
          </AccordionItem>
          <AccordionItem value="brand-2" title="Does the behaviour survive?">
            Yes. Only the surface tint, border and accent colour change.
          </AccordionItem>
        </Accordion>
      </BlocksProvider>
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
        Each trigger uses <code class="text-text-primary">aria-expanded</code> and
        <code class="text-text-primary">aria-controls</code> to link to its content panel. Content
        panels have <code class="text-text-primary">role="region"</code> with
        <code class="text-text-primary">aria-labelledby</code> pointing back to the trigger. The
        <code class="text-text-primary">data-state</code>
        attribute exposes
        <code class="text-text-primary">open</code> /
        <code class="text-text-primary">closed</code>
        for CSS-only styling.
      </p>
    </Note>
    <Note title="Keyboard Navigation">
      <p>
        <Kbd keys="Tab" />
        moves focus between triggers.
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" />
        toggle the focused item. Focus rings use
        <code class="text-text-primary">focus-visible:</code> so they only appear on keyboard navigation,
        never on mouse clicks.
      </p>
    </Note>
    <Note title="Disabled State">
      <p>
        Set <code class="text-text-primary">disabled</code> on an
        <code class="text-text-primary">AccordionItem</code> to give its trigger the native
        <code class="text-text-primary">disabled</code> attribute, which removes it from the tab order
        and blocks activation.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        When <code class="text-text-primary">prefers-reduced-motion</code> is set, panels open and close
        without animating.
      </p>
    </Note>
  </NoteList>
</Section>
