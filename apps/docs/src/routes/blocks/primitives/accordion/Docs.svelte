<script lang="ts">
  import { resolve } from '$app/paths';
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Accordion, AccordionItem, Collapsible, Badge } from '@urbicon-ui/blocks';

  let faqValue = $state<string>('what-is');

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['variant', 'size', 'type', 'collapsible', 'disabled'],
        defaults: { variant: 'default', size: 'md', type: 'single' },
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
    meta: { title: 'Accordion Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <!-- FAQ real-world example -->
    <CodeExample
      title="FAQ Section"
      description="A realistic FAQ layout with rich content — the canonical real-world use case for Accordion."
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
                >
                — no manual <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">dark:</code> classes
                needed.
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
      description="Bind the open item via bind:value for external state management — useful when the accordion's selection drives other UI."
      isolate
    >
      <div class="flex w-full flex-col gap-4">
        <div class="flex items-center gap-2">
          <span class="text-text-tertiary text-xs font-medium">Open:</span>
          <Badge size="xs" intent="primary" variant="soft">{faqValue || '(none)'}</Badge>
        </div>
        <Accordion variant="separated" bind:value={faqValue}>
          <AccordionItem value="what-is" title="What is Urbicon UI?">
            A Svelte 5 component library with built-in i18n, semantic design tokens, and zero-config
            dark mode.
          </AccordionItem>
          <AccordionItem value="pricing" title="Is it free?">
            Yes — Urbicon UI is free and open-source under the MIT license.
          </AccordionItem>
          <AccordionItem value="support" title="Where do I get help?">
            Check the documentation, open a GitHub issue, or join the community Discord.
          </AccordionItem>
        </Accordion>
      </div>
    </CodeExample>

    <!-- Custom Trigger -->
    <CodeExample
      title="Custom Trigger"
      description="Replace the default trigger with a custom snippet for full control over the header layout — icons, badges, multi-line metadata."
      isolate
    >
      <Accordion variant="separated" defaultValue="pro">
        <AccordionItem value="free">
          {#snippet trigger({ open: _open })}
            <div class="flex w-full items-center gap-3">
              <div
                class="bg-surface-hover rounded-modify flex size-8 items-center justify-center text-sm"
              >
                🆓
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
                class="bg-primary/10 text-primary rounded-modify flex size-8 items-center justify-center text-sm"
              >
                ⚡
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

<Section marker="02" id="collapsible" title="Built on Collapsible">
  <div class="space-y-8">
    <CodeExample
      title="Accordion vs Collapsible"
      description="Accordion coordinates multiple panels via a shared context. For a single expand/collapse panel, use Collapsible directly."
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
            need a single panel that manages its own state. No context, no coordination — just expand
            and collapse.
          </p>
        </Collapsible>
      </div>
      <div class="flex w-full max-w-lg flex-col gap-2.5">
        <p class="text-text-tertiary text-xs font-medium tracking-wider uppercase">
          Multi-panel → Accordion
        </p>
        <Accordion variant="separated" defaultValue="a1">
          <AccordionItem value="a1" title="Coordinated panel A">
            Opening this closes panel B. Accordion coordinates multiple Collapsible panels via a
            shared context.
          </AccordionItem>
          <AccordionItem value="a2" title="Coordinated panel B">
            Single-mode, multiple-mode, non-collapsible — all managed by the Accordion wrapper.
          </AccordionItem>
        </Accordion>
      </div>
    </CodeExample>

    <div class="border-border-subtle bg-surface-elevated rounded-xl border p-5">
      <p class="text-text-secondary text-sm leading-relaxed">
        <strong class="text-text-primary">Architecture note:</strong> Each
        <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">AccordionItem</code> uses
        <code class="bg-surface-base rounded px-1.5 py-0.5 text-xs">Collapsible</code> internally
        for its expand/collapse animation and ARIA attributes. The Accordion component adds
        multi-item coordination (single/multiple mode, non-collapsible, disabled) on top. See the
        <a href={resolve('/blocks/primitives/collapsible')} class="text-primary underline"
          >Collapsible docs</a
        > for the standalone API.
      </p>
    </div>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <!-- slotClasses -->
    <CodeExample
      title="slotClasses Override"
      description="Restyle individual slots with overrides that win the cascade — wider border in primary, tinted background, bold primary-colored trigger text, and an inset content rail."
      isolate
      previewClass="w-full"
    >
      <Accordion
        variant="separated"
        defaultValue="styled"
        slotClasses={{
          item: 'border-2 border-primary/40 rounded-2xl bg-primary/5',
          trigger: 'text-primary font-bold',
          chevron: 'text-primary',
          contentInner: 'text-text-primary border-l-2 border-primary/40 pl-4'
        }}
      >
        <AccordionItem value="styled" title="Restyled via slotClasses">
          Every slot is overridable: the item gets a two-pixel primary border + tinted background,
          the trigger inherits the primary intent in bold, the chevron matches, and the content
          inner pane adds a primary left rail for emphasis.
        </AccordionItem>
        <AccordionItem value="another" title="Consistent overrides">
          slotClasses are applied to every item in the accordion, keeping the visual language
          consistent across sections.
        </AccordionItem>
      </Accordion>
    </CodeExample>

    <!-- Glassmorphism unstyled -->
    <CodeExample
      title="Glassmorphism (unstyled)"
      description="Fully custom frosted-glass accordion built entirely with class overrides."
      isolate
      previewClass="rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-8"
    >
      <Accordion unstyled defaultValue="glass-1" class="flex w-full flex-col gap-3">
        <AccordionItem
          unstyled
          value="glass-1"
          title="Frosted Glass Header"
          class="overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur-md transition-colors hover:bg-white/15"
          slotClasses={{
            trigger:
              'flex w-full items-center justify-between px-5 py-3.5 text-sm font-medium text-white',
            chevron: 'size-4 text-white/60 transition-transform duration-200',
            contentInner: 'px-5 pb-4 pt-1 text-sm text-white/80'
          }}
        >
          The accordion strips all defaults in unstyled mode. Every visual detail — background,
          blur, text color, spacing — is hand-crafted through class props.
        </AccordionItem>
        <AccordionItem
          unstyled
          value="glass-2"
          title="Layered Transparency"
          class="overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur-md transition-colors hover:bg-white/15"
          slotClasses={{
            trigger:
              'flex w-full items-center justify-between px-5 py-3.5 text-sm font-medium text-white',
            chevron: 'size-4 text-white/60 transition-transform duration-200',
            contentInner: 'px-5 pb-4 pt-1 text-sm text-white/80'
          }}
        >
          A single backdrop-blur layer on the item wraps both trigger and content — no seams, no
          double-blur where the two panes meet.
        </AccordionItem>
        <AccordionItem
          unstyled
          value="glass-3"
          title="Creative Freedom"
          class="overflow-hidden rounded-xl border border-white/20 bg-white/10 backdrop-blur-md transition-colors hover:bg-white/15"
          slotClasses={{
            trigger:
              'flex w-full items-center justify-between px-5 py-3.5 text-sm font-medium text-white',
            chevron: 'size-4 text-white/60 transition-transform duration-200',
            contentInner: 'px-5 pb-4 pt-1 text-sm text-white/80'
          }}
        >
          Proof that <code class="rounded bg-white/15 px-1.5 py-0.5">unstyled</code> gives full creative
          freedom while keeping structure, animation, and accessibility intact.
        </AccordionItem>
      </Accordion>
    </CodeExample>

    <!-- Terminal style unstyled -->
    <CodeExample
      title="Terminal (unstyled)"
      description="Monospace hacker aesthetic built entirely with class overrides."
      isolate
      previewClass="rounded-2xl bg-neutral-950 p-6"
    >
      <Accordion
        unstyled
        defaultValue="term-1"
        class="w-full divide-y divide-emerald-500/20 font-mono"
      >
        <AccordionItem
          unstyled
          value="term-1"
          title="$ cat /etc/config"
          slotClasses={{
            trigger:
              'flex w-full items-center justify-between py-3 text-xs text-emerald-300 transition-colors hover:text-emerald-400',
            chevron: 'size-3.5 text-emerald-400 transition-transform duration-200',
            contentInner: 'pb-3 text-xs leading-relaxed text-emerald-200'
          }}
        >
          <p>NODE_ENV=production</p>
          <p>PORT=3000</p>
          <p>LOG_LEVEL=info</p>
          <p class="mt-2 text-emerald-300">Process exited with code 0</p>
        </AccordionItem>
        <AccordionItem
          unstyled
          value="term-2"
          title="$ systemctl status app"
          slotClasses={{
            trigger:
              'flex w-full items-center justify-between py-3 text-xs text-emerald-300 transition-colors hover:text-emerald-400',
            chevron: 'size-3.5 text-emerald-400 transition-transform duration-200',
            contentInner: 'pb-3 text-xs leading-relaxed text-emerald-200'
          }}
        >
          <p class="text-emerald-400">● app.service - Application Server</p>
          <p class="text-emerald-400">
            &nbsp;&nbsp;Active: <span class="text-emerald-300">active (running)</span>
          </p>
          <p class="text-emerald-400">&nbsp;&nbsp;Memory: 128.4M</p>
        </AccordionItem>
        <AccordionItem
          unstyled
          value="term-3"
          title="$ tail -f /var/log/app.log"
          slotClasses={{
            trigger:
              'flex w-full items-center justify-between py-3 text-xs text-emerald-300 transition-colors hover:text-emerald-400',
            chevron: 'size-3.5 text-emerald-400 transition-transform duration-200',
            contentInner: 'pb-3 text-xs leading-relaxed text-emerald-200'
          }}
        >
          <p class="text-emerald-400">[12:34:01] GET /api/health 200 2ms</p>
          <p class="text-emerald-400">[12:34:03] POST /api/users 201 45ms</p>
          <p class="text-emerald-300">[12:34:05] Listening on :3000</p>
        </AccordionItem>
      </Accordion>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      The frosted-glass and terminal treatments above are preset material: register the
      <code class="text-text-primary">slotClasses</code> combination once under
      <code class="text-text-primary">presets.Accordion</code>
      /
      <code class="text-text-primary">presets.AccordionItem</code> on
      <code class="text-text-primary">BlocksProvider</code>
      and opt in per instance via
      <code class="text-text-primary">preset</code> — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
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
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard Navigation</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          moves focus between triggers.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          toggle the focused item. Focus rings use
          <code class="text-text-primary">focus-visible:</code> so they only appear on keyboard navigation,
          never on mouse clicks.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Disabled State</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Disabled triggers get the native
          <code class="text-text-primary">disabled</code> attribute, removing them from the tab
          order and preventing activation. Visual feedback via
          <code class="text-text-primary">opacity-50</code> and
          <code class="text-text-primary">cursor-not-allowed</code>.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The expand/collapse animation uses CSS
          <code class="text-text-primary">grid-template-rows</code> transitions. When
          <code class="text-text-primary">prefers-reduced-motion</code> is enabled, transition durations
          are reduced via the design token system.
        </p>
      </div>
    </div>
  </div>
</Section>
