<script lang="ts">
  // Hands TimeInput's value to consumer state the way a form does, so a test can
  // see what reaches the consumer (`value`, `onfocusout`) and set the value after
  // mount (a reset from outside, or the echo of a one-way consumer).
  //   bind     — `bind:value`
  //   identity — one-way, stores what it receives
  //   string   — one-way, stores "no time" as "" (A2UI's model has this shape)
  import TimeInput from '../TimeInput.svelte';

  interface Props {
    mode?: 'bind' | 'identity' | 'string';
    initial?: string | null;
    min?: string;
    max?: string;
    step?: number;
    onLeave?: (left: boolean, value: string | null | undefined) => void;
  }

  let { mode = 'bind', initial, min, max, step, onLeave }: Props = $props();

  // svelte-ignore state_referenced_locally
  let value = $state<string | null | undefined>(initial);

  function show(v: string | null | undefined): string {
    if (v === undefined) return 'undefined';
    if (v === null) return 'null';
    return v === '' ? '""' : v;
  }

  function leave(e: FocusEvent & { currentTarget: EventTarget & HTMLDivElement }) {
    const next = e.relatedTarget as Node | null;
    onLeave?.(!(next && e.currentTarget.contains(next)), value);
  }
</script>

{#if mode === 'bind'}
  <TimeInput label="Time" name="time" {min} {max} {step} bind:value onfocusout={leave} />
{:else}
  <TimeInput
    label="Time"
    name="time"
    {min}
    {max}
    {step}
    {value}
    onValueChange={(v) => (value = mode === 'string' ? (v ?? '') : v)}
    onfocusout={leave}
  />
{/if}
<span data-testid="value">{show(value)}</span>
<button data-testid="set-null" onclick={() => (value = null)}>null</button>
<button data-testid="set-undefined" onclick={() => (value = undefined)}>undefined</button>
<button data-testid="set-empty" onclick={() => (value = '')}>empty</button>
<button data-testid="set-time" onclick={() => (value = '10:45')}>10:45</button>
