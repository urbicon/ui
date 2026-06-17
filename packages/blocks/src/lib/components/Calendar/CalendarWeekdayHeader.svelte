<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getCalendarContext, createSlotHelper } from './calendar.context';

  const bt = useBlocksI18n();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);
</script>

<div
  class="{slot('weekdayHeader')} {ctx.showWeekNumbers ? 'grid-cols-8' : ''}"
  role="row"
  aria-label={bt('calendar.weekdays')}
>
  {#if ctx.showWeekNumbers}
    <span class={slot('weekNumber')} role="columnheader" aria-label={bt('calendar.weekNumber')}
    ></span>
  {/if}
  {#each ctx.weekdays as day (day)}
    <span class={slot('weekday')} role="columnheader" aria-label={day}>
      {day}
    </span>
  {/each}
</div>
