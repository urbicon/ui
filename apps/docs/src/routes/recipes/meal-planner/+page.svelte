<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { Planner, Button, Badge, PlusIcon } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const { components: usedComponents, features } = recipeMeta;

  type MealType = 'breakfast' | 'lunch' | 'dinner';
  interface MealEntry {
    id: string;
    date: string; // local ISO date — never UTC-parsed
    mealType: MealType;
    title: string;
    emoji: string;
  }

  const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, dinner: 2 };
  const MEAL_INTENT: Record<MealType, 'warning' | 'primary' | 'success'> = {
    breakfast: 'warning',
    lunch: 'primary',
    dinner: 'success'
  };

  let entries = $state<MealEntry[]>([
    { id: '1', date: '2026-06-15', mealType: 'breakfast', title: 'Overnight Oats', emoji: '🥣' },
    { id: '2', date: '2026-06-15', mealType: 'dinner', title: 'Lentil Curry', emoji: '🍛' },
    { id: '3', date: '2026-06-16', mealType: 'lunch', title: 'Ramen Bowl', emoji: '🍜' },
    { id: '4', date: '2026-06-17', mealType: 'breakfast', title: 'Avocado Toast', emoji: '🥑' },
    { id: '5', date: '2026-06-17', mealType: 'dinner', title: 'Margherita Pizza', emoji: '🍕' },
    { id: '6', date: '2026-06-19', mealType: 'dinner', title: 'Tacos al Pastor', emoji: '🌮' },
    { id: '7', date: '2026-06-21', mealType: 'breakfast', title: 'Shakshuka', emoji: '🍳' }
  ]);

  let referenceDate = $state(new Date(2026, 5, 15));
  let selectedDate = $state<Date | undefined>(new Date(2026, 5, 17));
  let nextId = $state(8);

  function addMeal(isoDate: string) {
    entries.push({
      id: String(nextId++),
      date: isoDate,
      mealType: 'lunch',
      title: 'New meal',
      emoji: '🍽️'
    });
  }

  const recipeCode = `<script lang="ts">
  import { Planner, Button, Badge, PlusIcon } from '@urbicon-ui/blocks';
  import { endOfWeek, toIso } from '@urbicon-ui/blocks/date';

  type MealType = 'breakfast' | 'lunch' | 'dinner';
  interface MealEntry { id: string; date: string; mealType: MealType; title: string; emoji: string; }

  const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, dinner: 2 };

  let entries = $state<MealEntry[]>(initialEntries);
  let referenceDate = $state(new Date());
  let selectedDate = $state<Date | undefined>();

  // Fetch a week's worth of entries whenever navigation moves the window.
  async function loadWeek(start: Date) {
    entries = await db.meals.between(toIso(start), toIso(endOfWeek(start, 1)));
  }

  function addMeal(isoDate: string) {
    entries.push({ id: crypto.randomUUID(), date: isoDate, mealType: 'lunch', title: '', emoji: '🍽️' });
  }
<\/script>

<Planner
  view="week"
  items={entries}
  getDate={(e) => e.date}
  sort={(a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]}
  bind:value={referenceDate}
  bind:selectedDate
  onNavigate={(_, range) => loadWeek(range.start)}
>
  {#snippet cell({ items, isoDate })}
    {#each items as meal (meal.id)}
      <div class="bg-surface-subtle flex items-center gap-2 rounded-md px-2 py-1.5">
        <span aria-hidden="true">{meal.emoji}</span>
        <span class="text-text-secondary truncate text-sm">{meal.title}</span>
      </div>
    {/each}
    <!-- cell runs for empty days too → Add is reachable everywhere -->
    <Button variant="ghost" size="sm" class="mt-auto justify-start" onclick={() => addMeal(isoDate)}>
      <PlusIcon size={14} /> Add
    </Button>
  {/snippet}
</Planner>`;
</script>

<!-- urbicon-ignore emoji-as-icon — the emoji are the recipe's DATA, not its
     iconography: a meal planner's entries carry whatever glyph the user picked
     for that dish. The icon set has no 'overnight oats' and should not. -->

<SeoMeta
  title="Meal Planner Recipe"
  description="Weekly meal plan built on Planner — bucketed meals, intra-day sorting, and an add affordance on every day."
/>

<div class="mx-auto max-w-5xl px-6 py-12">
  <RecipeHeader meta={recipeMeta} />

  <Section id="preview" title="Live Preview">
    <Planner
      view="week"
      items={entries}
      getDate={(e) => e.date}
      sort={(a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]}
      bind:value={referenceDate}
      bind:selectedDate
      locale="en-US"
    >
      {#snippet cell({ items, isoDate })}
        {#each items as meal (meal.id)}
          <div class="bg-surface-subtle flex items-center gap-2 rounded-md px-2 py-1.5">
            <span aria-hidden="true">{meal.emoji}</span>
            <span class="text-text-secondary min-w-0 truncate text-sm">{meal.title}</span>
            <Badge variant="dot" intent={MEAL_INTENT[meal.mealType]} class="ml-auto shrink-0" />
          </div>
        {/each}
        <Button
          variant="ghost"
          size="sm"
          class="mt-auto justify-start"
          onclick={() => addMeal(isoDate)}
        >
          <PlusIcon size={14} /> Add
        </Button>
      {/snippet}
    </Planner>
  </Section>

  <Section id="features" title="Key Features">
    <RecipeFeatures {features} />
  </Section>

  <Section id="code" title="Code" class="mt-12">
    <CodeExample title="Meal Planner Recipe" code={recipeCode} language="svelte" preview={false} />
  </Section>
</div>
