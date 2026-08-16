<script lang="ts">
  import { Badge, Button, Planner, PlusIcon } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  type MealType = 'breakfast' | 'lunch' | 'dinner';
  interface MealEntry {
    id: string;
    date: string; // local ISO date — Planner takes it verbatim, never UTC-parsed
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

  // Pinned to the sample week above, so the demo opens on its data.
  let referenceDate = $state(new Date(2026, 5, 15));
  let selectedDate = $state<Date | undefined>(new Date(2026, 5, 17));

  function addMeal(isoDate: string) {
    entries.push({
      id: crypto.randomUUID(),
      date: isoDate,
      mealType: 'lunch',
      title: 'New meal',
      emoji: '🍽️'
    });
  }

  const recipeCode = `<\script lang="ts">
  import { Badge, Button, Planner, PlusIcon } from '@urbicon-ui/blocks';

  type MealType = 'breakfast' | 'lunch' | 'dinner';
  interface MealEntry {
    id: string;
    date: string; // local ISO date — Planner takes it verbatim, never UTC-parsed
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

  // Stand-in for your data source — the demo pins one sample week and keeps it
  // local. In an app, start referenceDate from new Date() and load entries in
  // Planner's onNavigate, which hands you the visible range after every move.
  let entries = $state<MealEntry[]>([/* … meals, dated inside the sample week … */]);
  let referenceDate = $state(new Date(2026, 5, 15));
  let selectedDate = $state<Date | undefined>(new Date(2026, 5, 17));

  function addMeal(isoDate: string) {
    entries.push({
      id: crypto.randomUUID(),
      date: isoDate,
      mealType: 'lunch',
      title: 'New meal',
      emoji: '🍽️'
    });
  }
<\/script>

<Planner
  view="week"
  items={entries}
  getDate={(e) => e.date}
  sort={(a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]}
  bind:value={referenceDate}
  bind:selectedDate
>
  {#snippet cell({ items, isoDate })}
    {#each items as meal (meal.id)}
      <div class="bg-surface-subtle flex items-center gap-2 rounded-md px-2 py-1.5">
        <span aria-hidden="true">{meal.emoji}</span>
        <span class="text-text-secondary min-w-0 truncate text-sm">{meal.title}</span>
        <Badge variant="dot" intent={MEAL_INTENT[meal.mealType]} class="ml-auto shrink-0" />
      </div>
    {/each}
    <!-- cell runs for empty days too, so Add stays reachable everywhere -->
    <Button
      variant="ghost"
      size="sm"
      class="mt-auto justify-start"
      onclick={() => addMeal(isoDate)}
    >
      <PlusIcon size={14} /> Add
    </Button>
  {/snippet}
</Planner>`;
</script>

<!-- urbicon-ignore emoji-as-icon — the emoji are the recipe's DATA, not its
     iconography: a meal planner's entries carry whatever glyph the user picked
     for that dish. The icon set has no 'overnight oats' and should not. -->

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="MealPlanPage.svelte"
      description="Add a meal to any day with its ghost `Add` button; the header arrows move the week, and clicking a day's cell selects it."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <Planner
        view="week"
        items={entries}
        getDate={(e) => e.date}
        sort={(a, b) => MEAL_ORDER[a.mealType] - MEAL_ORDER[b.mealType]}
        bind:value={referenceDate}
        bind:selectedDate
      >
        {#snippet cell({ items, isoDate })}
          {#each items as meal (meal.id)}
            <div class="bg-surface-subtle flex items-center gap-2 rounded-md px-2 py-1.5">
              <span aria-hidden="true">{meal.emoji}</span>
              <span class="text-text-secondary min-w-0 truncate text-sm">{meal.title}</span>
              <Badge variant="dot" intent={MEAL_INTENT[meal.mealType]} class="ml-auto shrink-0" />
            </div>
          {/each}
          <!-- cell runs for empty days too, so Add stays reachable everywhere -->
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
    </CodeExample>
  </Section>

  <Section id="decisions" title="Loading, timezones, empty days">
    <NoteList>
      <Note title="Load a week at a time">
        <p>
          The demo holds one local array. In an app,
          <code class="text-text-primary">onNavigate</code> fires after every navigation with the
          new reference date and the visible range:
          <code class="text-text-primary"
            >onNavigate=&#123;(_, range) =&gt; loadWeek(range.start)&#125;</code
          >. The Svelte-free <code class="text-text-primary">@urbicon-ui/blocks/date</code> subpath
          (<code class="text-text-primary">toIso</code>,
          <code class="text-text-primary">endOfWeek</code>) runs in a server route too, so the
          endpoint can compute the same week boundaries the grid shows.
        </p>
      </Note>
      <Note title="Dates stay local">
        <p>
          <code class="text-text-primary">getDate</code> returns the entry's
          <code class="text-text-primary">date</code> string, and Planner buckets
          <code class="text-text-primary">'2026-06-16'</code> as that calendar day wherever the user
          is: a plain date string is taken verbatim, never UTC-parsed, so a dinner never slides
          across midnight in another timezone. If your source stores UTC instants (<code
            class="text-text-primary">'…T23:00:00Z'</code
          >) and the local day matters, return
          <code class="text-text-primary">new Date(value)</code> so the user's timezone applies.
        </p>
      </Note>
      <Note title="An empty day still renders the cell">
        <p>
          The ghost Add button lives in the <code class="text-text-primary">cell</code> snippet
          because <code class="text-text-primary">cell</code> runs for empty days too. Planner also
          takes an <code class="text-text-primary">empty</code> snippet for a dedicated placeholder;
          it replaces <code class="text-text-primary">cell</code> on empty days and would take the Add
          button with it, so this recipe leaves it out.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
