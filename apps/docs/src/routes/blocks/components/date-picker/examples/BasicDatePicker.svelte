<script lang="ts">
  import { DatePicker } from '@urbicon-ui/blocks';

  let selectedDate = $state<Date | undefined>(undefined);
</script>

<div class="max-w-xs">
  <DatePicker
    bind:value={selectedDate}
    label="Event date"
    placeholder="Select a date"
    defaultMonth={2}
    defaultYear={2026}
  />

  {#if selectedDate}
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
