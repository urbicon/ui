<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Badge, Button, Card, Checkbox, Toggle, Separator, Alert } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  const themes = [
    {
      name: 'Ocean',
      file: 'ocean.css',
      hue: 220,
      secHue: 190,
      secChroma: 0.1,
      chassisHue: 220,
      chassisGray: false,
      desc: 'Cool blue-teal palette with deeper saturation. Chassis tuned cool to match.',
      primary600: 'oklch(0.52 0.14 220)'
    },
    {
      name: 'Forest',
      file: 'forest.css',
      hue: 155,
      secHue: 90,
      secChroma: 0.08,
      chassisHue: 150,
      chassisGray: false,
      desc: 'Earthy green palette inspired by natural environments. Stone-grey chassis.',
      primary600: 'oklch(0.5 0.13 155)'
    },
    {
      name: 'Sunset',
      file: 'sunset.css',
      hue: 55,
      secHue: 25,
      secChroma: 0.12,
      chassisHue: 50,
      chassisGray: false,
      desc: 'Warm orange-amber palette for energetic interfaces. Chassis warmed to match.',
      primary600: 'oklch(0.55 0.15 55)'
    },
    {
      name: 'Rose',
      file: 'rose.css',
      hue: 350,
      secHue: 310,
      secChroma: 0.12,
      chassisHue: 350,
      chassisGray: false,
      desc: 'Soft pink-rose palette for elegant, modern interfaces. Warm rosé chassis.',
      primary600: 'oklch(0.53 0.15 350)'
    },
    {
      name: 'Neutral',
      file: 'neutral.css',
      hue: 240,
      secHue: 240,
      secChroma: 0.012,
      chassisHue: 0,
      chassisGray: true,
      desc: 'Desaturated grayscale for content-focused UIs. True temperature-free chassis.',
      primary600: 'oklch(0.43 0.012 240)'
    }
  ];

  function oklch(l: number, c: number, h: number): string {
    return `oklch(${l} ${c} ${h})`;
  }

  function generatePalette(hue: number, chroma: number) {
    return {
      50: oklch(0.95, chroma * 0.2, hue),
      100: oklch(0.9, chroma * 0.33, hue),
      200: oklch(0.82, chroma * 0.53, hue),
      300: oklch(0.74, chroma * 0.73, hue),
      400: oklch(0.66, chroma * 0.87, hue),
      500: oklch(0.58, chroma, hue),
      600: oklch(0.52, chroma, hue),
      700: oklch(0.44, chroma * 0.87, hue),
      800: oklch(0.36, chroma * 0.73, hue),
      900: oklch(0.28, chroma * 0.53, hue),
      950: oklch(0.18, chroma * 0.33, hue)
    };
  }

  // Foundation neutral ramp (lightness + base chroma per stop) — the chassis
  // each theme re-tints. Keeps L fixed so WCAG contrast is preserved.
  const neutralRamp = [
    { shade: 25, l: 0.99, c: 0.002 },
    { shade: 50, l: 0.98, c: 0.005 },
    { shade: 100, l: 0.95, c: 0.008 },
    { shade: 200, l: 0.89, c: 0.012 },
    { shade: 300, l: 0.83, c: 0.014 },
    { shade: 400, l: 0.7, c: 0.015 },
    { shade: 500, l: 0.55, c: 0.016 },
    { shade: 600, l: 0.42, c: 0.017 },
    { shade: 700, l: 0.32, c: 0.016 },
    { shade: 800, l: 0.23, c: 0.015 },
    { shade: 900, l: 0.15, c: 0.012 }
  ] as const;

  function generateChassis(hue: number, gray: boolean): Record<number, string> {
    const out: Record<number, string> = {};
    for (const { shade, l, c } of neutralRamp) {
      out[shade] = oklch(l, gray ? 0 : c, hue);
    }
    return out;
  }

  let activeTheme = $state(0);

  const chromaMap: Record<number, number> = {
    220: 0.14,
    155: 0.13,
    55: 0.16,
    350: 0.16,
    240: 0.012
  };

  const activePalette = $derived(
    generatePalette(themes[activeTheme].hue, chromaMap[themes[activeTheme].hue] ?? 0.14)
  );

  const activeSecondaryPalette = $derived(
    generatePalette(themes[activeTheme].secHue, themes[activeTheme].secChroma)
  );

  const activeChassis = $derived(
    generateChassis(themes[activeTheme].chassisHue, themes[activeTheme].chassisGray)
  );

  const previewStyle = $derived.by(() => {
    const vars: string[] = [];
    for (const [shade, value] of Object.entries(activePalette)) {
      vars.push(`--color-primary-${shade}: ${value}`);
    }
    vars.push(`--color-primary: ${activePalette[600]}`);
    vars.push(`--color-primary-hover: ${activePalette[700]}`);
    vars.push(`--color-primary-active: ${activePalette[800]}`);
    vars.push(`--color-primary-subtle: ${activePalette[50]}`);
    vars.push(`--color-primary-emphasis: ${activePalette[900]}`);
    for (const [shade, value] of Object.entries(activeSecondaryPalette)) {
      vars.push(`--color-secondary-${shade}: ${value}`);
    }
    vars.push(`--color-secondary: ${activeSecondaryPalette[500]}`);
    vars.push(`--color-secondary-hover: ${activeSecondaryPalette[600]}`);
    vars.push(`--color-secondary-active: ${activeSecondaryPalette[700]}`);
    vars.push(`--color-secondary-subtle: ${activeSecondaryPalette[50]}`);
    vars.push(`--color-secondary-emphasis: ${activeSecondaryPalette[800]}`);
    for (const [shade, value] of Object.entries(activeChassis)) {
      vars.push(`--color-neutral-${shade}: ${value}`);
    }
    // Re-declare the light-mode chassis-derived tokens so the inline scope
    // re-substitutes against the re-tinted neutral ramp (mirrors semantic.css).
    vars.push(`--color-surface-quiet: ${activeChassis[25]}`);
    vars.push(`--color-surface-elevated: ${activeChassis[50]}`);
    vars.push(`--color-surface-subtle: ${activeChassis[50]}`);
    vars.push(`--color-surface-hover: ${activeChassis[100]}`);
    vars.push(`--color-surface-active: ${activeChassis[200]}`);
    vars.push(`--color-surface-interactive: ${activeChassis[100]}`);
    vars.push(`--color-text-primary: ${activeChassis[900]}`);
    vars.push(`--color-text-secondary: ${activeChassis[700]}`);
    vars.push(`--color-text-tertiary: ${activeChassis[600]}`);
    vars.push(`--color-text-quaternary: ${activeChassis[500]}`);
    vars.push(`--color-border-subtle: ${activeChassis[200]}`);
    vars.push(`--color-border-default: ${activeChassis[300]}`);
    vars.push(`--color-border-emphasis: ${activeChassis[400]}`);
    vars.push(`--color-border-strong: ${activeChassis[500]}`);
    return vars.join('; ');
  });

  const usageCode = $derived(
    `/* app.css */\n@import '@urbicon-ui/blocks/style/index.css';\n@import '@urbicon-ui/blocks/style/themes/${themes[activeTheme].file}';`
  );

  const customThemeCode = `/* my-theme.css – use the Theme Builder to generate values */
@theme {
  /* Primary – your main brand color */
  --color-primary-50: oklch(0.95 0.03 YOUR_HUE);
  --color-primary-100: oklch(0.9 0.05 YOUR_HUE);
  /* ... shades 200–800 ... */
  --color-primary-900: oklch(0.26 0.06 YOUR_HUE);
  --color-primary-950: oklch(0.17 0.04 YOUR_HUE);

  /* Secondary – supporting accent color */
  --color-secondary-50: oklch(0.95 0.02 SEC_HUE);
  --color-secondary-100: oklch(0.9 0.04 SEC_HUE);
  /* ... shades 200–800 ... */
  --color-secondary-900: oklch(0.25 0.04 SEC_HUE);
  --color-secondary-950: oklch(0.18 0.03 SEC_HUE);

  /* Chassis – the neutral ramp surfaces/text/borders derive from.
     Re-tint it to your accent's temperature (CHASSIS_HUE ≈ YOUR_HUE) so the
     whole UI is coherent. Same lightness + chroma as the default ramp — only
     the hue shifts (set chroma to 0 for a temperature-free grayscale). */
  --color-neutral-25: oklch(0.99 0.002 CHASSIS_HUE);
  --color-neutral-50: oklch(0.98 0.005 CHASSIS_HUE);
  /* ... shades 100–850 ... */
  --color-neutral-900: oklch(0.15 0.012 CHASSIS_HUE);
  --color-neutral-950: oklch(0.08 0.008 CHASSIS_HUE);
}`;
</script>

<SeoMeta
  title="CSS Token Themes"
  description="Built-in CSS token themes for Urbicon UI. Swap color palettes with a single import."
/>

<DocsPageLayout
  title="CSS Token Themes"
  description="Swap palettes with a single CSS import. Each theme re-colors the primary and secondary accents and re-tints the neutral chassis — so surfaces, text and borders share the accent's temperature instead of staying cool grey."
  maxWidth="xl"
  breadcrumbs={[
    { label: 'Customization', href: resolve('/customization') },
    { label: 'CSS Token Themes' }
  ]}
>
  <!-- Theme selector -->
  <div class="mb-8 flex flex-wrap gap-3">
    {#each themes as theme, i (theme.name)}
      <button
        class="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all {activeTheme ===
        i
          ? 'border-primary bg-primary-subtle text-primary'
          : 'border-border-subtle text-text-tertiary hover:border-border-default hover:text-text-secondary'}"
        onclick={() => (activeTheme = i)}
      >
        <div class="h-4 w-4 rounded-full" style="background: {theme.primary600}"></div>
        {theme.name}
      </button>
    {/each}
  </div>

  <!-- Palette strip -->
  <div class="mb-4">
    <div class="flex gap-1">
      {#each Object.entries(activePalette) as [shade, color] (shade)}
        <div class="flex-1">
          <div class="mb-1 aspect-square w-full rounded-md" style="background: {color}"></div>
          <div class="text-text-quaternary text-center font-mono text-[9px]">{shade}</div>
        </div>
      {/each}
    </div>
  </div>

  <p class="text-text-tertiary mb-6 text-sm">{themes[activeTheme].desc}</p>

  <!-- Live preview -->
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
        This preview updates live as you switch themes above.
      </Alert>
    </div>
  </Card>

  <!-- Usage -->
  <CodeExample title="Usage" code={usageCode} language="css" preview={false} />

  <Separator class="my-12" />

  <!-- Custom themes -->
  <section>
    <h2 class="text-text-primary mb-4 text-2xl font-bold">Create Your Own Theme</h2>
    <p class="text-text-secondary mb-6 leading-relaxed">
      Create a CSS file with a
      <code class="bg-surface-subtle rounded px-1.5 py-0.5 text-sm">@theme</code> block that
      overrides three ramps: primary and secondary (the accents) plus
      <code class="bg-surface-subtle rounded px-1.5 py-0.5 text-sm">--color-neutral-*</code> (the chassis).
      Surfaces, text and borders all derive from the neutral ramp, so re-tinting it to your accent's temperature
      keeps the whole UI coherent — without it, a warm brand color ends up on cold grey surfaces. All
      components pick up the new palette through the semantic token layer.
    </p>
    <CodeExample title="Custom theme file" code={customThemeCode} language="css" preview={false} />
    <p class="text-text-secondary mt-4">
      Use the <a href={resolve('/customization/theme-builder')} class="text-primary hover:underline"
        >Theme Builder</a
      >
      to interactively generate OKLCH values for your brand color.
    </p>
  </section>
</DocsPageLayout>
