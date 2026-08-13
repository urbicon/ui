<script lang="ts">
  import { DatePicker } from '@urbicon-ui/blocks';

  let selectedDate = $state<Date | undefined>(undefined);

  const minDate = new Date(2026, 2, 1);
  const maxDate = new Date(2026, 2, 31);

  /** Disable weekends */
  function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /** Specific holidays / blocked dates */
  const holidays = [new Date(2026, 2, 6), new Date(2026, 2, 20)];
</script>

<div class="max-w-xs">
  <DatePicker
    bind:value={selectedDate}
    label="Appointment"
    placeholder="Pick a weekday"
    helper="Weekdays in March 2026 only, no holidays."
    {minDate}
    {maxDate}
    isDateDisabled={isWeekend}
    disabledDates={holidays}
    defaultMonth={2}
    defaultYear={2026}
  />

  {#if selectedDate}
    <div class="bg-surface-elevated border-border-subtle mt-3 rounded-lg border p-3">
      <p class="text-text-secondary text-sm">
        <span class="text-text-primary font-medium">Appointment:</span>
        {selectedDate.toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      </p>
    </div>
  {/if}
</div>
