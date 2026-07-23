<script lang="ts">
  // Drives TimeInput with reactive `format` / `withSeconds` / `value` so a test
  // can flip a prop after mount and assert the segments re-seed (regression for
  // the runtime format-switch bug that could emit an invalid "25:30").
  import TimeInput from '../TimeInput.svelte';

  let format = $state<'12h' | '24h'>('24h');
  let withSeconds = $state(false);
  let value = $state<string | null>('13:30');
</script>

<button data-testid="flip-format" onclick={() => (format = format === '24h' ? '12h' : '24h')}>
  flip
</button>
<button data-testid="toggle-seconds" onclick={() => (withSeconds = !withSeconds)}>seconds</button>
<TimeInput label="Time" {format} {withSeconds} bind:value />
<span data-testid="value">{value ?? 'null'}</span>
