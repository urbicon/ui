<script lang="ts">
  // Binds TimeInput to consumer state the way a form does, so a test can see
  // what reaches the consumer (`value`, `onfocusout`) and set the value from
  // outside after mount (a reset, or the echo of a one-way consumer).
  import TimeInput from '../TimeInput.svelte';

  interface Props {
    initial?: string | null;
    min?: string;
    max?: string;
    step?: number;
    onLeave?: (left: boolean, value: string | null | undefined) => void;
  }

  let { initial, min, max, step, onLeave }: Props = $props();

  // svelte-ignore state_referenced_locally
  let value = $state<string | null | undefined>(initial);

  function show(v: string | null | undefined): string {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    return v;
  }
</script>

<TimeInput
  label="Time"
  name="time"
  {min}
  {max}
  {step}
  bind:value
  onfocusout={(e) => {
    const next = e.relatedTarget as Node | null;
    onLeave?.(!(next && e.currentTarget.contains(next)), value);
  }}
/>
<span data-testid="value">{show(value)}</span>
<button data-testid="set-null" onclick={() => (value = null)}>null</button>
<button data-testid="set-undefined" onclick={() => (value = undefined)}>undefined</button>
<button data-testid="set-time" onclick={() => (value = '10:45')}>10:45</button>
