<script lang="ts">
  // Test-only composition harness for multi-select Combobox. Two things a plain
  // `mount(Combobox, { props })` can't do drive this instead:
  //   • `customTag` is a Snippet prop — a real `{#snippet}` composition exercises
  //     the custom-chip render arm and its `remove` callback wiring.
  //   • native `mount` props aren't reactive to reassignment, so a local `$state`
  //     array + a parent "add" button proves `bind:value` re-derives the tags.
  // Lives under __fixtures__/ so it's excluded from the published package
  // (package.json `files`) and never collected as a test (no .test/.spec).
  import type { ComboboxOption } from '../index';
  import Combobox from '../Combobox.svelte';

  // Combobox widens its generic `T` to the constraint `string | number | boolean`
  // at the use site (same reason the test helper types props at that width), so
  // the harness matches that width rather than narrowing to `string`.
  type V = string | number | boolean;

  let {
    options = [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
      { value: 'cherry', label: 'Cherry' }
    ] as ComboboxOption<V>[],
    maxItems,
    onValueChange,
    onRemoveTag
  }: {
    options?: ComboboxOption<V>[];
    maxItems?: number;
    onValueChange?: (value: V[]) => void;
    onRemoveTag?: (value: V) => void;
  } = $props();

  // Starts empty; tests build the selection through real interaction (picking
  // options) or the parent "add" button — both exercise reactive `bind:value`.
  let value = $state<V[]>([]);
</script>

<!-- Parent-controlled mutation — proves a programmatic push re-renders the tags. -->
<button
  type="button"
  data-testid="harness-add-cherry"
  onclick={() => (value = [...value, 'cherry'])}
>
  add cherry
</button>

<Combobox {options} multiple bind:value {maxItems} {onValueChange} {onRemoveTag}>
  {#snippet customTag(opt: ComboboxOption<V>, remove: () => void)}
    <span data-testid="custom-tag" data-value={String(opt.value)}>
      {opt.label}
      <button type="button" data-testid="custom-remove-{opt.value}" onclick={remove}>×</button>
    </span>
  {/snippet}
</Combobox>
