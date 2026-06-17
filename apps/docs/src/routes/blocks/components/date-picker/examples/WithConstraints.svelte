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
    label="Terminbuchung"
    placeholder="Werktag waehlen"
    helper="Nur Werktage im Maerz 2026, keine Feiertage."
    locale="de-DE"
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
        <span class="text-text-primary font-medium">Termin:</span>
        {selectedDate.toLocaleDateString('de-DE', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      </p>
    </div>
  {/if}
</div>
