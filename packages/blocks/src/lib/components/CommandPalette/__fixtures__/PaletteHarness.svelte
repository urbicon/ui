<script lang="ts">
  // Test-only consumer of CommandPalette through a real `bind:open` and
  // `bind:query`: a `$state` props object handed to `mount()` has no setter for
  // a bindable prop, so the palette would keep its own copy and neither a
  // write-back inside `onOpenChange` nor the reset would reach the consumer.
  // `bind:query` is a function binding, so every write the palette makes to
  // the consumer's query is recorded in `queryWrites`. `locale` mounts it under
  // a request-scoped i18n state (`provideI18n`, the primitive behind
  // <I18nProvider>); the caller eager-registers the bundle.
  import { provideI18n } from '@urbicon-ui/i18n';
  import type { Locale } from '@urbicon-ui/i18n';
  import CommandPalette from '../CommandPalette.svelte';
  import type { CommandPaletteItem } from '../index';

  let {
    items,
    initialOpen = true,
    initialQuery = '',
    vetoClose = false,
    transitionDuration,
    onClosed,
    onSelect,
    locale
  }: {
    items: CommandPaletteItem[];
    initialOpen?: boolean;
    initialQuery?: string;
    /** Write `open = true` back inside `onOpenChange(false)`. */
    vetoClose?: boolean;
    /** The inner Dialog's; CommandPalette passes it through its rest props. */
    transitionDuration?: number;
    onClosed?: () => void;
    onSelect?: (item: CommandPaletteItem) => void;
    /** Locale of the surrounding i18n state; `undefined` mounts none. */
    locale?: Locale;
  } = $props();

  // Read once at init: provideI18n must run during setup.
  // svelte-ignore state_referenced_locally
  if (locale) provideI18n(locale);

  // Seed-once by design: the bindings own the values after mount.
  // svelte-ignore state_referenced_locally
  let open = $state(initialOpen);
  // svelte-ignore state_referenced_locally
  let query = $state(initialQuery);
  const queryWrites: string[] = [];

  export function setOpen(value: boolean) {
    open = value;
  }

  export function getOpen() {
    return open;
  }

  export function setQuery(value: string) {
    query = value;
  }

  export function getQuery() {
    return query;
  }

  /** Every value the palette wrote to the bound query, in order. */
  export function getQueryWrites() {
    return [...queryWrites];
  }

  function handleOpenChange(next: boolean) {
    if (!next && vetoClose) open = true;
  }

  const dialogProps = $derived(transitionDuration === undefined ? {} : { transitionDuration });
</script>

<CommandPalette
  {items}
  bind:open
  bind:query={
    () => query,
    (value) => {
      queryWrites.push(value);
      query = value;
    }
  }
  shortcut={false}
  onOpenChange={handleOpenChange}
  {onClosed}
  {onSelect}
  {...dialogProps}
/>
