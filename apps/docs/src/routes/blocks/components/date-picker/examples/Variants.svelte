<script lang="ts">
  import { DatePicker } from '@urbicon-ui/blocks';

  const calendarVariants = ['default', 'bordered', 'ghost'] as const;
  const inputVariants = ['outlined', 'filled', 'ghost', 'underline'] as const;
</script>

<div class="space-y-8">
  <div>
    <h4 class="text-text-secondary mb-3 text-sm font-medium">Kalender-Varianten</h4>
    <div class="max-w-xs space-y-4">
      {#each calendarVariants as variant (variant)}
        <DatePicker
          calendarVariant={variant}
          label="Kalender: {variant}"
          placeholder="Datum auswaehlen"
          locale="de-DE"
          defaultMonth={2}
          defaultYear={2026}
        />
      {/each}
    </div>
  </div>

  <div>
    <h4 class="text-text-secondary mb-3 text-sm font-medium">Input-Varianten</h4>
    <div class="max-w-xs space-y-4">
      {#each inputVariants as variant (variant)}
        <DatePicker
          inputVariant={variant}
          label="Input: {variant}"
          placeholder="Datum auswaehlen"
          locale="de-DE"
          defaultMonth={2}
          defaultYear={2026}
        />
      {/each}
    </div>
  </div>
</div>
