<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';

  const minDate = new Date(2026, 2, 1);
  const maxDate = new Date(2026, 2, 31);

  function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  const holidays = [new Date(2026, 2, 6), new Date(2026, 2, 20)];

  let selectedDate = $state<Date | undefined>(undefined);
</script>

<div class="max-w-sm">
  <Calendar
    bind:value={selectedDate}
    variant="bordered"
    {minDate}
    {maxDate}
    isDateDisabled={isWeekend}
    disabledDates={holidays}
    locale="en-US"
    defaultMonth={2}
    defaultYear={2026}
    showViewSwitcher={false}
  />

  {#if selectedDate && selectedDate instanceof Date}
    <div class="bg-surface-elevated border-border-subtle mt-3 rounded-lg border p-3">
      <p class="text-text-secondary text-sm">
        <span class="text-text-primary font-medium">Selected:</span>
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
