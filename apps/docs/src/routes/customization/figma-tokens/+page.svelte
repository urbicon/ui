<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { Badge, Button, Card, DownloadIcon, Separator } from '@urbicon-ui/blocks';
  import { generateFigmaTokens, generateFigmaTokensJSON } from '@urbicon-ui/blocks';
  import type { FigmaToken, FigmaTokenGroup } from '@urbicon-ui/blocks';
  import { DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';

  let copied = $state(false);
  let showFull = $state(false);

  const tokensJSON = generateFigmaTokensJSON(true);
  const tokensCompact = generateFigmaTokensJSON(false);

  const previewLines = tokensJSON.split('\n').slice(0, 30).join('\n') + '\n  ...';

  async function copyTokens() {
    await navigator.clipboard.writeText(tokensJSON);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function downloadTokens() {
    const blob = new Blob([tokensJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'urbicon-ui-tokens.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Stats are derived from the actual export so they can never drift from it.
  const tokens = generateFigmaTokens();

  function countLeaves(group: FigmaTokenGroup): number {
    let count = 0;
    for (const node of Object.values(group)) {
      if (typeof (node as FigmaToken).value === 'string') count += 1;
      else count += countLeaves(node as FigmaTokenGroup);
    }
    return count;
  }

  const stats = {
    colors: Object.keys(tokens.color as FigmaTokenGroup).length,
    shades: countLeaves(tokens.color as FigmaTokenGroup),
    semantic: countLeaves(tokens.semantic as FigmaTokenGroup),
    spacing: countLeaves(tokens.spacing as FigmaTokenGroup),
    radii: countLeaves(tokens.borderRadius as FigmaTokenGroup),
    shadows: countLeaves(tokens.shadow as FigmaTokenGroup)
  };
</script>

<!-- urbicon-ignore card-monotony — the seven cards are one stat row: same
     shape, one number each. Varying their weight would claim a ranking
     between 'Color Palettes' and 'Shadows' that does not exist. -->

<!--
  No `<Section>` on this page, deliberately. Its headings label the panels of a
  tool — a JSON preview beside a download button, an instruction column — laid
  out in a grid beside their own controls, not the parts of a document read top
  to bottom. `Section` brings a
  header block and document spacing that would fight that layout, and a table of
  contents linking into grid columns helps nobody. The five prose pages under
  /customization use `Section`; these two are the exception, with a reason.
-->

<SeoMeta
  title="Figma Token Export"
  description="Export Urbicon UI design tokens in Figma-compatible JSON format. Compatible with Tokens Studio for Figma plugin."
/>

<DocsPageLayout
  title="Figma Token Export"
  description="Export the Urbicon UI design tokens — foundation palettes, semantic surface/text/border roles (light-mode values), spacing, radii, and shadows — as Figma-compatible JSON. Works with the Tokens Studio for Figma plugin."
  maxWidth="2xl"
  breadcrumbs={[{ label: 'Customization', href: resolve('/customization') }]}
>
  <!-- Stats -->
  <div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
    {#each [{ label: 'Color Palettes', value: stats.colors }, { label: 'Color Shades', value: stats.shades }, { label: 'Semantic Tokens', value: stats.semantic }, { label: 'Spacing Scale', value: stats.spacing }, { label: 'Border Radii', value: stats.radii }, { label: 'Shadows', value: stats.shadows }] as stat (stat.label)}
      <Card class="border-border-subtle text-center">
        <div class="p-4">
          <div class="text-text-primary text-2xl font-bold">{stat.value}</div>
          <div class="text-text-tertiary text-xs">{stat.label}</div>
        </div>
      </Card>
    {/each}
  </div>

  <!-- Actions -->
  <div class="mb-8 flex flex-wrap gap-3">
    <Button intent="primary" onclick={downloadTokens}>
      <DownloadIcon size={16} class="mr-2" />
      Download JSON ({(tokensCompact.length / 1024).toFixed(1)} KB)
    </Button>
    <Button variant="outlined" intent={copied ? 'success' : 'neutral'} onclick={copyTokens}>
      {copied ? 'Copied!' : 'Copy to Clipboard'}
    </Button>
  </div>

  <div class="grid grid-cols-1 gap-8 xl:grid-cols-3">
    <!-- JSON Preview -->
    <div class="xl:col-span-2">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-text-primary text-lg font-semibold">Token Preview</h2>
        <Button size="sm" variant="ghost" intent="neutral" onclick={() => (showFull = !showFull)}>
          {showFull ? 'Show Preview' : 'Show Full'}
        </Button>
      </div>
      <Card class="border-border-subtle shadow-[var(--blocks-shadow-md)]">
        <pre
          class="text-text-secondary max-h-150 overflow-auto p-6 font-mono text-xs leading-relaxed"><code
            >{showFull ? tokensJSON : previewLines}</code
          ></pre>
      </Card>
    </div>

    <!-- How to Use -->
    <div>
      <h2 class="text-text-primary mb-4 text-lg font-semibold">How to Use</h2>
      <div class="space-y-4">
        <Card class="border-border-subtle">
          <div class="p-4">
            <div class="mb-2 flex items-center gap-2">
              <span
                class="bg-primary-subtle text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                >1</span
              >
              <h3 class="text-text-primary text-sm font-semibold">Install Tokens Studio</h3>
            </div>
            <p class="text-text-secondary text-xs">
              Install the "Tokens Studio for Figma" plugin from the Figma Community.
            </p>
          </div>
        </Card>

        <Card class="border-border-subtle">
          <div class="p-4">
            <div class="mb-2 flex items-center gap-2">
              <span
                class="bg-primary-subtle text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                >2</span
              >
              <h3 class="text-text-primary text-sm font-semibold">Import Tokens</h3>
            </div>
            <p class="text-text-secondary text-xs">
              Open the plugin, go to Settings, and paste the JSON or upload the downloaded file
              under "Import".
            </p>
          </div>
        </Card>

        <Card class="border-border-subtle">
          <div class="p-4">
            <div class="mb-2 flex items-center gap-2">
              <span
                class="bg-primary-subtle text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                >3</span
              >
              <h3 class="text-text-primary text-sm font-semibold">Apply to Figma Styles</h3>
            </div>
            <p class="text-text-secondary text-xs">
              Click "Create Styles" in the plugin to generate Figma color styles, spacing variables,
              and effect styles from the tokens.
            </p>
          </div>
        </Card>

        <Card class="border-border-subtle">
          <div class="p-4">
            <div class="mb-2 flex items-center gap-2">
              <span
                class="bg-primary-subtle text-primary flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                >4</span
              >
              <h3 class="text-text-primary text-sm font-semibold">Sync with Code</h3>
            </div>
            <p class="text-text-secondary text-xs">
              Changes in Figma can be synced back to code via Tokens Studio's Git integration,
              keeping design and code tokens in sync.
            </p>
          </div>
        </Card>
      </div>

      <Separator class="my-6" />

      <h2 class="text-text-primary mb-4 text-lg font-semibold">Token Categories</h2>
      <div class="space-y-2">
        {#each [{ name: 'color', desc: `Foundation OKLCH palettes (${stats.colors} scales)` }, { name: 'semantic', desc: 'Surface, text, and border roles (light-mode values)' }, { name: 'spacing', desc: 'Spacing scale (0–64px)' }, { name: 'borderRadius', desc: 'Radius tokens (xs–4xl + semantic tiers)' }, { name: 'shadow', desc: 'Box shadow tokens (xs–lg)' }] as cat (cat.name)}
          <div class="flex items-center gap-2 text-sm">
            <Badge variant="outlined" intent="neutral" size="sm" class="font-mono">{cat.name}</Badge
            >
            <span class="text-text-secondary">{cat.desc}</span>
          </div>
        {/each}
      </div>

      <Separator class="my-6" />

      <h2 class="text-text-primary mb-4 text-lg font-semibold">Programmatic Usage</h2>
      <Card class="border-border-subtle">
        <pre class="text-text-secondary p-4 font-mono text-xs leading-relaxed"><code
            >import {'{'} generateFigmaTokensJSON } from
  '@urbicon-ui/blocks';

const json = generateFigmaTokensJSON();
// Write to file or send to API</code
          ></pre>
      </Card>
    </div>
  </div>
</DocsPageLayout>
