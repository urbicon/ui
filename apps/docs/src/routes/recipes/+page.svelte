<script lang="ts">
  import SeoMeta from '#lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { r } from '#lib/route.js';
  import { ArrowRightIcon, Badge, Button, buttonVariants, Card } from '@urbicon-ui/blocks';
  import RecipePreview from './RecipePreview.svelte';
  import { RECIPE_ORDER, type RecipeMeta } from './recipe-meta';

  /**
   * Built from the recipes' own `meta.ts`, not from a second copy of it.
   * `import.meta.glob` is eager, so this is a build-time lookup, and
   * RECIPE_ORDER decides both what appears and in which order.
   */
  const metaModules = import.meta.glob<{ recipeMeta: RecipeMeta }>('./*/meta.ts', {
    eager: true
  });

  const recipes = RECIPE_ORDER.map((slug) => ({
    slug,
    href: `/recipes/${slug}`,
    ...metaModules[`./${slug}/meta.ts`].recipeMeta
  }));

  const categories = ['All', ...new Set(recipes.map((r) => r.category))];
  let activeCategory = $state('All');

  let filtered = $derived(
    activeCategory === 'All' ? recipes : recipes.filter((r) => r.category === activeCategory)
  );
</script>

<SeoMeta
  title="UI Recipes"
  description="Ready-to-use UI recipes built with Urbicon UI components. Copy-paste complete UI blocks for login forms, dashboards, settings pages, and more."
/>

<!-- Color Rooms hero field (default blocks room) — full-width band flush to the
     app sidebar; the inner wrapper aligns with the body. -->
<div data-room-hero>
  <div class="mx-auto max-w-6xl px-6">
    <h1 class="text-text-primary text-4xl font-bold">UI Recipes</h1>
    <p class="text-text-secondary mt-3 max-w-2xl text-lg">
      Whole screens composed from the set — {recipes.length} of them, each with a live preview, the source
      to copy and a link to every component it uses.
    </p>
  </div>
</div>

<div class="mx-auto max-w-6xl px-6 pt-10 pb-12">
  <!-- Category Filter -->
  <div class="mb-10 flex flex-wrap gap-2">
    {#each categories as category (category)}
      <Button
        size="sm"
        variant={activeCategory === category ? 'filled' : 'ghost'}
        intent={activeCategory === category ? 'primary' : 'neutral'}
        onclick={() => (activeCategory = category)}
      >
        {category}
      </Button>
    {/each}
  </div>

  <!-- Recipe Grid -->
  <div class="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
    {#each filtered as recipe (recipe.href)}
      <Card
        href={r(recipe.href)}
        class="group border-border-subtle hover:border-primary h-full overflow-hidden transition-[border-color,box-shadow] duration-[var(--blocks-duration-fast)] hover:shadow-[var(--blocks-shadow-lg)]"
      >
        <!-- Mini Preview -->
        <div class="border-border-subtle bg-surface-subtle border-b p-4">
          <RecipePreview href={recipe.href} />
        </div>

        <!-- Card Body -->
        <div class="flex flex-col p-5">
          <!-- Category + difficulty share the meta row. The difficulty badge used to
               float over the preview's top-right corner; now that the preview fills
               its frame edge-to-edge that would cover real content (it sat on the
               dashboard's 4th stat tile), so both live here. -->
          <div class="mb-1 flex items-center gap-2">
            <Badge variant="outlined" intent="neutral" size="sm">{recipe.category}</Badge>
            <Badge
              variant="soft"
              intent={recipe.difficulty === 'Beginner'
                ? 'success'
                : recipe.difficulty === 'Advanced'
                  ? 'danger'
                  : 'warning'}
              size="sm"
            >
              {recipe.difficulty}
            </Badge>
          </div>
          <!-- h2, not h3: the recipe cards are this page's content, sitting
               directly under the page h1 with no section heading between. -->
          <h2
            class="text-text-primary group-hover:text-primary mb-2 text-lg font-semibold transition-colors"
          >
            {recipe.title}
          </h2>
          <p class="text-text-secondary mb-4 flex-1 text-sm leading-relaxed">
            {recipe.description}
          </p>
          <!-- Mono manifest, matching the page header's register — and honest:
               the card is one big <a>, so pill-shaped chips here LOOKED like
               the header's links while being dead. Text does not promise a
               click it cannot take. -->
          <p class="font-meta text-text-tertiary text-xs leading-relaxed">
            {recipe.components.join(' · ')}
          </p>
        </div>
      </Card>
    {/each}
  </div>

  <!-- Where to go when you came for a whole screen rather than a snippet. This
       used to point at /showcase, a single demo app with no copyable code; the
       cookbook took that role over, and the table recipe is the entry that
       answers it with code. -->
  <div class="border-border-subtle bg-surface-elevated mt-16 rounded-xl border p-8 text-center">
    <h2 class="text-text-primary mb-2 text-xl font-semibold">Building a list page?</h2>
    <p class="text-text-secondary mb-6">
      Table with Detail Panel is the fullest recipe here: search, filters and paging come from the
      table, and clicking down the list swaps what the panel beside it shows.
    </p>
    <a
      href={resolve('/recipes/table-detail')}
      class={buttonVariants({ intent: 'primary', size: 'lg' }).base()}
    >
      Open the recipe
      <ArrowRightIcon size={16} />
    </a>
  </div>
</div>
