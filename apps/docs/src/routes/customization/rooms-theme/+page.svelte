<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'what', title: 'What it is', order: 1 },
    { id: 'rooms', title: 'The Rooms', order: 2 },
    { id: 'tokens', title: 'Token Catalogue', order: 3 },
    { id: 'activation', title: 'Activation', order: 4 },
    { id: 'modes', title: 'Light & Dark', order: 5 },
    { id: 'override', title: 'Override Recipes', order: 6 }
  ];

  const activationExample = `<!-- apps/docs/src/app.html — Color Rooms is the shipped default -->
<html lang="en" class="docs-rooms">
  <head>…</head>
  <body>%sveltekit.body%</body>
</html>`;

  const cssImportExample = `/* apps/docs/src/app.css */
@import '@urbicon-ui/blocks/style/index.css';
@import './lib/style/rooms-docs.css';   /* Schibsted, cream paper, room accent */`;

  const roomAccentExample = `// apps/docs/src/routes/+layout.svelte — "Farbe = Ort"
// the top-level route segment picks the room (fallback: blocks); the layout
// only stamps the NAME — colour values live solely in rooms-docs.css
const ROOM_SEGMENTS = new Set(['blocks', 'table', 'auth', 'ai']);
const room = $derived.by(() => {
  const seg = page.url.pathname.split('/')[1] ?? '';
  return ROOM_SEGMENTS.has(seg) ? seg : 'blocks';
});
// <div class="docs-room-scope" data-room={room}> …

/* rooms-docs.css — route → room mapping (single source of the colours) */
:is(.docs-rooms, .docs-room-scope)[data-room='table'] {
  --room-accent: #7c1f2d;
  --room-accent-fg: #f6f3ec;
}`;

  const deriveExample = `/* rooms-docs.css — the whole primary family is re-derived from the room.
 * Re-declared on BOTH the theme root (so portaled popovers read the room too)
 * AND the .docs-room-scope wrapper (so content is correct at first paint). */
.docs-rooms,
.docs-rooms .docs-room-scope {
  --color-primary-500: var(--room-accent);
  --color-primary-600: color-mix(in oklab, var(--room-accent) 86%, #17150f);
  /* … 50–950 via color-mix … */
  --color-primary:         var(--room-accent);
  --color-text-on-primary: var(--room-accent-fg);
}`;

  const lightDarkExample = `/* rooms-docs.css uses light-dark() so every token carries both modes —
 * the room accent is orthogonal, it repaints primary, not the paper. */
.docs-rooms {
  --docs-bg:    light-dark(#f7f5f0, #1a1816);   /* warm cream → warm coffee */
  --docs-paper: light-dark(#fbfaf6, #232220);   /* lighter cream → lighter coffee */
  --docs-ink:   light-dark(#17150f, #f0ede5);   /* warm near-black → warm cream */
  /* … */
}`;

  const overrideExample = `/* Repaint one room (e.g. a warmer table wine) — the whole primary family,
   every segment/toggle/button/field on /table follows. */
.docs-room-scope { --room-accent: #8a2433; }

/* Tighter card geometry / louder lift — same --docs-* handles as before */
.docs-rooms {
  --docs-radius-card: var(--radius-contain);
  --docs-shadow-page: var(--blocks-shadow-xl);
}`;
</script>

<SeoMeta
  title="Color Rooms Theme"
  description="Color Rooms — the theme that powers the Urbicon UI docs site. Schibsted Grotesk on warm cream paper, a per-section room accent that repaints every real component, and full-width colour-field headers. What it is, its tokens, how to activate or override it, and how Light/Dark works inside it."
/>

<DocsPageLayout
  title="Color Rooms"
  description="A token-only overlay on top of the Urbicon UI library that drives the look of this docs site — Schibsted Grotesk on warm cream paper, with the accent set to the room (section) you are in. Activated via a single root class; everything else is CSS custom properties."
  {navigation}
  showToc
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
>
  <!-- What it is ──────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="what">What it is</h2>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Color Rooms is the visual identity of this docs site — one grotesk (Schibsted Grotesk) for
      both display and body, JetBrains Mono for meta and code, on warm cream paper. Its signature is
      that <strong>the accent is the room you are in</strong>: each product area owns a saturated
      colour, and the component-page and section-landing headers become a full-width colour field
      that spans everything right of the app sidebar. It is implemented as a single CSS file (<code
        class="text-text-primary">apps/docs/src/lib/style/rooms-docs.css</code
      >) that defines a private <code class="text-text-primary">--docs-*</code> token namespace and
      re-derives the library's primary-token family from the active room when
      <code class="text-text-primary">.docs-rooms</code> is present on the
      <code class="text-text-primary">&lt;html&gt;</code> root.
    </p>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Nothing in the library has been forked or duplicated. Every primitive still ships with its
      library-default look; Color Rooms is a thin token-override sheet over the top. Without
      <code class="text-text-primary">.docs-rooms</code> the same page renders in the library
      defaults — that's the test of whether the docs site really is theme-only. The
      <strong>Docs theme</strong> toggle in the sidebar footer (Rooms / Library) removes the class live
      to prove it.
    </p>

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h4 class="text-text-primary mb-2 text-sm font-semibold">Color Rooms vs. Consumer Apps</h4>
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
  </section>

  <!-- The Rooms ───────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="rooms">The Rooms</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Four rooms, one per product area. The top-level route segment picks the room; everything
      outside the four areas falls back to the blocks green. The two custom properties (<code
        class="text-text-primary">--room-accent</code
      >
      and its foreground
      <code class="text-text-primary">--room-accent-fg</code>) are fed in from the layout onto a
      <code class="text-text-primary">.docs-room-scope</code> wrapper, and the whole primary-token
      family is re-derived from them via <code class="text-text-primary">color-mix()</code>.
      Switching route therefore repaints every real component on the page — segment indicator,
      slider, toggle, buttons, TOC-active, badges — with no per-component override.
    </p>

    <div class="border-border-subtle bg-surface-base rounded-contain mb-6 overflow-hidden border">
      <table class="text-text-secondary w-full text-left text-sm">
        <thead
          class="border-border-subtle text-text-primary border-b text-xs tracking-wider uppercase"
        >
          <tr>
            <th class="px-4 py-3 font-semibold">Room</th>
            <th class="px-4 py-3 font-semibold">Route</th>
            <th class="px-4 py-3 font-semibold">Accent · Foreground</th>
          </tr>
        </thead>
        <tbody class="divide-border-subtle divide-y">
          <tr>
            <td class="px-4 py-3">Blocks <span class="text-text-tertiary">(default)</span></td>
            <td class="px-4 py-3"><code>/blocks/**</code></td>
            <td class="px-4 py-3"><code>#00845c</code> · <code>#f6f3ec</code> — green</td>
          </tr>
          <tr>
            <td class="px-4 py-3">Table</td>
            <td class="px-4 py-3"><code>/table/**</code></td>
            <td class="px-4 py-3"><code>#7c1f2d</code> · <code>#f6f3ec</code> — wine</td>
          </tr>
          <tr>
            <td class="px-4 py-3">Auth</td>
            <td class="px-4 py-3"><code>/auth/**</code></td>
            <td class="px-4 py-3"><code>#e3a31c</code> · <code>#17150f</code> — amber</td>
          </tr>
          <tr>
            <td class="px-4 py-3">AI &amp; DX</td>
            <td class="px-4 py-3"><code>/ai/**</code></td>
            <td class="px-4 py-3"><code>#e8500f</code> · <code>#17150f</code> — orange</td>
          </tr>
        </tbody>
      </table>
    </div>

    <CodeExample
      title="Route → room"
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
      won't re-resolve <code class="text-text-primary">--color-primary</code> &amp; co. — see
      <a href={resolve('/customization/tier-system')} class="text-primary hover:underline"
        >Tier System</a
      >.
    </p>
  </section>

  <!-- Token Catalogue ────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="tokens">Token Catalogue</h2>
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
            <td class="px-4 py-3"><code>per section</code></td>
            <td class="px-4 py-3">The active room colour — source of the whole primary family.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--room-accent-fg</code></td>
            <td class="px-4 py-3"><code>per section</code></td>
            <td class="px-4 py-3">On-accent ink/cream — text on the field + on primary fills.</td>
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
            <td class="px-4 py-3"><code>--docs-ink</code></td>
            <td class="px-4 py-3"><code>#17150f · #f0ede5</code></td>
            <td class="px-4 py-3">Primary text ink.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-soft</code></td>
            <td class="px-4 py-3"><code>#6e6b64 · #a5a299</code></td>
            <td class="px-4 py-3">Body-soft / meta ink (ON THIS PAGE labels, descriptions).</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-softer</code></td>
            <td class="px-4 py-3"><code>#b8b5ad · #5a574f</code></td>
            <td class="px-4 py-3">Decoration ink — kicker separators.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-hair</code></td>
            <td class="px-4 py-3"><code>ink/8% · cream/8%</code></td>
            <td class="px-4 py-3">Hairline — barely-visible structural lines.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-accent</code></td>
            <td class="px-4 py-3"><code>var(--color-primary)</code></td>
            <td class="px-4 py-3">Link colour, section markers — couples to the room primary.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-radius-card</code></td>
            <td class="px-4 py-3"><code>var(--radius-contain)</code></td>
            <td class="px-4 py-3">Bento-cards, recipe-stages — tight for the hard-edge poster.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-shadow-page</code></td>
            <td class="px-4 py-3"><code>var(--blocks-shadow-lg)</code></td>
            <td class="px-4 py-3">Lift shadow — bento, recipe, showcase stages.</td>
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
            <td class="px-4 py-3"><code>var(--room-accent)</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-text-on-primary</code></td>
            <td class="px-4 py-3"><code>var(--room-accent-fg)</code></td>
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
  </section>

  <!-- Activation ──────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="activation">Activation</h2>
    <p class="text-text-secondary mb-4 leading-relaxed">
      The theme activates when <code class="text-text-primary">.docs-rooms</code> sits on a parent
      of your content. The docs site puts it on <code class="text-text-primary">&lt;html&gt;</code>
      as the shipped default so the whole app inherits the warm canvas — and so the
      <code class="text-text-primary">app.html</code> head script can flip it before first paint
      (the root element exists there, <code class="text-text-primary">&lt;body&gt;</code> does not
      yet). The per-route room accent then lives on the
      <code class="text-text-primary">.docs-room-scope</code> wrapper in the layout.
    </p>

    <CodeExample
      title="1. Set the root class"
      code={activationExample}
      language="html"
      preview={false}
    />

    <p class="text-text-secondary my-4 leading-relaxed">
      And import the stylesheet alongside the library base:
    </p>

    <CodeExample
      title="2. Import rooms-docs.css"
      code={cssImportExample}
      language="css"
      preview={false}
    />

    <p class="text-text-secondary mt-4 leading-relaxed">
      Remove the class (the sidebar's <strong>Docs theme → Library</strong> toggle does exactly
      this) and the page falls back to the bare library skin — no field header, no Schibsted, the
      library's blue primary. The underlying override mechanism is the same CSS-custom-property
      cascade documented in
      <a href={resolve('/customization/tier-system')} class="text-primary hover:underline"
        >Tier System</a
      > — Color Rooms just rebinds a wider set of tokens and derives them from the room.
    </p>
  </section>

  <!-- Light & Dark ─────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="modes">Light &amp; Dark</h2>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Color Rooms supports both light and dark out of the box — Light is warm cream paper with warm
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

    <CodeExample
      title="Light/Dark via light-dark()"
      code={lightDarkExample}
      language="css"
      preview={false}
    />

    <p class="text-text-tertiary mt-3 text-xs leading-relaxed">
      The same mechanism powers <code class="text-text-primary">semantic.css</code> — see
      <a href={resolve('/customization/tokens')} class="text-primary hover:underline"
        >Design Tokens</a
      >
      for the library-side details.
    </p>
  </section>

  <!-- Override Recipes ────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="override">Override Recipes</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Because every value lives on a CSS custom property, you can adjust the theme at any scope —
      globally inside <code class="text-text-primary">.docs-rooms</code>, per-room on
      <code class="text-text-primary">.docs-room-scope</code>, or inline. A few common adjustments:
    </p>

    <CodeExample title="Common overrides" code={overrideExample} language="css" preview={false} />

    <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
      For brand-wide theming (the library's own primary colour, the tier radii) reach for the
      <a href={resolve('/customization/theme-builder')} class="text-primary hover:underline">
        Theme Builder</a
      >
      or write a custom <code class="text-text-primary">@theme</code> block — Color Rooms sits
      <em>on top</em> of that and, per room, overrides the primary chain with the room accent.
    </p>
  </section>
</DocsPageLayout>
