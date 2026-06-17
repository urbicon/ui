<script lang="ts">
  import { Calendar } from '@urbicon-ui/blocks';
  import type { DateRange } from '@urbicon-ui/blocks';

  let value = $state<DateRange | undefined>(undefined);

  const minDate = new Date(2026, 2, 1);
  const maxDate = new Date(2026, 5, 30);

  function formatRange(range: DateRange): string {
    const start = range.start.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
    const end = range.end.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const days =
      Math.ceil((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${start} – ${end} (${days} days)`;
  }
</script>

<div class="max-w-sm">
  <Calendar
    selectionMode="range"
    bind:value
    variant="bordered"
    {minDate}
    {maxDate}
    locale="en-US"
    defaultMonth={2}
    defaultYear={2026}
    showViewSwitcher={false}
  />

  {#if value && !(value instanceof Date) && !Array.isArray(value)}
    <div class="bg-surface-elevated border-border-subtle mt-3 rounded-lg border p-3">
      <p class="text-text-secondary text-sm">
        <span class="text-text-primary font-medium">Selected:</span>
        {formatRange(value)}
      </p>
    </div>
  {/if}
</div>
