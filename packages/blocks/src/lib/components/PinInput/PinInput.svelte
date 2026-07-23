<script lang="ts">
  import { untrack } from 'svelte';
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext } from '$lib/utils';
  import type { PinInputProps } from './index';
  import { pinInputVariants, type PinInputVariants } from './pin-input.variants';

  const bt = useBlocksI18n();

  let {
    value = $bindable(''),
    length = 6,
    type = 'numeric',
    mask = false,
    placeholder = '',
    uppercase = false,
    autoFocus = false,
    separator,
    groupSize = 3,
    tier,
    variant = 'outlined',
    size = 'md',
    intent = 'default',
    disabled = false,
    readonly = false,
    required = false,
    label,
    helper,
    error,
    onValueChange,
    onComplete,
    name,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    id: idProp,
    'aria-label': ariaLabel
  }: PinInputProps = $props();

  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const propsId = $props.id();
  const fieldId = $derived(idProp ?? `pininput-${propsId}`);
  const labelId = $derived(`${fieldId}-label`);
  const messageId = $derived(`${fieldId}-message`);
  const describedBy = $derived(error || helper ? messageId : undefined);

  // Allowed-character filter. `numeric` keeps digits; `alphanumeric` also keeps
  // ASCII letters and (optionally) uppercases them. Applied to typed input,
  // pasted text, and externally-set values alike, so the model never holds a
  // character a cell could not have produced.
  function sanitize(raw: string): string {
    const re = type === 'numeric' ? /[^0-9]/g : /[^0-9a-zA-Z]/g;
    const cleaned = raw.replace(re, '');
    return uppercase && type !== 'numeric' ? cleaned.toUpperCase() : cleaned;
  }

  function toCells(raw: string): string[] {
    const chars = sanitize(raw).slice(0, length).split('');
    return Array.from({ length }, (_, i) => chars[i] ?? '');
  }

  // `cells` is the DOM source of truth; `value` (bindable) mirrors its join.
  // Empty cells collapse in the join — fine for OTP, where the value is the
  // sequence of entered characters, not a positional map.
  let cells = $state<string[]>(toCells(value ?? ''));
  let inputs = $state<(HTMLInputElement | undefined)[]>([]);
  let wasComplete = $state(false);

  // External value / length / filter changes re-seed the buffer. Writing back a
  // normalized `value` keeps an out-of-range or unsanitized prop honest without
  // firing onValueChange (the parent set it deliberately).
  $effect(() => {
    const normalized = toCells(value ?? '').join('');
    if (normalized !== untrack(() => cells.join(''))) {
      cells = toCells(normalized);
    }
    if (normalized !== (value ?? '')) {
      value = normalized;
    }
  });

  // Stable per-position keys — the index IS the cell identity, but a derived id
  // keeps `{#each}` off a bare index key.
  const cellKeys = $derived(Array.from({ length }, (_, i) => `${fieldId}-cell-${i}`));

  const variantProps: PinInputVariants = $derived({
    tier: effectiveTier,
    variant,
    size,
    intent,
    disabled: disabled || undefined,
    readonly: readonly || undefined,
    error: !!error || undefined,
    required: required || undefined,
    messageType: error ? 'error' : 'helper'
  });

  const styles = $derived(pinInputVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'PinInput', preset, variantProps, slotClassesProp)
  );

  function cellClass() {
    return unstyled ? (slotClasses?.cell ?? '') : styles.cell({ class: slotClasses?.cell });
  }

  function focusCell(index: number) {
    const el = inputs[index];
    if (el) {
      el.focus();
      el.select();
    }
  }

  function emit() {
    const joined = cells.join('');
    if (joined !== value) {
      value = joined;
      onValueChange?.(joined);
    }
    const complete = cells.every((c) => c !== '');
    if (complete && !wasComplete) onComplete?.(joined);
    wasComplete = complete;
  }

  // Distribute a run of characters across cells starting at `start` (typing more
  // than one char, autofill, or paste). Focus lands on the cell after the last
  // one written, or the final cell when the run fills to the end.
  function fill(start: number, raw: string) {
    const chars = sanitize(raw).split('');
    if (chars.length === 0) return;
    let idx = start;
    for (const ch of chars) {
      if (idx >= length) break;
      cells[idx] = ch;
      idx++;
    }
    emit();
    focusCell(Math.min(idx, length - 1));
  }

  function handleInput(index: number, event: Event) {
    const el = event.currentTarget as HTMLInputElement;
    const sanitized = sanitize(el.value);
    if (sanitized.length <= 1) {
      const ch = sanitized;
      // A rejected character (a letter in numeric mode) sanitizes to '' while the
      // raw field is non-empty. Restore the existing digit instead of erasing it —
      // a bad keystroke must not destroy a filled cell.
      if (ch === '' && el.value !== '') {
        el.value = cells[index];
        return;
      }
      // Force the DOM to the sanitized single char so a rejected glyph can never
      // linger in an otherwise-empty cell (the model may not have changed).
      el.value = ch;
      if (cells[index] !== ch) {
        cells[index] = ch;
        emit();
      }
      if (ch && index < length - 1) focusCell(index + 1);
    } else {
      fill(index, sanitized);
      el.value = cells[index];
    }
  }

  function handleKeydown(index: number, event: KeyboardEvent) {
    if (disabled) return;
    switch (event.key) {
      case 'Backspace':
        if (readonly) break;
        event.preventDefault();
        if (cells[index]) {
          cells[index] = '';
          if (inputs[index]) inputs[index]!.value = '';
          emit();
        } else if (index > 0) {
          cells[index - 1] = '';
          if (inputs[index - 1]) inputs[index - 1]!.value = '';
          emit();
          focusCell(index - 1);
        }
        break;
      case 'Delete':
        if (readonly) break;
        event.preventDefault();
        if (cells[index]) {
          cells[index] = '';
          if (inputs[index]) inputs[index]!.value = '';
          emit();
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (index > 0) focusCell(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (index < length - 1) focusCell(index + 1);
        break;
      case 'Home':
        event.preventDefault();
        focusCell(0);
        break;
      case 'End':
        event.preventDefault();
        focusCell(length - 1);
        break;
    }
  }

  function handlePaste(index: number, event: ClipboardEvent) {
    event.preventDefault();
    if (disabled || readonly) return;
    fill(index, event.clipboardData?.getData('text') ?? '');
  }

  function handleFocus(event: FocusEvent) {
    (event.currentTarget as HTMLInputElement).select();
  }

  // Focus the first empty cell on mount when requested. Runs once — autoFocus is
  // stable — and untracks `cells` so a later edit does not re-steal focus.
  $effect(() => {
    if (!autoFocus) return;
    untrack(() => {
      const firstEmpty = cells.findIndex((c) => !c);
      focusCell(firstEmpty === -1 ? length - 1 : firstEmpty);
    });
  });
</script>

<div
  class={unstyled
    ? [slotClasses?.root, className].filter(Boolean).join(' ')
    : styles.root({ class: [slotClasses?.root, className] })}
>
  {#if label}
    <span
      id={labelId}
      class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
    >
      {label}
    </span>
  {/if}

  <div
    role="group"
    aria-labelledby={label ? labelId : undefined}
    aria-label={label ? undefined : ariaLabel}
    class={unstyled ? (slotClasses?.group ?? '') : styles.group({ class: slotClasses?.group })}
  >
    {#each cellKeys as key, i (key)}
      {#if separator && i > 0 && i % groupSize === 0}
        <span
          aria-hidden="true"
          class={unstyled
            ? (slotClasses?.separator ?? '')
            : styles.separator({ class: slotClasses?.separator })}
        >
          {separator}
        </span>
      {/if}
      <input
        bind:this={inputs[i]}
        id={i === 0 ? fieldId : undefined}
        value={cells[i]}
        type={mask ? 'password' : 'text'}
        inputmode={type === 'numeric' ? 'numeric' : 'text'}
        autocomplete={i === 0 ? 'one-time-code' : 'off'}
        pattern={type === 'numeric' ? '[0-9]*' : undefined}
        maxlength="1"
        placeholder={placeholder || undefined}
        {disabled}
        {readonly}
        aria-label={bt('accessibility.pinInputCell', { index: i + 1, total: length })}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        class={cellClass()}
        oninput={(e) => handleInput(i, e)}
        onkeydown={(e) => handleKeydown(i, e)}
        onpaste={(e) => handlePaste(i, e)}
        onfocus={handleFocus}
      />
    {/each}
  </div>

  {#if error}
    <div
      id={messageId}
      role="alert"
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
    >
      {error}
    </div>
  {:else if helper}
    <div
      id={messageId}
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
    >
      {helper}
    </div>
  {/if}

  {#if name}
    <input type="hidden" {name} {value} />
  {/if}
</div>
