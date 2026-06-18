<script lang="ts">
  import { page } from '$app/state';
  import { asset } from '$app/paths';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    extractPlaygroundDocs,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import CustomDocs from './Docs.svelte';
  import { componentData } from './api';
  import { Planner } from '@urbicon-ui/blocks';

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const navigation = [
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'examples', title: 'Examples', order: 2 },
    { id: 'customization', title: 'Customization', order: 3 },
    { id: 'accessibility', title: 'Accessibility', order: 4 },
    { id: 'api', title: 'API Reference', order: 10 },
    { id: 'installation', title: 'Installation', order: 11 }
  ];

  // --- Demo data: a week of meals, anchored on Mon 15 Jun 2026 ---
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
</script>

<SeoMeta title="Planner Component" />

<DocsPageLayout
  maxWidth="2xl"
  showToc={true}
  title="Planner"
  description="Date-indexed planning grid whose cells hold your own domain content via a generic cell snippet — week, month or custom range."
  breadcrumbs={[
    { label: 'Blocks', href: '/blocks' },
    { label: 'Components', href: '/blocks/components' }
  ]}
  {navigation}
>
  <Section id="playground" title="Playground" intent="primary">
    <PlaygroundConfigurator
      showHeader={false}
      {propDocs}
      {variantKeys}
      componentName="Planner"
      controls={[
        {
          type: 'dropdown',
          key: 'view',
          label: 'View',
          items: [
            { label: 'week', value: 'week' },
            { label: 'month', value: 'month' }
          ],
          defaultValue: 'week'
        },
        {
          type: 'dropdown',
          key: 'variant',
          label: 'Variant',
          items: [
            { label: 'default', value: 'default' },
            { label: 'bordered', value: 'bordered' },
            { label: 'ghost', value: 'ghost' }
          ],
          defaultValue: 'default'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        { type: 'checkbox', key: 'showWeekNumber', label: 'Week Number', defaultValue: false },
        { type: 'checkbox', key: 'highlightToday', label: 'Highlight Today', defaultValue: true },
        {
          type: 'checkbox',
          key: 'highlightWeekend',
          label: 'Highlight Weekend',
          defaultValue: false
        },
        { type: 'checkbox', key: 'animated', label: 'Animated', defaultValue: true },
        { type: 'checkbox', key: 'disabled', label: 'Disabled', defaultValue: false }
      ]}
      values={{
        view: 'week',
        variant: 'default',
        size: 'md',
        showWeekNumber: false,
        highlightToday: true,
        highlightWeekend: false,
        animated: true,
        disabled: false
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
            locale="en-US"
          >
            {#snippet cell({ items })}
              {#each items as meal (meal.id)}
                <div
                  class="bg-surface-subtle flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                >
                  <span aria-hidden="true">{meal.emoji}</span>
                  <span class="text-text-secondary truncate">{meal.title}</span>
                </div>
              {/each}
            {/snippet}
          </Planner>
        </div>
      {/snippet}
    </PlaygroundConfigurator>
  </Section>

  <CustomDocs />

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} />
  </Section>

  <Section id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Planner } from '@urbicon-ui/blocks';`}
      language="svelte"
      hasPreview={false}
    />
  </Section>

  <div class="mt-6 text-right">
    <a
      href={asset('/blocks/components/planner/llm.txt')}
      target="_blank"
      rel="noopener"
      class="text-text-tertiary hover:text-primary text-xs transition-colors"
    >
      llm.txt
    </a>
  </div>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
