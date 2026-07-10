<script lang="ts">
  import { Input } from '$lib/primitives/Input';
  import { resolveIcon } from '$lib/icons';
  import ChevronDownIconDefault from '$lib/icons/ChevronDownIcon.svelte';
  import type { NumberInputProps } from './index';

  const ChevronIcon = resolveIcon('chevronDown', ChevronDownIconDefault);

  let {
    value = $bindable(null),
    min,
    max,
    step = 1,
    precision,
    hideStepper = false,
    disabled = false,
    readonly = false,
    name,
    onValueChange,
    rightIcon: userRightIcon,
    ...inputProps
  }: NumberInputProps = $props();

  // Tracks focus so the wheel handler only steers a focused field (scrolling the
  // page over an unfocused one must not change it). Set by the input's focus/blur.
  let focused = $state(false);

  // Display mirrors `value` (derived) but is overridden with the raw text while
  // typing, so intermediate states — a trailing separator, a lone leading `-` —
  // survive until blur. Same override pattern as CurrencyInput.
  let display = $derived(value == null ? '' : formatNumber(value));

  function decimalsOf(n: number): number {
    const s = String(n);
    const dot = s.indexOf('.');
    return dot === -1 ? 0 : s.length - dot - 1;
  }

  function roundTo(v: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(v * factor) / factor;
  }

  function formatNumber(v: number): string {
    return precision != null ? v.toFixed(precision) : String(v);
  }

  function parseNumber(raw: string): number | null {
    // Accept a comma as the decimal separator so `1,5` works under DE keyboards.
    const t = raw.trim().replace(',', '.');
    if (t === '') return null;
    const n = Number(t);
    // NaN (e.g. a lone `-` mid-compose, or junk) leaves the value untouched so
    // the raw text can stay in the field until it parses or the user blurs.
    return Number.isFinite(n) ? n : (value ?? null);
  }

  function clampValue(v: number | null): number | null {
    if (v == null) return null;
    let r = v;
    if (min != null && r < min) r = min;
    if (max != null && r > max) r = max;
    if (precision != null) r = roundTo(r, precision);
    return r;
  }

  function commit(next: number | null) {
    if (next !== value) {
      value = next;
      onValueChange?.(next);
    }
    display = next == null ? '' : formatNumber(next);
  }

  function stepBy(dir: 1 | -1) {
    if (disabled || readonly) return;
    const base = value ?? min ?? 0;
    // Round on the step's own scale so 0.1 + 0.2 lands on 0.3, not 0.30000000004.
    const decimals = precision ?? decimalsOf(step);
    commit(clampValue(roundTo(base + dir * step, decimals)));
  }

  function handleInput(event: Event) {
    const raw = (event.currentTarget as HTMLInputElement).value;
    const parsed = parseNumber(raw);
    if (parsed !== value) {
      value = parsed;
      onValueChange?.(parsed);
    }
    display = raw; // keep the raw text; clamp/format happens on blur
  }

  function handleFocus() {
    focused = true;
  }

  function handleBlur() {
    focused = false;
    commit(clampValue(value));
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      stepBy(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      stepBy(-1);
    }
  }

  function handleWheel(event: WheelEvent) {
    // Only steer the value when the field is focused, so scrolling the page with
    // the pointer over an unfocused field doesn't silently change it.
    if (!focused) return;
    event.preventDefault();
    stepBy(event.deltaY < 0 ? 1 : -1);
  }

  const atMin = $derived(min != null && value != null && value <= min);
  const atMax = $derived(max != null && value != null && value >= max);
</script>

{#snippet stepper()}
  <span class="-my-1 flex flex-col justify-center">
    <button
      type="button"
      class="text-text-tertiary hover:text-text-primary flex items-center justify-center px-0.5 transition-colors disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none"
      tabindex={-1}
      aria-hidden="true"
      disabled={disabled || readonly || atMax}
      onmousedown={(e) => e.preventDefault()}
      onclick={() => stepBy(1)}
    >
      <ChevronIcon class="h-3.5 w-3.5 rotate-180" />
    </button>
    <button
      type="button"
      class="text-text-tertiary hover:text-text-primary flex items-center justify-center px-0.5 transition-colors disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-none"
      tabindex={-1}
      aria-hidden="true"
      disabled={disabled || readonly || atMin}
      onmousedown={(e) => e.preventDefault()}
      onclick={() => stepBy(-1)}
    >
      <ChevronIcon class="h-3.5 w-3.5" />
    </button>
  </span>
{/snippet}

<Input
  {...inputProps}
  {disabled}
  {readonly}
  type="text"
  inputmode="decimal"
  role="spinbutton"
  aria-valuenow={value ?? undefined}
  aria-valuemin={min}
  aria-valuemax={max}
  value={display}
  oninput={handleInput}
  onfocus={handleFocus}
  onblur={handleBlur}
  onkeydown={handleKeydown}
  onwheel={handleWheel}
  rightIcon={userRightIcon ?? (hideStepper ? undefined : stepper)}
/>

{#if name}
  <input type="hidden" {name} value={value ?? ''} />
{/if}
