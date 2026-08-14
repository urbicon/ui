<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Alert, Badge, Button, Card, Checkbox, Separator, Toggle } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { parseTheme, previewVars } from '$lib/theme-preview';
  // The shipped themes themselves, not retyped excerpts — hand-copied palette
  // data drifted twice (a primary-only forest excerpt; Sunset/Rose chroma and
  // Neutral's 600 disagreeing with the package). Swatch dot, palette strip and
  // live preview all parse the same files the consumer imports.
  import oceanTheme from '@urbicon-ui/blocks/style/themes/ocean.css?raw';
  import forestThemeSource from '@urbicon-ui/blocks/style/themes/forest.css?raw';
  import sunsetTheme from '@urbicon-ui/blocks/style/themes/sunset.css?raw';
  import roseTheme from '@urbicon-ui/blocks/style/themes/rose.css?raw';
  import neutralTheme from '@urbicon-ui/blocks/style/themes/neutral.css?raw';

  const description =
    'Swap palettes with a single CSS import: each theme re-colors the primary and secondary accents and the neutral chassis. The four colored themes match the chassis to the accent’s temperature; Neutral strips it to grey.';

  const navigation = [
    { id: 'preview', title: 'Live Preview' },
    { id: 'usage', title: 'Usage' },
    { id: 'create', title: 'Write Your Own Theme' },
    { id: 'type', title: 'Typography' },
    { id: 'scoped', title: 'Scoped Themes' },
    { id: 'dark-mode', title: 'Dark Mode' }
  ];

  const themes = [
    {
      name: 'Ocean',
      file: 'ocean.css',
      desc: 'Cool blue-teal palette with deeper saturation. Chassis tuned cool to match.',
      parsed: parseTheme(oceanTheme)
    },
    {
      name: 'Forest',
      file: 'forest.css',
      desc: 'Earthy green palette inspired by natural environments. Stone-grey chassis.',
      parsed: parseTheme(forestThemeSource)
    },
    {
      name: 'Sunset',
      file: 'sunset.css',
      desc: 'Warm orange-amber palette for energetic interfaces. Chassis warmed to match.',
      parsed: parseTheme(sunsetTheme)
    },
    {
      name: 'Rose',
      file: 'rose.css',
      desc: 'Soft pink-rose palette for elegant, modern interfaces. Warm rosé chassis.',
      parsed: parseTheme(roseTheme)
    },
    {
      name: 'Neutral',
      file: 'neutral.css',
      desc: 'Desaturated grayscale for content-focused UIs. True temperature-free chassis.',
      parsed: parseTheme(neutralTheme)
    }
  ];

  let activeTheme = $state(0);
  const active = $derived(themes[activeTheme]);

  // The theme file's own declarations — all of them, not a chosen subset —
  // plus every library role that reads one of them, re-declared for the preview
  // scope in both modes via light-dark(). Shared with the Theme Builder:
  // $lib/theme-preview.ts. "All of them" matters: forest.css re-tunes success
  // and warning away from its green primary, and a preview that kept only the
  // accent ramps would exhibit the collision the file exists to avoid.
  const previewStyle = $derived(
    previewVars(active.parsed.declarations.map((d) => [d.name, d.value]))
  );

  const usageCode = $derived(
    `/* app.css */\n@import '@urbicon-ui/blocks/style/index.css';\n@import '@urbicon-ui/blocks/style/themes/${active.file}';`
  );

  const ownThemeImport = `/* app.css — your own file goes exactly where a shipped
   theme would, after the library base styles. */
@import '@urbicon-ui/blocks/style/index.css';
@import './my-theme.css';`;

  const customThemeCode = `/* my-theme.css */
@theme {
  /* Primary: your brand. Keep each stop's lightness + chroma
     profile (the WCAG-tuned contrast survives); change only the hue. */
  --color-primary-50: oklch(0.95 0.03 280);
  --color-primary-500: oklch(0.58 0.15 280);
  --color-primary-600: oklch(0.52 0.15 280);
  /* … all stops 50–950 … */

  /* Secondary: the supporting accent, same rule. */
  --color-secondary-500: oklch(0.55 0.12 320);
  /* … all stops 50–950 … */

  /* The chassis, NOT optional: surface-*, text-* and border-*
     derive from neutral, so a purple brand on the default cool
     240 chassis reads broken. Same lightness/chroma per stop,
     only the hue moves (chroma 0 for a temperature-free grey).
     Leave --color-neutral-0 (pure white) alone: tinting it
     tints your white. */
  --color-neutral-25: oklch(0.985 0.003 290);
  --color-neutral-50: oklch(0.965 0.006 290);
  /* … all 15 stops (25–950) … */
  --color-neutral-950: oklch(0.08 0.008 290);
}

/* Raw partial values: :root, never @theme. Both are spliced into
   a color function, so @theme would drop them on the floor. */
:root {
  /* oklch L C H, no alpha. Shadows pick up the chassis temperature
     instead of reading as cool smudges on tinted surfaces. */
  --blocks-shadow-tint: 0.2 0.025 290;
  /* Neutral intent chrome (bg-neutral / text-neutral / borders). */
  --neutral-chrome-hue: 290;
}`;

  const typographyOverrideExample = `/* app.css — the SAME @theme block that retunes color.
   Safe because the library never re-imports Tailwind: your
   @theme is compiled last and wins. */
@import 'tailwindcss';
@import '@urbicon-ui/blocks/style/index.css';

@theme {
  /* Families — blocks never sets \`font-sans\`, so body type simply
     inherits from your page. It DOES use \`font-mono\` (CommandPalette
     shortcut keys, JourneyTimeline meta), so this retunes those. */
  --font-sans: 'Inter Variable', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* Size AND its paired line-height. Tailwind's built-in sizes each
     ship a --text-*--line-height; changing the size alone leaves the
     old rhythm behind on all ~163 text-sm call sites. */
  --text-sm: 0.9375rem;
  --text-sm--line-height: calc(1.375 / 0.9375);

  --font-weight-medium: 550;
  --leading-tight: 1.3;
  --tracking-wide: 0.02em;
}`;

  const scopedThemeCode = `/* One sub-tree, its own accent; the rest of the app keeps yours.
   The chassis stays global: surfaces and text keep one temperature
   across the page. */
.promo {
  /* The re-tinted ramp, complete — the roles below read stops
     from 50 all the way to 950. */
  --color-primary-50: oklch(0.95 0.03 320);
  --color-primary-100: oklch(0.9 0.05 320);
  --color-primary-200: oklch(0.82 0.08 320);
  --color-primary-300: oklch(0.74 0.11 320);
  --color-primary-400: oklch(0.66 0.13 320);
  --color-primary-500: oklch(0.58 0.15 320);
  --color-primary-600: oklch(0.52 0.15 320);
  --color-primary-700: oklch(0.44 0.13 320);
  --color-primary-800: oklch(0.36 0.11 320);
  --color-primary-900: oklch(0.28 0.08 320);
  --color-primary-950: oklch(0.18 0.05 320);

  /* Re-declare the derived roles. A var() inside a token defined
     on :root substitutes THERE, at :root — overriding the ramp in
     this scope changes nothing until the roles that read it are
     re-declared in the same scope. */
  --color-primary: light-dark(var(--color-primary-600), var(--color-primary-500));
  --color-primary-hover: light-dark(var(--color-primary-700), var(--color-primary-400));
  --color-primary-active: light-dark(var(--color-primary-800), var(--color-primary-300));
  --color-primary-subtle: light-dark(var(--color-primary-50), var(--color-primary-900));
  --color-primary-emphasis: light-dark(var(--color-primary-900), var(--color-primary-200));
}`;

  const manualToggleCode = `const html = document.documentElement.classList;
html.remove('light', 'dark'); // follow the OS (color-scheme: light dark)
html.add('dark');             // force dark; add('light') forces light`;
</script>

<SeoMeta title="Themes" {description} />

<DocsPageLayout
  title="Themes"
  {description}
  maxWidth="xl"
  {navigation}
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
>
  <p class="text-text-secondary mb-6 leading-relaxed">
    Here for your own brand color? The
    <a href={resolve('/customization/theme-builder')} class="text-primary hover:underline"
      >Theme Builder</a
    >
    generates the file;
    <a href="#create" class="text-primary hover:underline">Write Your Own Theme</a> explains it.
  </p>

  <!-- Theme selector -->
  <div class="mb-8 flex flex-wrap gap-3">
    {#each themes as theme, i (theme.name)}
      <button
        class="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors {activeTheme ===
        i
          ? 'border-primary bg-primary-subtle text-primary'
          : 'border-border-subtle text-text-tertiary hover:border-border-default hover:text-text-secondary'}"
        onclick={() => (activeTheme = i)}
      >
        <div class="h-4 w-4 rounded-full" style="background: {theme.parsed.primary[600]}"></div>
        {theme.name}
      </button>
    {/each}
  </div>

  <!-- Palette strip -->
  <div class="mb-4">
    <div class="flex gap-1">
      {#each Object.entries(active.parsed.primary) as [shade, color] (shade)}
        <div class="flex-1">
          <div class="mb-1 aspect-square w-full rounded-md" style="background: {color}"></div>
          <div class="text-text-quaternary text-center font-mono text-[9px]">{shade}</div>
        </div>
      {/each}
    </div>
  </div>

  <p class="text-text-tertiary mb-6 text-sm">{active.desc}</p>

  <Section id="preview" title="Live Preview">
    <Card class="border-border-subtle mb-8 shadow-[var(--blocks-shadow-md)]">
      <div class="space-y-6 p-6" style={previewStyle}>
        <div>
          <h3 class="text-text-tertiary mb-3 text-sm font-medium">Buttons</h3>
          <div class="flex flex-wrap gap-3">
            <Button intent="primary" variant="filled">Primary</Button>
            <Button intent="secondary" variant="filled">Secondary</Button>
            <Button intent="primary" variant="outlined">Outlined</Button>
            <Button intent="primary" variant="ghost">Ghost</Button>
          </div>
        </div>
        <Separator />
        <div>
          <h3 class="text-text-tertiary mb-3 text-sm font-medium">Badges</h3>
          <div class="flex flex-wrap gap-2">
            <Badge intent="primary" variant="filled">Primary</Badge>
            <Badge intent="secondary" variant="filled">Secondary</Badge>
            <Badge intent="primary" variant="soft">Soft</Badge>
            <Badge intent="secondary" variant="soft">Soft</Badge>
          </div>
        </div>
        <Separator />
        <div>
          <h3 class="text-text-tertiary mb-3 text-sm font-medium">Form Elements</h3>
          <div class="flex flex-wrap items-center gap-4">
            <Checkbox label="Checkbox" checked intent="primary" />
            <Toggle checked intent="primary" />
          </div>
        </div>
        <Separator />
        <Alert intent="primary" variant="soft" size="sm">
          This stage is itself a scoped theme: the ramps and roles are re-declared inline on the
          element wrapping these components.
          <a href="#scoped" class="underline">Scoped Themes</a> shows the pattern.
        </Alert>
      </div>
    </Card>
  </Section>

  <Section id="usage" title="Usage">
    <CodeExample title="Theme import" code={usageCode} language="css" preview={false} />
  </Section>

  <Separator class="my-12" />

  <Section id="create" title="Write Your Own Theme" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      A theme is a CSS file with one
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">@theme</code> block that
      re-tints three ramps: primary and secondary (the accents) plus
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--color-neutral-*</code>
      (the chassis). Keep each stop's lightness and chroma; change only the hue. The full file is 37 ramp
      stops long and the
      <a href={resolve('/customization/theme-builder')} class="text-primary hover:underline"
        >Theme Builder</a
      >
      writes it for you; the template shows every decision in it:
    </p>
    <div
      class="border-warning/40 bg-warning-subtle text-text-secondary rounded-contain mb-6 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-warning-emphasis">A brand color alone is not a theme.</strong>
      Recolor <code class="text-xs">--color-primary-*</code> and nothing else, and your warm brand
      button ends up sitting on cool blue-grey cards:
      <code class="text-xs">surface-*</code>, <code class="text-xs">text-*</code> and
      <code class="text-xs">border-*</code>
      derive from the neutral ramp, not from primary. A real theme also re-tints
      <code class="text-xs">--color-neutral-*</code> to the accent's temperature, and moves any
      intent ramp your accent collides with (a green brand vs. <code class="text-xs">success</code>,
      an amber one vs. <code class="text-xs">warning</code>).
    </div>
    <CodeExample title="Custom theme file" code={customThemeCode} language="css" preview={false} />
    <p class="text-text-secondary mt-6 mb-6 leading-relaxed">
      Import it where a shipped theme goes:
    </p>
    <CodeExample
      title="Import your own theme"
      code={ownThemeImport}
      language="css"
      preview={false}
    />
    <p class="text-text-secondary mt-6 mb-6 leading-relaxed">
      When your accent lands within 20° of an intent hue (success 140, warning 80, danger 25, info
      220), move that intent's ramp so a status color still reads as status rather than as your
      brand. The Theme Builder flags the collision; which side moves is your call.
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">forest.css</code> ships the
      worked example: its green primary pushes success from 140 to 172, its lime secondary pushes warning
      from 80 to 60.
    </p>
    <p class="text-text-secondary mb-6 leading-relaxed">
      The same file in full, verbatim from the package. Beyond the two accent ramps it re-tints the
      chassis, re-tunes success and warning, and sets the two
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">:root</code> values at the
      end (shadow tint and neutral chrome hue).
    </p>
    <CodeExample
      title="forest.css, complete"
      code={forestThemeSource}
      language="css"
      preview={false}
      defaultExpanded={false}
    />
  </Section>

  <Separator class="mb-12" />

  <Section id="type" title="Typography" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Type is themed in the same
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">@theme</code> block:
      sizes, weights, leading, tracking and families are Tailwind variables (<code
        class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--text-sm</code
      >,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >--font-weight-medium</code
      >, <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--font-sans</code>,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--font-mono</code>).
    </p>
    <CodeExample
      title="Theme the type scale"
      code={typographyOverrideExample}
      language="css"
      preview={false}
    />
    <div
      class="border-warning/40 bg-warning-subtle text-text-secondary rounded-contain mt-6 mb-6 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-warning-emphasis">Two things to get right.</strong>
      <ul class="mt-2 list-outside list-disc space-y-1 pl-5">
        <li>
          <strong class="text-text-primary">Change the paired line-height too.</strong> Tailwind's
          built-in sizes each ship a companion
          <code class="text-xs">--text-*--line-height</code>; resize without it and the rhythm goes
          subtly wrong everywhere the size is used.
        </li>
        <li>
          <strong class="text-text-primary">One Tailwind compilation, yours.</strong> The library
          deliberately does not
          <code class="text-xs">@import 'tailwindcss'</code>, so your
          <code class="text-xs">@theme</code> wins. If your tooling introduces a second compilation,
          typography overrides silently revert, exactly like color overrides do. See
          <a
            href="https://github.com/urbicon/ui/blob/main/docs/TailwindCaveats.md"
            class="text-primary hover:underline"
            target="_blank"
            rel="noreferrer">docs/TailwindCaveats.md</a
          >.
        </li>
      </ul>
    </div>
    <p class="text-text-secondary leading-relaxed">
      The leverage is lopsided:
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--text-sm</code> reaches
      the most call sites and nothing above
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">text-2xl</code> is used
      by the library at all, so overriding
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--text-6xl</code>
      changes nothing (the
      <a href={resolve('/customization/tokens')} class="text-primary hover:underline"
        >Token Reference</a
      >
      lists per-size use counts). And because blocks never sets
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">font-sans</code>, body
      type already inherits your page's font: you own that decision without any override.
    </p>
  </Section>

  <Separator class="mb-12" />

  <Section id="scoped" title="Scoped Themes" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Every token is a CSS custom property, so a theme can live on any selector, not just
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">:root</code>: a marketing
      section with its own accent, an embedded product area, a per-tenant brand. Give the sub-tree a
      class (<code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >&lt;section class="promo"&gt;</code
      >), then re-tint the ramp inside it. There is one trap: overriding the ramp stops is not
      enough, because a
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">var()</code> inside a
      token defined on
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">:root</code> substitutes at
      that level: the derived roles keep their old values until you re-declare them inside the same scope.
    </p>
    <CodeExample
      title="A sub-tree with its own accent"
      code={scopedThemeCode}
      language="css"
      preview={false}
    />
    <p class="text-text-secondary mt-6 mb-6 leading-relaxed">
      Secondary works the same way: re-tint
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--color-secondary-*</code
      >
      and re-declare its five roles. Focus ring, selected surfaces and chart colors derive from primary
      too (<code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >--color-interactive-*</code
      >,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >--color-surface-selected</code
      >,
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">--color-chart-1</code>);
      re-declare them if your section uses them.
    </p>
    <p class="text-text-secondary leading-relaxed">
      Two worked examples of the pattern: the live previews on this page and in the Theme Builder
      (the inline style re-declares the roles next to the ramps, see
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >apps/docs/src/lib/theme-preview.ts</code
      >), and this docs site itself, which re-derives the primary family per page from the component
      family it documents:
      <a href={resolve('/customization/rooms-theme')} class="text-primary hover:underline"
        >Color Rooms</a
      >.
    </p>
    <div
      class="border-warning/40 bg-warning-subtle text-text-secondary rounded-contain mt-6 border p-4 text-sm leading-relaxed"
    >
      <strong class="text-warning-emphasis">Check what your bundler does to light-dark().</strong>
      Vite 8 minifies CSS with Lightning CSS by default, and against a CSS target below Safari 17.5 that
      rewrites <code class="text-xs">light-dark(a, b)</code> into two guard variables. Those are
      substituted where the token is <em>declared</em>, not where it is read — so a scope carrying
      its own
      <code class="text-xs">color-scheme</code> can no longer switch any token it does not
      re-declare itself, and a dark section inside a light page renders the light branch with no
      warning. Raise
      <code class="text-xs">build.cssTarget</code> to versions that ship
      <code class="text-xs">light-dark()</code> natively (<code class="text-xs">chrome123</code>,
      <code class="text-xs">edge123</code>,
      <code class="text-xs">firefox120</code>, <code class="text-xs">safari17.5</code>). The tell is
      <code class="text-xs">lightningcss-light</code> in your built CSS.
    </div>
  </Section>

  <Separator class="mb-12" />

  <Section id="dark-mode" title="Dark Mode" class="mb-12">
    <p class="text-text-secondary mb-6 leading-relaxed">
      Your theme file has no dark variant, and does not need one: every semantic role reads one stop
      per mode off the ramps you already re-tinted, through the CSS
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">light-dark()</code>
      function.
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">:root</code> declares
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm"
        >color-scheme: light dark</code
      >, the browser picks each token's branch from the user's preference, and a manual choice only
      sets <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">:root.light</code>
      or <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">:root.dark</code> to override
      it.
    </p>
    <p class="text-text-secondary mb-6 leading-relaxed">
      The ready-made toggle is the
      <a href={resolve('/blocks/components/theme-switcher')} class="text-primary hover:underline"
        >ThemeSwitcher</a
      >
      component: it cycles light → dark → system, sets the class, and persists the choice to
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">localStorage</code>. Its
      page also carries the
      <code class="bg-surface-subtle rounded-modify px-1.5 py-0.5 text-sm">app.html</code> head snippet
      that keeps the first paint flash-free.
    </p>
    <CodeExample
      title="The ready-made toggle"
      description="Not rendered here on purpose: it switches the whole site, and a second instance would fall out of step with the one in the sidebar."
      code={`<ThemeSwitcher />`}
      language="svelte"
      preview={false}
    />
    <p class="text-text-secondary mt-6 mb-6 leading-relaxed">Setting the class yourself:</p>
    <CodeExample
      title="Manual mode switch"
      code={manualToggleCode}
      language="javascript"
      preview={false}
    />
  </Section>
</DocsPageLayout>
