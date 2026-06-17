<script lang="ts">
  import { DatePicker } from '@urbicon-ui/blocks';

  let selectedDate = $state<Date | undefined>(new Date(2026, 2, 15));
</script>

<div class="max-w-xs space-y-4">
  <DatePicker
    bind:value={selectedDate}
    label="Clearable (Standard)"
    clearable
    locale="de-DE"
    defaultMonth={2}
    defaultYear={2026}
  />

  <DatePicker
    value={new Date(2026, 2, 20)}
    label="Nicht clearable"
    clearable={false}
    locale="de-DE"
    defaultMonth={2}
    defaultYear={2026}
  />
</div>
