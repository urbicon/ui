<!-- urbicon-ignore raw-tailwind-color — the Customization demo gives the button a neon outline
     with one `class`: it keeps the button's radius tier, padding and press behaviour, and only
     the border, text and glow are raw — a neon hue the token palette has no equivalent for. Every
     other section on this page stays under the rule. -->
<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { ArrowRightIcon, Button, DownloadIcon, Kbd, PlusIcon } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let formats = $state([
    { name: 'Bold', on: true },
    { name: 'Italic', on: false },
    { name: 'Underline', on: false }
  ]);

  let saving = $state(false);
  function save() {
    saving = true;
    setTimeout(() => (saving = false), 1500);
  }
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Toggle buttons"
      description="`active` marks a button as selected or on and sets `aria-pressed` for you. Reach for it when the choice persists, like a formatting toggle that stays lit. `pressed` is its momentary cousin for a press-and-release cue. Both are booleans you drive from your own state."
      isolate
      previewClass="flex flex-wrap items-center gap-2"
    >
      {#each formats as fmt (fmt.name)}
        <Button variant="ghost" intent="primary" active={fmt.on} onclick={() => (fmt.on = !fmt.on)}>
          {fmt.name}
        </Button>
      {/each}
    </CodeExample>

    <CodeExample
      title="Icons and labels"
      description={"Put an icon in the button's content, before or after the label. The gap between icon and label comes from the button's `size`, so it tracks the button, while the glyph keeps whatever size you set on the icon (`size={18}` here)."}
      isolate
      previewClass="flex flex-wrap items-center gap-3"
    >
      <Button intent="primary"><PlusIcon size={18} />New project</Button>
      <Button variant="outlined" intent="neutral"><DownloadIcon size={18} />Export</Button>
      <Button variant="text" intent="primary">Continue<ArrowRightIcon size={18} /></Button>
    </CodeExample>

    <CodeExample
      title="Submit with a loading state"
      description="Flip `loading` while a request is in flight. The button blocks activation but stays focusable, so the action can't double-fire. `loadingPlacement=start` keeps the label beside the spinner, where the default `overlay` hides it behind the spinner instead."
      isolate
      previewClass="flex flex-wrap items-center gap-3"
    >
      <Button intent="primary" loading={saving} loadingPlacement="start" onclick={save}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </CodeExample>

    <CodeExample
      title="Composing micro-interactions"
      description="`mint` layers motion feedback: pass an array to stack effects, or an object to tune a duration. The Playground's Mint control picks one effect at a time, so arrays and per-effect config appear only here. Nine effects ship. Six are held on hover (`scale`, `translate`, `rotate`, `glow`, `pulse`, `wiggle`) and three fire on click (`ripple`, `bounce`, `shake`)."
      isolate
      previewClass="flex flex-wrap items-center gap-3"
    >
      <Button intent="primary" mint={['scale', 'ripple']}>Scale + Ripple</Button>
      <Button intent="success" mint={['glow', 'bounce']}>Glow + Bounce</Button>
      <Button intent="warning" mint={[{ name: 'glow', config: { duration: 500 } }]}
        >Slow Glow</Button
      >
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Neon outline"
      description="One `class` gives the button a neon outline glowing on a dark panel. It keeps the button's radius tier, padding and press behaviour, and only the border, text and glow are raw. The colours are raw because a neon hue has no token equivalent."
      isolate
      previewClass="flex flex-wrap items-center gap-4 rounded-xl bg-neutral-950 px-8 py-6"
    >
      <Button
        class="border border-emerald-400 bg-transparent text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)] hover:bg-emerald-400/10 hover:shadow-[0_0_25px_rgba(52,211,153,0.5)]"
      >
        Deploy
      </Button>
      <Button
        class="border border-sky-400 bg-transparent text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)] hover:bg-sky-400/10 hover:shadow-[0_0_25px_rgba(56,189,248,0.5)]"
      >
        Preview
      </Button>
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
        The button manages <code class="text-text-primary">aria-pressed</code> for toggle and
        selected states, <code class="text-text-primary">aria-busy</code> while loading, and
        <code class="text-text-primary">aria-disabled</code> when disabled. Focus indication uses
        <code class="text-text-primary">focus-visible</code>, so the ring appears only for keyboard
        focus.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        <Kbd keys="Tab" /> moves focus. <Kbd keys="Enter" /> / <Kbd keys="Space" /> activate. While loading,
        the button ignores activation but stays focusable.
      </p>
    </Note>
    <Note title="Reduced motion">
      <p>
        Mint effects respect <code class="text-text-primary">prefers-reduced-motion</code>: with it
        enabled, the hover and click animations are suppressed and the ripple is never drawn.
      </p>
    </Note>
  </NoteList>
</Section>
