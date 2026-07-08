<script lang="ts">
  // Test harness for DateRangePicker. It binds `value` so the tests can observe the
  // *in-progress* range that the component's JSDoc promises `bind:value` exposes:
  // the first calendar click sets `{ start: X, end: X }` and deliberately does NOT
  // fire `onValueChange`, so the bound value is the only window onto that
  // intermediate state. The current range is projected onto data-start / data-end
  // (local YYYY-MM-DD, matching the calendar's own `data-date` stamps) for a
  // declarative, reconciliation-safe read — no reliance on a callback that, by
  // contract, stays silent mid-selection.
  import DateRangePicker from '../DateRangePicker.svelte';
  import type { DateRange } from '..';
  import { toDateInputValue } from '$lib/utils/date';
  import type { ComponentProps } from 'svelte';

  let {
    value: initialValue = undefined,
    ...rest
  }: Partial<ComponentProps<typeof DateRangePicker>> = $props();

  // svelte-ignore state_referenced_locally
  let value = $state<DateRange | undefined>(initialValue);
</script>

<DateRangePicker bind:value {...rest} />
<div
  data-testid="range-state"
  data-start={value ? toDateInputValue(value.start) : ''}
  data-end={value ? toDateInputValue(value.end) : ''}
></div>
