<script lang="ts">
  import { DatePicker } from '@urbicon-ui/blocks';

  const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
</script>

<div class="max-w-xs space-y-4">
  {#each sizes as size (size)}
    <DatePicker
      {size}
      label="Datum ({size})"
      placeholder="Datum auswaehlen"
      locale="de-DE"
      defaultMonth={2}
      defaultYear={2026}
    />
  {/each}
</div>
