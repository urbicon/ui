<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getCalendarContext, createSlotHelper } from './calendar.context';

  const bt = useBlocksI18n();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);
</script>

<div class={slot('weekdayHeader')} role="row" aria-label={bt('calendar.weekdays')}>
  {#if ctx.showWeekNumbers}
    <span class={slot('weekNumber')} role="columnheader" aria-label={bt('calendar.weekNumber')}
    ></span>
  {/if}
  <!-- Short/narrow weekday names duplicate in many locales (de-DE narrow:
       M, D, M, D, F, S, S), so the key needs the column position to stay
       unique — a bare name key crashes dev-mode client renders. -->
  {#each ctx.weekdays as day, i (`${i}-${day}`)}
    <span class={slot('weekday')} role="columnheader" aria-label={day}>
      {day}
    </span>
  {/each}
</div>
