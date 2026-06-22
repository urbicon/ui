<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  const navigation = [
    { id: 'what', title: 'What it is', order: 1 },
    { id: 'tokens', title: 'Token Catalogue', order: 2 },
    { id: 'activation', title: 'Activation', order: 3 },
    { id: 'modes', title: 'Light & Dark', order: 4 },
    { id: 'override', title: 'Override Recipes', order: 5 }
  ];

  const activationExample = `<!-- apps/docs/src/app.html -->
<body data-sveltekit-preload-data="hover" class="docs-editorial">
  %sveltekit.body%
</body>`;

  const cssImportExample = `/* apps/docs/src/app.css */
@import '@urbicon-ui/blocks/style/index.css';
@import './lib/style/editorial.css';   /* warm cream paper, mono meta-font, pipe marker */`;

  const overrideExample = `/* Want a tighter Editorial card geometry, closer to the library? */
.docs-editorial {
  --docs-radius-card: var(--radius-contain);   /* match the library container */
}

/* Want a louder shadow lift? */
.docs-editorial {
  --docs-shadow-page: var(--blocks-shadow-xl);
}

/* Brand-tinted accent for Editorial — without touching library primary */
.docs-editorial {
  --docs-accent: oklch(0.62 0.13 250);
}`;

  const lightDarkExample = `/* editorial.css uses light-dark() so every token has both modes
 * baked in — switching <html class="dark"> swaps the resolution without
 * a second rule block. */
.docs-editorial {
  --docs-bg:    light-dark(#f7f5f0, #1a1816);   /* warm cream → warm coffee */
  --docs-paper: light-dark(#fbfaf6, #232220);   /* lighter cream → lighter coffee */
  --docs-ink:   light-dark(#2a2926, #f0ede5);   /* warm dark ink → warm cream ink */
  /* … */
}`;
</script>

<SeoMeta
  title="Editorial Theme"
  description="The Editorial theme that powers the Urbicon UI docs site — what it is, which tokens it exposes, how to activate or override it, and how Light/Dark modes work inside it."
/>

<DocsPageLayout
  title="Editorial Theme"
  description="A token-only overlay on top of the Urbicon UI library that drives the look of this docs site — warm cream paper, mono meta-font, pipe markers. Activated via a single body class; everything else is CSS custom properties."
  {navigation}
  showToc
  breadcrumbs={[
    { label: 'Customization', href: resolve('/customization') },
    { label: 'Editorial Theme' }
  ]}
>
  <!-- What it is ──────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="what">What it is</h2>
    <p class="text-text-secondary mb-4 leading-relaxed">
      The Editorial Theme is the visual identity of this docs site — warm cream paper, generous
      hairlines, a mono meta-font for ON THIS PAGE / / / breadcrumbs and code-pills, the vertical
      pipe accent next to page titles. It is implemented as a single CSS file (<code
        class="text-text-primary">apps/docs/src/lib/style/editorial.css</code
      >) that defines a private <code class="text-text-primary">--docs-*</code> token namespace and
      binds a handful of library semantic tokens to those values when
      <code class="text-text-primary">.docs-editorial</code>
      is present on the <code class="text-text-primary">&lt;body&gt;</code>.
    </p>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Nothing in the library has been forked or duplicated. Every primitive still ships with its
      library-default look; the Editorial style is a thin token-override sheet over the top. Without
      <code class="text-text-primary">.docs-editorial</code> the same page renders in the library defaults
      — that's the test of whether the docs site really is theme-only.
    </p>

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h4 class="text-text-primary mb-2 text-sm font-semibold">Editorial vs. Consumer Apps</h4>
      <p class="text-text-secondary text-sm leading-relaxed">
        The Editorial theme is <strong>docs-only</strong>. Consumer apps that depend on
        <code class="text-text-primary">@urbicon-ui/blocks</code> (apps that consume
        @urbicon-ui/blocks) do not import
        <code class="text-text-primary">editorial.css</code> and do not set
        <code class="text-text-primary">.docs-editorial</code>; they live on the library defaults
        and customise via the regular
        <a href={resolve('/customization')} class="text-primary hover:underline"
          >customization ladder</a
        > (class / slotClasses / preset / defaults / overrides / unstyled).
      </p>
    </div>
  </section>

  <!-- Token Catalogue ────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="tokens">Token Catalogue</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      The <code class="text-text-primary">--docs-*</code> namespace holds the Editorial-specific
      tokens. The Editorial sheet also binds a handful of library semantic tokens to these values so
      that components rendered inside <code class="text-text-primary">.docs-editorial</code> pick up the
      warm palette without per-component opt-in.
    </p>

    <h3 class="text-text-primary mb-2 text-lg font-semibold">Editorial-private tokens</h3>
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
            <td class="px-4 py-3"><code>#2a2926 · #f0ede5</code></td>
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
            <td class="px-4 py-3">Decoration ink — `//` prefix, separators.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-hair</code></td>
            <td class="px-4 py-3"><code>ink/8% · ink/8%</code></td>
            <td class="px-4 py-3">Hairline — barely-visible structural lines.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-line</code></td>
            <td class="px-4 py-3"><code>ink/14% · ink/14%</code></td>
            <td class="px-4 py-3">Stronger structural line (section separators).</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-accent</code></td>
            <td class="px-4 py-3"><code>var(--color-primary)</code></td>
            <td class="px-4 py-3">Pipe marker, link colour — couples to library primary.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-radius-pill</code></td>
            <td class="px-4 py-3"><code>var(--radius-commit)</code></td>
            <td class="px-4 py-3">TOC crumbs, meta-chips, section markers.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-radius-card</code></td>
            <td class="px-4 py-3"><code>var(--radius-2xl)</code></td>
            <td class="px-4 py-3">Bento-cards, recipe-stages, theme-builder demo frames.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--docs-shadow-page</code></td>
            <td class="px-4 py-3"><code>var(--blocks-shadow-lg)</code></td>
            <td class="px-4 py-3">Editorial lift shadow — bento, recipe, showcase stages.</td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--font-mono</code></td>
            <td class="px-4 py-3">JetBrains Mono · system mono</td>
            <td class="px-4 py-3">Code, kbd, meta labels (self-hosted via @fontsource).</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h3 class="text-text-primary mb-2 text-lg font-semibold">Library semantic overrides</h3>
    <p class="text-text-secondary mb-3 text-sm leading-relaxed">
      The Editorial sheet rebinds these library semantic tokens inside
      <code class="text-text-primary">.docs-editorial</code> so library components automatically pick
      up the warm palette without an explicit opt-in. Everything else (surface-elevated / -overlay, intent
      colours, focus rings) stays at library defaults — popovers and tooltips read as the library's neutral
      chrome, which preserves a subtle "chrome vs. content" register against the paper.
    </p>
    <div class="border-border-subtle bg-surface-base rounded-contain overflow-hidden border">
      <table class="text-text-secondary w-full text-left text-sm">
        <thead
          class="border-border-subtle text-text-primary border-b text-xs tracking-wider uppercase"
        >
          <tr>
            <th class="px-4 py-3 font-semibold">Library token</th>
            <th class="px-4 py-3 font-semibold">Editorial value</th>
          </tr>
        </thead>
        <tbody class="divide-border-subtle divide-y">
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
          <tr>
            <td class="px-4 py-3"><code>--color-text-tertiary</code></td>
            <td class="px-4 py-3"><code>var(--docs-soft)</code></td>
          </tr>
          <tr>
            <td class="px-4 py-3"><code>--color-text-quaternary</code></td>
            <td class="px-4 py-3"><code>var(--docs-softer)</code></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- Activation ──────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="activation">Activation</h2>
    <p class="text-text-secondary mb-4 leading-relaxed">
      The theme activates when <code class="text-text-primary">.docs-editorial</code> sits on a
      parent of your content. The docs site puts it on
      <code class="text-text-primary">&lt;body&gt;</code>
      so the whole app inherits the warm canvas. The class only adds Editorial; it does not disable anything
      from the library.
    </p>

    <CodeExample
      title="1. Set the body class"
      code={activationExample}
      language="html"
      preview={false}
    />

    <p class="text-text-secondary my-4 leading-relaxed">
      And import the stylesheet alongside the library base:
    </p>

    <CodeExample
      title="2. Import editorial.css"
      code={cssImportExample}
      language="css"
      preview={false}
    />

    <p class="text-text-secondary mt-4 leading-relaxed">
      Remove the class (e.g. on a route or wrapper element that should render in library defaults)
      and the page falls back to the library look. The underlying override mechanism is the same
      CSS-custom-property cascade documented in
      <a href={resolve('/customization/tier-system')} class="text-primary hover:underline"
        >Tier System</a
      >
      — Editorial just rebinds a wider set of tokens.
    </p>
  </section>

  <!-- Light & Dark ─────────────────────────────────────────── -->
  <section class="mb-12">
    <h2 class="text-text-primary mb-4 text-2xl font-bold" id="modes">Light &amp; Dark</h2>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Editorial supports both light and dark out of the box — Light is warm cream paper with warm
      dark ink, Dark is warm coffee paper with warm cream ink. The shape (paper hierarchy, ink
      hierarchy, accent, mono meta) is identical across modes so the Editorial identity holds.
    </p>
    <p class="text-text-secondary mb-4 leading-relaxed">
      Implementation uses CSS's <code class="text-text-primary">light-dark()</code> function. Each
      token resolves at use-site based on the page's
      <code class="text-text-primary">color-scheme</code>, which the library's semantic layer sets
      via
      <code class="text-text-primary">:root.light</code> /
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
      Because every Editorial value lives on a CSS custom property, you can adjust the theme at any
      scope — globally inside <code class="text-text-primary">.docs-editorial</code>, on a narrower
      wrapper, or inline. A few common adjustments:
    </p>

    <CodeExample title="Common overrides" code={overrideExample} language="css" preview={false} />

    <p class="text-text-tertiary mt-4 text-xs leading-relaxed">
      For brand-wide theming (the library's primary colour, the tier radii) reach for the
      <a href={resolve('/customization/theme-builder')} class="text-primary hover:underline">
        Theme Builder</a
      >
      or write a custom <code class="text-text-primary">@theme</code> block — Editorial sits
      <em>on top</em> of that and inherits it via the
      <code class="text-text-primary">--color-primary</code>
      and <code class="text-text-primary">--radius-*</code> chain.
    </p>
  </section>
</DocsPageLayout>
