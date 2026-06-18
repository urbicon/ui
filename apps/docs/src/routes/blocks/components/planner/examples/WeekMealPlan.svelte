<script lang="ts">
  import { Planner, Button, PlusIcon } from '@urbicon-ui/blocks';

  type MealType = 'breakfast' | 'lunch' | 'dinner';
  interface Meal {
    id: string;
    date: string;
    type: MealType;
    title: string;
    emoji: string;
  }

  const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, dinner: 2 };

  let meals = $state<Meal[]>([
    { id: '1', date: '2026-06-15', type: 'breakfast', title: 'Overnight Oats', emoji: '🥣' },
    { id: '2', date: '2026-06-15', type: 'dinner', title: 'Lentil Curry', emoji: '🍛' },
    { id: '3', date: '2026-06-16', type: 'lunch', title: 'Ramen Bowl', emoji: '🍜' },
    { id: '4', date: '2026-06-17', type: 'breakfast', title: 'Avocado Toast', emoji: '🥑' },
    { id: '5', date: '2026-06-17', type: 'dinner', title: 'Margherita Pizza', emoji: '🍕' },
    { id: '6', date: '2026-06-19', type: 'dinner', title: 'Tacos al Pastor', emoji: '🌮' },
    { id: '7', date: '2026-06-21', type: 'breakfast', title: 'Shakshuka', emoji: '🍳' }
  ]);

  let nextId = $state(8);

  function addMeal(isoDate: string) {
    meals.push({
      id: String(nextId++),
      date: isoDate,
      type: 'lunch',
      title: 'New meal',
      emoji: '🍽️'
    });
  }
</script>

<Planner
  view="week"
  items={meals}
  getDate={(m) => m.date}
  sort={(a, b) => MEAL_ORDER[a.type] - MEAL_ORDER[b.type]}
  value={new Date(2026, 5, 15)}
  locale="en-US"
>
  {#snippet cell({ items, isoDate })}
    {#each items as meal (meal.id)}
      <div class="bg-surface-subtle flex items-center gap-2 rounded-md px-2 py-1.5">
        <span aria-hidden="true">{meal.emoji}</span>
        <span class="text-text-secondary truncate text-sm">{meal.title}</span>
      </div>
    {/each}
    <!-- Rendered on every day, including empty ones — the cell snippet drives all content. -->
    <Button
      variant="ghost"
      size="sm"
      class="mt-auto justify-start"
      onclick={() => addMeal(isoDate)}
    >
      <PlusIcon size={14} />
      Add
    </Button>
  {/snippet}
</Planner>
