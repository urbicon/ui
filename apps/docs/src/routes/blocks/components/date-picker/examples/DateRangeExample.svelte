<script lang="ts">
  import { DateRangePicker } from '@urbicon-ui/blocks';

  let value = $state<{ start: Date; end: Date } | undefined>(undefined);
</script>

<div class="max-w-xs">
  <DateRangePicker
    bind:value
    label="Reisezeitraum"
    placeholder="Zeitraum auswaehlen"
    locale="de-DE"
    defaultMonth={2}
    defaultYear={2026}
  />

  {#if value}
    <div class="bg-surface-elevated border-border-subtle mt-3 rounded-lg border p-3">
      <p class="text-text-secondary text-sm">
        <span class="text-text-primary font-medium">Von:</span>
        {value.start.toLocaleDateString('de-DE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      </p>
      <p class="text-text-secondary text-sm">
        <span class="text-text-primary font-medium">Bis:</span>
        {value.end.toLocaleDateString('de-DE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })}
      </p>
      <p class="text-text-secondary mt-1 text-xs">
        {Math.ceil((value.end.getTime() - value.start.getTime()) / (1000 * 60 * 60 * 24)) + 1} Tage
      </p>
    </div>
  {/if}
</div>
