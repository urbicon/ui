<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getCalendarContext, createSlotHelper } from './calendar.context';

  const bt = useBlocksI18n();

  interface CalendarLegendInternalProps {
    orientation?: 'horizontal' | 'vertical';
    class?: string;
  }

  let { orientation = 'horizontal', class: className = '' }: CalendarLegendInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);
</script>

{#if ctx.categories.length > 0}
  <div
    class="{slot('legend', className)} {orientation === 'vertical' ? 'flex-col items-start' : ''}"
    role="list"
    aria-label={bt('calendar.legend')}
  >
    {#each ctx.categories as category (category.id)}
      <div class={slot('legendItem')} role="listitem">
        <span
          class={slot('legendDot')}
          style="background-color: {category.color}"
          aria-hidden="true"
        ></span>
        <span class={slot('legendLabel')}>{category.label}</span>
      </div>
    {/each}
  </div>
{/if}
