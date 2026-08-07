<!-- urbicon-ignore raw-tailwind-color — the 10 raw colours are the Customization
     section's subject. Those demos exist to show what `slotClasses`/`unstyled` reach
     that the token system deliberately does not: glassmorphism, a terminal look, a neon
     outline. Tokenising them would delete the example. Every other section on this page
     stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, CheckIcon, CloseIcon, Kbd } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
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

    <CodeExample
      title="Mint micro-interactions"
      description="Mint (Micro-interactions) adds motion feedback and respects prefers-reduced-motion on its own. What matters when picking one is the trigger, not the name: the first row answers the pointer arriving, the second answers the click — use a hover effect to invite, a click effect to confirm. All nine registered effects are here because this is the only place they are listed: the Playground's Mint control offers four of them, and the generated API renders mint as an opaque MintProp with no value list."
      isolate
      previewClass="flex flex-col gap-3"
    >
      <div class="flex flex-wrap items-center gap-3">
        <Button intent="primary" mint="scale">Scale</Button>
        <Button intent="primary" mint="translate">Translate</Button>
        <Button intent="primary" mint="rotate">Rotate</Button>
        <Button intent="primary" mint="glow">Glow</Button>
        <Button intent="secondary" mint="pulse">Pulse</Button>
        <Button intent="secondary" mint="wiggle">Wiggle</Button>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <Button intent="primary" mint="ripple">Ripple</Button>
        <Button intent="primary" mint="bounce">Bounce</Button>
        <Button intent="danger" mint="shake">Shake</Button>
      </div>
    </CodeExample>

    <CodeExample
      title="Layering and tuning effects"
      description="An array layers effects on one element, and an entry can be a config object instead of a name to tune its duration. This is the part the Playground cannot show — its Mint control picks a single value."
      isolate
    >
      <Button intent="primary" mint={['scale', 'ripple']}>Scale + Ripple</Button>
      <Button intent="success" mint={['glow', 'bounce']}>Glow + Bounce</Button>
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

<Section marker id="customization" title="Customization">
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

    <p class="text-text-secondary text-sm leading-relaxed">
      The gradient CTA is the canonical preset case: register it once under
      <code class="text-text-primary">presets.Button</code> on
      <code class="text-text-primary">BlocksProvider</code>
      and every call site becomes
      <code class="text-text-primary">preset="cta"</code> — hover, dark mode, and Mint stay
      coherent. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        Automatically manages <code class="text-text-primary">aria-pressed</code> for toggle
        buttons,
        <code class="text-text-primary">aria-busy</code> during loading, and
        <code class="text-text-primary">aria-disabled</code> when disabled. Focus indication uses
        <code class="text-text-primary">focus-visible:</code> so mouse users see no ring.
      </p>
    </Note>
    <Note title="State Semantics">
      <p>
        <code class="text-text-primary">active</code> = persistent selection (a radio-style segment,
        the current sort column, the selected tool). Set this when the button represents an enduring
        chosen state.
        <code class="text-text-primary">pressed</code> = transient toggle (bold/italic in a toolbar,
        mute/unmute). Set this on a button that flips between two complementary states.
        <code class="text-text-primary">loading</code> = busy; suppresses interaction without removing
        focus.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" />
        to focus,
        <Kbd keys="Enter" />
        /
        <Kbd keys="Space" /> to activate. Loading state disables interaction automatically while keeping
        the button focusable.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        All Mint effects are suppressed when the user enables
        <code class="text-text-primary">prefers-reduced-motion</code>. Transitions, transforms, and
        ripple animations are removed entirely.
      </p>
    </Note>
  </NoteList>
</Section>
