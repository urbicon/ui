<!-- urbicon-ignore token-hallucination — the `accent-fg` hits are the CSS
     custom property `--room-accent-fg` inside quoted stylesheet samples this
     page teaches from: a variable in the room register, not a Tailwind
     utility. -->

<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'what', title: 'What it is' },
    { id: 'rooms', title: 'The Rooms' },
    { id: 'tokens', title: 'Token Catalogue' },
    { id: 'activation', title: 'How It Is Wired Up' },
    { id: 'modes', title: 'Light & Dark' },
    { id: 'override', title: 'Override Recipes' }
  ];

  const activationExample = `<!-- apps/docs/src/app.html — Color Rooms is the shipped default -->
<html lang="en" class="docs-rooms">
  <head>…</head>
  <body>%sveltekit.body%</body>
</html>`;

  const cssImportExample = `/* apps/docs/src/app.css */
@import '@urbicon-ui/blocks/style/index.css';
@import './lib/style/rooms-docs.css';   /* Schibsted, cream paper, room accent */`;

  const roomAccentExample = `// apps/docs/src/routes/+layout.svelte — "Farbe = Familie"
// the page's component family picks the channel, the product area is only the
// fallback; the layout stamps the NAME, never a colour
const room = $derived(channelNameForRoute(page.url.pathname));
// <div class="docs-room-scope" data-room={room}> …

/* route-channel.gen.ts — generated from the docs-gen catalogues */
export const ROUTE_CHANNEL = {
  '/blocks/primitives/button': 'orange',  // action
  '/blocks/primitives/tab':    'teal',    // navigation
  '/auth/components/login-page': 'blue',  // form
  // … one entry per documented component
};

/* rooms-channels.gen.css — generated from the channel register */
:is(.docs-rooms, .docs-room-scope)[data-room='teal'] {
  --room-accent:      oklch(0.632 0.119 175);  /* 3:1 — fills, lines, marks */
  --room-accent-fg:   oklch(0.2 0.038 175);    /* on the accent fill */
  --room-accent-text: oklch(0.532 0.1 175);    /* 4.5:1 — small body text */
}`;

  const deriveExample = `/* rooms-docs.css — the whole primary family is re-derived from the room.
 * Re-declared on BOTH the theme root (so portaled popovers read the room too)
 * AND the .docs-room-scope wrapper (so content is correct at first paint).
 *
 * Two anchors, because the ramp spans two roles: 50–500 hang off the fresh
 * accent (surfaces, lines), 600–950 off the AA text step (ink). */
.docs-rooms,
.docs-rooms .docs-room-scope {
  --color-primary-500: var(--room-accent);
  --color-primary-600: var(--room-accent-text);
  --color-primary-700: color-mix(in oklab, var(--room-accent-text) 80%, #17150f);
  /* … 50–950 via color-mix … */
  --color-primary:         light-dark(var(--color-primary-600), var(--color-primary-500));
  --color-text-on-primary: light-dark(#fbfaf6, var(--room-accent-fg));
}`;

  const lightDarkExample = `/* rooms-docs.css uses light-dark() so every token carries both modes —
 * the room accent is orthogonal, it repaints primary, not the paper. */
.docs-rooms {
  --docs-bg:    light-dark(#f7f5f0, #1a1816);   /* warm cream → warm coffee */
  --docs-paper: light-dark(#fbfaf6, #232220);   /* lighter cream → lighter coffee */
  --docs-ink:   light-dark(#17150f, #f0ede5);   /* warm near-black → warm cream */
  /* … */
}`;

  const overrideExample = `/* Repaint one room (e.g. a warmer navigation teal) — the whole primary family,
   every segment/toggle/button/field on a navigation page follows. Override BOTH
   steps: --room-accent alone would leave the generated text step on the old hue. */
:is(.docs-rooms, .docs-room-scope)[data-room='teal'] {
  --room-accent: #1f6f66;
  --room-accent-text: #17544e;  /* the same hue, deep enough for 4.5:1 on cream */
}

/* Square cards / quieter lift — same --docs-* handles as before. The library
   shadow scale tops out at lg, which is what Rooms already uses, so a LOUDER
   lift means your own value rather than a token. */
.docs-rooms {
  --docs-radius-card: 0;
  --docs-shadow-page: var(--blocks-shadow-sm);
}`;
</script>

<SeoMeta
  title="Color Rooms Theme"
  description="Case study: Color Rooms, the theme that powers the Urbicon UI docs site. A scoped, token-only overlay with a per-family room accent, light/dark via light-dark()."
/>

<DocsPageLayout
  title="Color Rooms"
  description="A case study in scoped theming: the token-only overlay that drives the look of this docs site. Schibsted Grotesk on warm cream paper, with the accent set to the component family the page documents. Activated via a single root class; everything else is CSS custom properties."
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
>
  <!-- What it is ──────────────────────────────────────────── -->
  <Section id="what" title="What it is" class="mb-12">
    <p class="text-text-secondary mb-4 leading-relaxed">
      Color Rooms is the visual identity of this docs site: one grotesk (Schibsted Grotesk) for both
      display and body, JetBrains Mono for meta and code, on warm cream paper. Its signature is that <strong
        >the accent is the room you are in</strong
      >: each component family owns a saturated colour, and the component-page and section-landing
      headers become a full-width colour field that spans everything right of the app sidebar. It is
      implemented as a single CSS file (<code class="text-text-primary"
        >apps/docs/src/lib/style/rooms-docs.css</code
      >) that defines a private <code class="text-text-primary">--docs-*</code> token namespace and
      re-derives the library's primary-token family from the active room when
      <code class="text-text-primary">.docs-rooms</code> is present on the
      <code class="text-text-primary">&lt;html&gt;</code> root.
    </p>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Three things here generalise to any scoped theme: a private token namespace, an accent
      selected by a data attribute, and re-declared derived roles.
    </p>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Every primitive still ships with its library-default look; Color Rooms is a thin
      token-override sheet over the top. Without
      <code class="text-text-primary">.docs-rooms</code> the same page renders in the library
      defaults. That is the test of whether the docs site really is theme-only, and the
      <strong>Docs theme</strong> toggle in the sidebar footer (Rooms / Library) removes the class live
      to prove it.
    </p>

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h3 class="text-text-primary mb-2 text-sm font-semibold">Color Rooms vs. Consumer Apps</h3>
      <p class="text-text-secondary text-sm leading-relaxed">
        Color Rooms is <strong>docs-only</strong>. Consumer apps that depend on
        <code class="text-text-primary">@urbicon-ui/blocks</code> do not import
        <code class="text-text-primary">rooms-docs.css</code> and do not set
        <code class="text-text-primary">.docs-rooms</code>; they live on the library defaults and
        customise via the regular
        <a href={resolve('/customization')} class="text-primary hover:underline"
          >customization ladder</a
        > (class / slotClasses / preset / defaults / overrides / unstyled).
      </p>
    </div>
  </Section>

  <!-- The Rooms ───────────────────────────────────────────── -->
  <Section id="rooms" title="The Rooms" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      A room is a <strong>component family</strong>, not a product area. A component's doc page
      wears the channel of its family — so <code class="text-text-primary">Button</code> and
      <code class="text-text-primary">Tab</code> are different colours even though both live under
      <code class="text-text-primary">/blocks</code>, and
      <code class="text-text-primary">Table</code>
      and the auth <code class="text-text-primary">NotificationListener</code> share one. Pages that document
      no single component (the overviews, /recipes, /icons, /getting-started) fall back to the channel
      of their product area. It is the same register the landing page runs on, so a component's row in
      the landing index and its doc page carry the same colour.
    </p>
    <p class="text-text-secondary mb-6 leading-relaxed">
      The two custom properties (<code class="text-text-primary">--room-accent</code>
      and its foreground
      <code class="text-text-primary">--room-accent-fg</code>) resolve from a
      <code class="text-text-primary">data-room</code> stamp on the
      <code class="text-text-primary">.docs-room-scope</code> wrapper, and the whole primary-token
      family is re-derived from them via <code class="text-text-primary">color-mix()</code>.
      Navigating therefore repaints every real component on the page — segment indicator, slider,
      toggle, buttons, TOC-active, badges — with no per-component override.
    </p>

    <div class="border-border-subtle bg-surface-base rounded-contain mb-6 overflow-hidden border">
      <table class="text-text-secondary w-full text-left text-sm">
        <thead
          class="border-border-subtle text-text-primary border-b text-xs tracking-wider uppercase"
        >
          <tr>
            <th class="px-4 py-3 font-semibold">Channel</th>
            <th class="px-4 py-3 font-semibold">Family</th>
            <th class="px-4 py-3 font-semibold">Area fallback</th>
          </tr>
        </thead>
        <tbody class="divide-border-subtle divide-y">
          <tr>
            <td class="px-4 py-3">orange <span class="text-text-tertiary">(default)</span></td>
            <td class="px-4 py-3"><code>action</code></td>
            <td class="px-4 py-3"><code>/blocks/**</code> + everything unclaimed</td>
          </tr>
          <tr>
            <td class="px-4 py-3">cyan</td>
            <td class="px-4 py-3"><code>data</code></td>
            <td class="px-4 py-3"><code>/table/**</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3">magenta</td>
            <td class="px-4 py-3"><code>ai</code></td>
            <td class="px-4 py-3"><code>/ai/**</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3">blue</td>
            <td class="px-4 py-3"><code>form</code></td>
            <td class="px-4 py-3"><code>/auth/**</code> (8 of its 14 are form)</td>
          </tr>
          <tr>
            <td class="px-4 py-3">teal</td>
            <td class="px-4 py-3"><code>navigation</code></td>
            <td class="px-4 py-3">—</td>
          </tr>
          <tr>
            <td class="px-4 py-3">azure</td>
            <td class="px-4 py-3"><code>display</code></td>
            <td class="px-4 py-3">—</td>
          </tr>
          <tr>
            <td class="px-4 py-3">purple</td>
            <td class="px-4 py-3"><code>overlay</code></td>
            <td class="px-4 py-3">—</td>
          </tr>
          <tr>
            <td class="px-4 py-3">red</td>
            <td class="px-4 py-3"><code>feedback</code></td>
            <td class="px-4 py-3">—</td>
          </tr>
          <tr>
            <td class="px-4 py-3">ink</td>
            <td class="px-4 py-3"><code>layout</code></td>
            <td class="px-4 py-3">—</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-text-tertiary mb-6 text-xs leading-relaxed">
      Both tables — route → channel and channel → accent triple — are generated by
      <code class="text-text-primary">apps/docs/scripts/channels-gen.ts</code> from the docs-gen catalogues
      and the channel register. No hex is hand-kept: each channel is measured, not picked. The accent
      step is the lightest one that still clears 3:1 against the paper (the threshold for a fill, a line
      or a mark); the text step is the lightest one that clears 4.5:1 (the threshold for small body text).
      The generator refuses to emit a channel whose foreground does not clear 4.5:1 on its own fill, or
      whose text step does not clear AA on the paper it stands on — in both light and dark.
    </p>

    <CodeExample
      title="Route → channel"
      code={roomAccentExample}
      language="typescript"
      preview={false}
    />

    <p class="text-text-secondary my-4 leading-relaxed">
      The derivation is re-declared in two scopes on purpose. Content reads the room from the
      <code class="text-text-primary">.docs-room-scope</code> wrapper — SSR-correct, so the first
      paint already carries the right accent with no flash. Portaled popovers (the Select / Combobox
      / Menu dropdowns) mount at <code class="text-text-primary">&lt;body&gt;</code>, outside that
      wrapper, so the same accent is mirrored onto
      <code class="text-text-primary">&lt;html&gt;</code>
      after mount — they only open on interaction, always post-hydration, so there is no first-paint concern
      for them.
    </p>

    <CodeExample title="color-mix derivation" code={deriveExample} language="css" preview={false} />

    <p class="text-text-tertiary mt-3 text-xs leading-relaxed">
      A scoped theme has to re-declare its derived semantic tokens: a
      <code class="text-text-primary">var()</code> inside a
      <code class="text-text-primary">:root</code>
      token definition substitutes at the cascade level where it is defined, so overriding the ramp alone
      won't re-resolve <code class="text-text-primary">--color-primary</code> &amp; co. The general
      pattern is
      <a href={`${resolve('/customization/themes')}#scoped`} class="text-primary hover:underline"
        >Scoped Themes</a
      >.
    </p>
  </Section>

  <!-- Token Catalogue ────────────────────────────────────── -->
  <Section id="tokens" title="Token Catalogue" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      The <code class="text-text-primary">--docs-*</code> namespace holds the paper/ink hierarchy;
      the primary family is derived from the room (above). Color Rooms also binds a handful of
      library semantic tokens to the <code class="text-text-primary">--docs-*</code> values so
      components rendered inside <code class="text-text-primary">.docs-rooms</code> pick up the warm palette
      without per-component opt-in.
    </p>

    <h3 class="text-text-primary mb-2 text-lg font-semibold">Docs-private tokens</h3>
    <div class="border-border-subtle bg-surface-base rounded-contain mb-6 overflow-hidden border">
      <table class="text-text-secondary w-full text-left text-sm">
        <thead
          class="border-border-subtle text-text-primary border-b text-xs tracking-wider uppercase"
        >
          <tr>
            <th class="px-4 py-3 font-semibold">Token</th>
            <th class="px-4 py-3 font-semibold">Default (light · dark)</th>
            <th class="px-4 py-3 font-semibold">Used for</th>
          </tr>
        </thead>
        <tbody class="divide-border-subtle divide-y">
          <tr>
            <td class="px-4 py-3"><code>--room-accent</code></td>
            <td class="px-4 py-3"><code>per channel</code></td>
            <td class="px-4 py-3"
              >The fresh room colour (≥3:1) — header bands, lines, marks, focus ring, charts.</td
            >
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--room-accent-fg</code></td>
            <td class="px-4 py-3"><code>per channel</code></td>
            <td class="px-4 py-3"
              >On-accent ink/cream — text on the field + on dark-mode primary fills.</td
            >
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--room-accent-text</code></td>
            <td class="px-4 py-3"><code>per channel</code></td>
            <td class="px-4 py-3"
              >The same channel one step deeper (≥4.5:1) — small body text in light mode: links, the
              active nav entry, the breadcrumb.</td
            >
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-bg</code></td>
            <td class="px-4 py-3"><code>#f7f5f0 · #1a1816</code></td>
            <td class="px-4 py-3">Ground — the page surface outside content blocks.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-paper</code></td>
            <td class="px-4 py-3"><code>#fbfaf6 · #232220</code></td>
            <td class="px-4 py-3">Content surface — where library components sit.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-lifted</code></td>
            <td class="px-4 py-3"><code>#fefdfa · #2a2826</code></td>
            <td class="px-4 py-3">Elevated surface — the cream ladder one step above paper.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-floating</code></td>
            <td class="px-4 py-3"><code>#ffffff · #322f2c</code></td>
            <td class="px-4 py-3">Highest surface — dialogs, drawers, toasts.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-ink</code></td>
            <td class="px-4 py-3"><code>#17150f · #f0ede5</code></td>
            <td class="px-4 py-3">Primary text ink.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-soft</code></td>
            <td class="px-4 py-3"><code>#635f58 · #aaa79d</code></td>
            <td class="px-4 py-3"
              >Body-soft / meta ink (ON THIS PAGE labels, descriptions) — carries secondary
              <em>and</em> tertiary text.</td
            >
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-softer</code></td>
            <td class="px-4 py-3"><code>#b8b5ad · #5a574f</code></td>
            <td class="px-4 py-3">Decoration ink — kicker separators. Never body text.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-soft-paper</code></td>
            <td class="px-4 py-3"><code>#635f58 · #aaa79d</code></td>
            <td class="px-4 py-3"
              >The on-paper value the two above alias. A colour field re-points
              <code>--docs-soft</code> at its own foreground; an overlay opened from inside one paints
              paper, so it needs these back.</td
            >
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-softer-paper</code></td>
            <td class="px-4 py-3"><code>#b8b5ad · #5a574f</code></td>
            <td class="px-4 py-3">Same, for the decoration step.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-hair</code></td>
            <td class="px-4 py-3"><code>ink/8% · cream/8%</code></td>
            <td class="px-4 py-3">Hairline — barely-visible structural lines.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-line</code></td>
            <td class="px-4 py-3"><code>ink/14% · cream/14%</code></td>
            <td class="px-4 py-3">The visible rule — one step up from the hairline.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-accent</code></td>
            <td class="px-4 py-3"><code>var(--color-primary)</code></td>
            <td class="px-4 py-3">Link colour, section markers — couples to the room primary.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-radius-pill</code></td>
            <td class="px-4 py-3"><code>var(--radius-commit)</code></td>
            <td class="px-4 py-3">Pill geometry for the editorial-lineage cards.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-radius-card</code></td>
            <td class="px-4 py-3"><code>var(--radius-contain)</code></td>
            <td class="px-4 py-3">Bento-cards, recipe-stages — tight for the hard-edge poster.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-shadow-page</code></td>
            <td class="px-4 py-3"><code>var(--blocks-shadow-lg)</code></td>
            <td class="px-4 py-3">Lift shadow — bento and recipe stages.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-measure</code></td>
            <td class="px-4 py-3"><code>46rem</code></td>
            <td class="px-4 py-3">The reading edge — prose only, not the exhibit column.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-prose-size</code></td>
            <td class="px-4 py-3"><code>1.0625rem</code></td>
            <td class="px-4 py-3">Body copy — set here, not per page.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-prose-leading</code></td>
            <td class="px-4 py-3"><code>1.7</code></td>
            <td class="px-4 py-3">Body leading, paired with the size above.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--font-display / --font-sans</code></td>
            <td class="px-4 py-3">Schibsted Grotesk Variable</td>
            <td class="px-4 py-3">Display + body — one grotesk (self-hosted via @fontsource).</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--font-mono</code></td>
            <td class="px-4 py-3">JetBrains Mono · system mono</td>
            <td class="px-4 py-3">Code, kbd, meta kickers (self-hosted via @fontsource).</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 class="text-text-primary mb-2 text-lg font-semibold">Library semantic overrides</h3>
    <p class="text-text-secondary mb-3 text-sm leading-relaxed">
      Color Rooms rebinds these library semantic tokens inside
      <code class="text-text-primary">.docs-rooms</code> so library components automatically pick up the
      warm palette and the room accent. The surface ladder, warm-neutral border/state ramp and warm-tuned
      intent colours (secondary/success/warning/danger) are re-pointed too so the whole page reads warm
      rather than cool.
    </p>
    <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
      <table class="text-text-secondary w-full text-left text-sm">
        <thead
          class="border-border-subtle text-text-primary border-b text-xs tracking-wider uppercase"
        >
          <tr>
            <th class="px-4 py-3 font-semibold">Library token</th>
            <th class="px-4 py-3 font-semibold">Color Rooms value</th>
          </tr>
        </thead>
        <tbody class="divide-border-subtle divide-y">
          <tr>
            <td class="px-4 py-3"><code>--color-primary</code></td>
            <td class="px-4 py-3"
              ><code>light-dark(var(--room-accent-text), var(--room-accent))</code></td
            >
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-text-on-primary</code></td>
            <td class="px-4 py-3"><code>light-dark(#fbfaf6, var(--room-accent-fg))</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-surface-base</code></td>
            <td class="px-4 py-3"><code>var(--docs-paper)</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-surface-quiet</code></td>
            <td class="px-4 py-3"><code>var(--docs-bg)</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-surface-elevated</code></td>
            <td class="px-4 py-3"><code>var(--docs-lifted)</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-surface-overlay</code></td>
            <td class="px-4 py-3"><code>var(--docs-floating)</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-border-hairline</code></td>
            <td class="px-4 py-3"><code>var(--docs-hair)</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-text-primary</code></td>
            <td class="px-4 py-3"><code>var(--docs-ink)</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-text-secondary</code></td>
            <td class="px-4 py-3"><code>var(--docs-soft)</code></td>
          </tr>
        </tbody>
      </table>
    </div>
  </Section>

  <!-- How it is wired up ──────────────────────────────────── -->
  <Section id="activation" title="How It Is Wired Up" class="mb-12">
    <p class="text-text-secondary mb-4 leading-relaxed">
      The theme activates when <code class="text-text-primary">.docs-rooms</code> sits on a parent
      of the content. The docs app puts it on <code class="text-text-primary">&lt;html&gt;</code>
      so the whole app inherits the warm canvas, and so the
      <code class="text-text-primary">app.html</code> head script can flip it before first paint
      (the root element exists there, <code class="text-text-primary">&lt;body&gt;</code> does not
      yet). The per-route room accent then lives on the
      <code class="text-text-primary">.docs-room-scope</code> wrapper in the layout.
    </p>

    <CodeExample title="The root class" code={activationExample} language="html" preview={false} />

    <p class="text-text-secondary my-4 leading-relaxed">
      The stylesheet is imported after the library base:
    </p>

    <CodeExample title="The import" code={cssImportExample} language="css" preview={false} />

    <p class="text-text-secondary mt-4 leading-relaxed">
      Remove the class (the sidebar's <strong>Docs theme → Library</strong> toggle does exactly
      this) and the page falls back to the bare library skin: no field header, no Schibsted, the
      library's blue primary. The underlying mechanism is the scoped-theme pattern from
      <a href={`${resolve('/customization/themes')}#scoped`} class="text-primary hover:underline"
        >Scoped Themes</a
      >; Color Rooms just rebinds a wider set of tokens and derives them from the room.
    </p>
  </Section>

  <!-- Light & Dark ─────────────────────────────────────────── -->
  <Section id="modes" title="Light &amp; Dark" class="mb-12">
    <p class="text-text-secondary mb-4 leading-relaxed">
      Color Rooms supports both light and dark out of the box: Light is warm cream paper with warm
      dark ink, Dark is warm coffee paper with warm cream ink. The room accent is
      <strong>orthogonal</strong> to the mode: it repaints the primary family, not the paper, so a section
      stays the same colour in both modes and the docs' ThemeSwitcher keeps working.
    </p>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Implementation uses CSS's <code class="text-text-primary">light-dark()</code> function. Each
      paper/ink token resolves at use-site based on the page's
      <code class="text-text-primary">color-scheme</code>, which the library's semantic layer sets
      via <code class="text-text-primary">:root.light</code> /
      <code class="text-text-primary">:root.dark</code>. A single rule block covers both modes — no
      second sheet, no JS-driven swap.
    </p>
    <p class="text-text-secondary mb-4 leading-relaxed">
      One thing the accent cannot be orthogonal about is <strong>text contrast</strong>, and that is
      why a room carries two accent steps rather than one. No single colour clears AA on both
      papers: 4.5:1 against the cream needs a relative luminance of at most 0.173, 4.5:1 against the
      coffee needs at least 0.247. So the text role is itself a
      <code class="text-text-primary">light-dark()</code> pair — the deeper
      <code class="text-text-primary">--room-accent-text</code> on cream, and the fresh
      <code class="text-text-primary">--room-accent</code> on coffee, where it already measures 4.9:1.
      Surfaces, lines and marks keep the fresh step in both modes.
    </p>

    <CodeExample
      title="Light/Dark via light-dark()"
      code={lightDarkExample}
      language="css"
      preview={false}
    />

    <p class="text-text-tertiary mt-3 text-xs leading-relaxed">
      The same mechanism powers <code class="text-text-primary">semantic.css</code>: see
      <a href={`${resolve('/customization/themes')}#dark-mode`} class="text-primary hover:underline"
        >Themes → Dark Mode</a
      >
      for the library-side details.
    </p>
  </Section>

  <!-- Override Recipes ────────────────────────────────────── -->
  <Section id="override" title="Override Recipes" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Every value lives on a CSS custom property, so the theme is adjustable at any scope: globally
      inside <code class="text-text-primary">.docs-rooms</code>, per-room on
      <code class="text-text-primary">.docs-room-scope</code>, or inline. Two moves worth copying
      into a scoped theme of your own: repaint one scope's accent (both steps, or the generated text
      step keeps the old hue), and re-point the geometry handles.
    </p>

    <CodeExample title="Common overrides" code={overrideExample} language="css" preview={false} />

    <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
      For brand-wide theming (the library's own primary colour, the tier radii) reach for the
      <a href={resolve('/customization/theme-builder')} class="text-primary hover:underline">
        Theme Builder</a
      >
      or write a custom <code class="text-text-primary">@theme</code> block. Color Rooms sits
      <em>on top</em> of that and, per room, overrides the primary chain with the room accent.
    </p>
  </Section>
</DocsPageLayout>
