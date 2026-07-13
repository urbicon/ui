<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Button, CheckIcon, CloseIcon } from '@urbicon-ui/blocks';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: [
          'variant',
          'size',
          'tier',
          'intent',
          'loadingPlacement',
          'mint',
          'children',
          'loading',
          'disabled',
          'active',
          'pressed'
        ],
        defaults: {
          variant: 'filled',
          size: 'lg',
          tier: 'commit',
          intent: 'primary',
          mint: 'scale'
        },
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
    meta: { title: 'Button Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="States Matrix"
      description="Same visual state, different semantics: active = persistent selection (e.g., a radio-style segment), pressed = transient toggle (e.g., bold/italic in a toolbar), loading = busy. ARIA mirrors the chosen prop — active → aria-pressed=true; pressed → aria-pressed=true; both off → omitted."
      isolate
    >
      <div
        role="group"
        aria-label="Visual states reference — non-interactive demo grid"
        class="flex flex-col items-start gap-3"
      >
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="filled" intent="primary">Default</Button>
          <Button variant="filled" intent="primary" active>Active</Button>
          <Button variant="filled" intent="primary" pressed>Pressed</Button>
          <Button variant="filled" intent="primary" loading>Loading</Button>
          <Button variant="filled" intent="primary" disabled>Disabled</Button>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="outlined" intent="primary">Default</Button>
          <Button variant="outlined" intent="primary" active>Active</Button>
          <Button variant="outlined" intent="primary" pressed>Pressed</Button>
          <Button variant="outlined" intent="primary" loading>Loading</Button>
          <Button variant="outlined" intent="primary" disabled>Disabled</Button>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="ghost" intent="primary">Default</Button>
          <Button variant="ghost" intent="primary" active>Active</Button>
          <Button variant="ghost" intent="primary" pressed>Pressed</Button>
          <Button variant="ghost" intent="primary" loading>Loading</Button>
          <Button variant="ghost" intent="primary" disabled>Disabled</Button>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <Button variant="text" intent="primary">Default</Button>
          <Button variant="text" intent="primary" active>Active</Button>
          <Button variant="text" intent="primary" pressed>Pressed</Button>
          <Button variant="text" intent="primary" loading>Loading</Button>
          <Button variant="text" intent="primary" disabled>Disabled</Button>
        </div>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Mint Micro-Interactions ─── -->

<Section marker="02" id="mint" title="Mint Micro-Interactions">
  <div class="space-y-8">
    <p class="text-text-secondary text-sm">
      Mint (<strong>M</strong>icro-<strong>int</strong>eractions) adds subtle motion feedback to any
      component. Each effect is triggered on hover or click and automatically respects
      <code>prefers-reduced-motion</code>.
    </p>

    <CodeExample
      title="Hover Effects"
      description="Triggered when the user hovers over the button."
      isolate
    >
      <Button intent="primary" mint="scale">Scale</Button>
      <Button intent="primary" mint="translate">Translate</Button>
      <Button intent="primary" mint="rotate">Rotate</Button>
      <Button intent="primary" mint="glow">Glow</Button>
      <Button intent="secondary" mint="pulse">Pulse</Button>
      <Button intent="secondary" mint="wiggle">Wiggle</Button>
    </CodeExample>

    <CodeExample title="Click Effects" description="Triggered on click/tap interaction." isolate>
      <Button intent="primary" mint="ripple">Ripple</Button>
      <Button intent="primary" mint="bounce">Bounce</Button>
      <Button intent="danger" mint="shake">Shake</Button>
    </CodeExample>

    <CodeExample
      title="Combined Effects"
      description="Pass an array to layer multiple effects on the same element."
      isolate
    >
      <Button intent="primary" mint={['scale', 'ripple']}>Scale + Ripple</Button>
      <Button intent="success" mint={['glow', 'bounce']}>Glow + Bounce</Button>
      <Button intent="secondary" mint={['translate', 'ripple']}>Translate + Ripple</Button>
    </CodeExample>

    <CodeExample
      title="Configured Effects"
      description="Fine-tune individual effects with config objects."
      isolate
    >
      <Button intent="primary" mint={[{ name: 'scale', config: { duration: 200 } }, 'ripple']}
        >Fast Scale + Ripple</Button
      >
      <Button intent="warning" mint={[{ name: 'glow', config: { duration: 500 } }]}
        >Slow Glow</Button
      >
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="03" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Gradient CTA"
      description="A single slotClasses override turns a standard button into a vibrant call-to-action."
      isolate
    >
      <Button
        size="lg"
        mint={['scale', 'ripple']}
        slotClasses={{
          base: 'bg-linear-to-r from-violet-600 to-fuchsia-500 border-none shadow-lg shadow-violet-500/30 hover:shadow-violet-500/50'
        }}
      >
        Launch Project
      </Button>
    </CodeExample>

    <CodeExample
      title="Pill & Icon-only"
      description="Override the base slot's border-radius with slotClasses – tailwind-merge resolves the conflict automatically."
      isolate
    >
      <Button variant="outlined" intent="primary" slotClasses={{ base: 'rounded-full' }}
        >Subscribe</Button
      >
      <Button
        variant="ghost"
        intent="neutral"
        aria-label="Confirm"
        slotClasses={{ base: 'rounded-full p-0 w-10' }}
      >
        <CheckIcon size={20} />
      </Button>
      <Button
        variant="filled"
        intent="danger"
        aria-label="Cancel"
        slotClasses={{ base: 'rounded-full p-0 w-10' }}
      >
        <CloseIcon size={20} />
      </Button>
    </CodeExample>

    <CodeExample
      title="Neon Outline"
      description="For custom glow shadows, unstyled gives full control – no conflicts with the variant's built-in shadow tokens."
      isolate
      previewClass="flex items-center gap-4 rounded-xl bg-neutral-950 px-8 py-6"
    >
      <Button
        unstyled
        class="rounded-lg border border-emerald-400 px-5 py-2.5 font-medium text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all hover:bg-emerald-400/10 hover:shadow-[0_0_25px_rgba(52,211,153,0.5)]"
      >
        Neon Green
      </Button>
      <Button
        unstyled
        class="rounded-lg border border-sky-400 px-5 py-2.5 font-medium text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)] transition-all hover:bg-sky-400/10 hover:shadow-[0_0_25px_rgba(56,189,248,0.5)]"
      >
        Neon Blue
      </Button>
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Drop all default styles and build from scratch. Loading, disabled, mint – all behavioral props still work."
      isolate
    >
      <Button
        unstyled
        mint="scale"
        class="inline-flex items-center gap-3 rounded-2xl bg-linear-to-br from-amber-200 to-orange-400 px-8 py-4 font-bold text-neutral-900 shadow-xl transition-all hover:shadow-2xl"
      >
        Unstyled Magic
      </Button>
      <Button
        unstyled
        mint="scale"
        class="text-text-primary hover:bg-text-primary hover:text-surface-base inline-flex items-center gap-2 rounded-none border-2 border-current px-6 py-3 font-mono text-sm font-bold tracking-widest uppercase transition-all"
      >
        Brutalist
      </Button>
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="04" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Built-in ARIA</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Automatically manages <code class="text-text-primary">aria-pressed</code> for toggle
          buttons,
          <code class="text-text-primary">aria-busy</code> during loading, and
          <code class="text-text-primary">aria-disabled</code> when disabled. Focus indication uses
          <code class="text-text-primary">focus-visible:</code> so mouse users see no ring.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">State Semantics</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <code class="text-text-primary">active</code> = persistent selection (a radio-style
          segment, the current sort column, the selected tool). Set this when the button represents
          an enduring chosen state.
          <code class="text-text-primary">pressed</code> = transient toggle (bold/italic in a
          toolbar, mute/unmute). Set this on a button that flips between two complementary states.
          <code class="text-text-primary">loading</code> = busy; suppresses interaction without removing
          focus.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Keyboard</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          to focus,
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          > to activate. Loading state disables interaction automatically while keeping the button focusable.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced Motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          All Mint effects are suppressed when the user enables
          <code class="text-text-primary">prefers-reduced-motion</code>. Transitions, transforms,
          and ripple animations are removed entirely.
        </p>
      </div>
    </div>
  </div>
</Section>
