<!--
  Planner-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Planner } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  type MealType = 'breakfast' | 'lunch' | 'dinner';

  interface Meal {
    id: string;
    date: string; // local ISO date — never UTC-parsed
    type: MealType;
    title: string;
    emoji: string;
  }

  const MEAL_ORDER: Record<MealType, number> = { breakfast: 0, lunch: 1, dinner: 2 };

  const demoMeals: Meal[] = [
    { id: '1', date: '2026-06-15', type: 'breakfast', title: 'Overnight Oats', emoji: '🥣' },
    { id: '2', date: '2026-06-15', type: 'lunch', title: 'Caprese Salad', emoji: '🥗' },
    { id: '3', date: '2026-06-15', type: 'dinner', title: 'Lentil Curry', emoji: '🍛' },
    { id: '4', date: '2026-06-16', type: 'breakfast', title: 'Avocado Toast', emoji: '🥑' },
    { id: '5', date: '2026-06-16', type: 'dinner', title: 'Margherita Pizza', emoji: '🍕' },
    { id: '6', date: '2026-06-17', type: 'lunch', title: 'Ramen Bowl', emoji: '🍜' },
    { id: '7', date: '2026-06-18', type: 'breakfast', title: 'Berry Pancakes', emoji: '🥞' },
    { id: '8', date: '2026-06-18', type: 'lunch', title: 'Falafel Wrap', emoji: '🌯' },
    { id: '9', date: '2026-06-18', type: 'dinner', title: 'Risotto ai Funghi', emoji: '🍚' },
    { id: '10', date: '2026-06-19', type: 'dinner', title: 'Tacos al Pastor', emoji: '🌮' },
    { id: '11', date: '2026-06-20', type: 'lunch', title: 'Poke Bowl', emoji: '🐟' },
    { id: '12', date: '2026-06-21', type: 'breakfast', title: 'Shakshuka', emoji: '🍳' }
  ];

  const anchor = new Date(2026, 5, 15);

  const controls = deriveControls(componentData, {
    pick: [
      'view',
      'variant',
      'size',
      'showWeekNumber',
      'highlightToday',
      'highlightWeekend',
      'animated',
      'disabled'
    ],
    overrides: {
      // Bewusst ohne `range`: Die dritte Ansicht des Typs braucht zusätzlich
      // `rangeStart`/`rangeEnd`, und ohne die wirft das Datumsraster. Kein
      // Drift, sondern eine Auswahl — deshalb steht die Liste hier.
      view: {
        items: [
          { label: 'week', value: 'week' },
          { label: 'month', value: 'month' }
        ]
      },
      showWeekNumber: { label: 'Week Number' },
      highlightToday: { label: 'Highlight Today', defaultValue: true },
      highlightWeekend: { label: 'Highlight Weekend' },
      animated: { defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Planner"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Planner } from '@urbicon-ui/blocks';"],
    consts: { items: demoMeals },
    bind: ['items']
  }}
>
  {#snippet children(values)}
    <div class="w-full">
      <Planner
        view={values.view}
        variant={values.variant}
        size={values.size}
        showWeekNumber={values.showWeekNumber}
        highlightToday={values.highlightToday}
        highlightWeekend={values.highlightWeekend}
        animated={values.animated}
        disabled={values.disabled}
        items={demoMeals}
        getDate={(m) => m.date}
        sort={(a, b) => MEAL_ORDER[a.type] - MEAL_ORDER[b.type]}
        value={anchor}
      >
        {#snippet cell({ items })}
          {#each items as meal (meal.id)}
            <div class="bg-surface-subtle flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <span aria-hidden="true">{meal.emoji}</span>
              <span class="text-text-secondary truncate">{meal.title}</span>
            </div>
          {/each}
        {/snippet}
      </Planner>
    </div>
  {/snippet}
</PlaygroundConfigurator>
