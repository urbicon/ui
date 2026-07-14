<script lang="ts" generics="TValues extends Record<string, unknown>">
  import { useDocsI18n } from '$lib/i18n';
  import {
    Input,
    SegmentGroup,
    SegmentItem,
    Select,
    Slider,
    Toggle,
    Tooltip
  } from '@urbicon-ui/blocks';
  import { onMount } from 'svelte';
  import CodePanel from '../CodePanel/CodePanel.svelte';
  import type { ControlDefinition } from '@urbicon-ui/shared-types/playground';
  import { playgroundConfiguratorVariants } from './playground-configurator.variants';
  import type { PlaygroundConfiguratorProps } from './index.js';
  import {
    generateDefaultCode,
    normalizeControls,
    filterVisibleControls,
    sortControlsByType,
    computeComponentDefaults,
    isDefaultValue as isDefaultValueImpl,
    countModified
  } from './code-gen.js';
  import { decodeShareParams, encodeShareParams } from './share.js';

  const dt = useDocsI18n();

  let {
    title = dt('interactivePlayground', {}),
    subtitle = dt('playgroundSubtitle', {}),
    controls = [],
    values = $bindable(),
    onValuesChange,
    codeGenerator,
    componentName = 'Component',
    showHeader = true,
    size = 'md',
    propDocs = {},
    variantKeys = [],
    children,
    class: className,
    unstyled = false,
    slotClasses = {},
    ...restProps
  }: PlaygroundConfiguratorProps<TValues> = $props();

  const styles = $derived(playgroundConfiguratorVariants({ size }));
  const variantKeySet = $derived(new Set(variantKeys));

  // Knob-Strip uses a uniform `sm` field size across all playground
  // densities so SegmentGroup/Select/Input/Toggle line up at the same
  // visual scale. Without this, md/lg playgrounds rendered Input at
  // text-base while SegmentGroup/Select stayed text-sm — the mismatch
  // made the strip read as several incompatible UIs glued together.
  const fieldSize = 'sm' as const;

  // Help toggle: one `?` switch in the
  // actions-bar replaces per-control `(i)` info icons. Off (default) →
  // controls render bare with only mono labels; on → each control with
  // a description shows it as a hint line directly under the row. The
  // toggle is only rendered if at least one visible control actually
  // has a description — pages without any docs hide the affordance.
  let helpVisible = $state(false);

  // XC-5: variable-size previews (Calendar month grids with 5 vs. 6 week
  // rows, event lists, …) oscillate in height while the user interacts
  // with the demo itself, which shifts the controls strip + code panel
  // below — the configurator "drifts" away from the pointer. Latch the
  // tallest observed preview height as an inline min-height (high-water
  // mark) so demo-internal interaction can only grow the stage, never
  // shrink it. The latch resets when a control changes the demo's props
  // (the new state legitimately has a different natural size) and when
  // the stage width changes (a reflow has a new natural height).
  let previewMinHeight = $state(0);

  $effect(() => {
    void values;
    previewMinHeight = 0;
  });

  function latchPreviewHeight(node: HTMLElement) {
    let lastWidth = node.offsetWidth;
    const observer = new ResizeObserver(() => {
      const width = node.offsetWidth;
      if (width !== lastWidth) {
        // Width changed (viewport resize / layout change): drop the latch
        // and skip this tick — the node still carries the stale min-height,
        // so its current height is not the new natural height. The style
        // removal re-triggers the observer, which then latches cleanly.
        lastWidth = width;
        previewMinHeight = 0;
        return;
      }
      const height = node.offsetHeight;
      if (height > previewMinHeight) previewMinHeight = height;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }

  type SlotName = keyof NonNullable<PlaygroundConfiguratorProps<TValues>['slotClasses']>;
  function slot(name: SlotName) {
    if (unstyled) return slotClasses?.[name] ?? '';
    const slotFns = styles as Record<string, (args: { class?: string }) => string>;
    return slotFns[name]({ class: slotClasses?.[name] });
  }

  function getControlDescription(control: ControlDefinition): string | undefined {
    return control.description || propDocs?.[control.key];
  }

  let initialized = false;
  $effect(() => {
    if (!initialized && (!values || Object.keys(values).length === 0)) {
      const initialValues: Record<string, unknown> = {};
      controls.forEach((control) => {
        if (control.defaultValue !== undefined) {
          initialValues[control.key] = control.defaultValue;
        }
      });
      values = initialValues as TValues;
    }
    initialized = true;
  });

  function updateValue(key: string, value: unknown) {
    values = { ...values, [key]: value } as TValues;
    onValuesChange?.(values);
  }

  const normalizedControls = $derived(normalizeControls(controls));
  const visibleControls = $derived(
    sortControlsByType(filterVisibleControls(normalizedControls, values ?? {}))
  );
  const componentDefaults = $derived(computeComponentDefaults(normalizedControls));

  function isDefaultValue(key: string): boolean {
    return isDefaultValueImpl(key, values, componentDefaults);
  }

  function resetToDefault(key: string) {
    if (key in componentDefaults) {
      updateValue(key, componentDefaults[key]);
    }
  }

  const modifiedCount = $derived(countModified(normalizedControls, values, componentDefaults));
  const hasAnyDescription = $derived(visibleControls.some((c) => !!getControlDescription(c)));

  function resetAll() {
    const next: Record<string, unknown> = { ...values };
    for (const [key, def] of Object.entries(componentDefaults)) {
      next[key] = def;
    }
    values = next as TValues;
    onValuesChange?.(values);
  }

  // Share links: the query string carries only the controls the reader
  // actually changed (see `share.ts`), so a page's 60-odd call sites need no
  // new prop and a link of pure defaults is never offered.
  //
  // Seeding happens on mount, never during init: the docs app is
  // adapter-static with `prerender = true`, so the prerendered HTML was built
  // with no query string at all. Reading `location.search` while rendering
  // would make the client's first render disagree with that HTML — a
  // hydration mismatch. Same reasoning as `DocsThemeToggle`.
  onMount(() => {
    const shared = decodeShareParams(controls, window.location.search);
    if (Object.keys(shared).length === 0) return;
    // Mirrors the init effect's own guard: if this callback wins the race
    // against it, `values` may still be the empty map a consumer passed, and
    // merging a partial share subset onto that would leave every untouched
    // control undefined.
    const base = values && Object.keys(values).length > 0 ? values : componentDefaults;
    values = { ...base, ...shared } as TValues;
    onValuesChange?.(values);
  });

  let shareCopied = $state(false);
  let shareCopiedTimer: ReturnType<typeof setTimeout> | undefined;

  // The confirmation must not outlive the URL it confirms: once a control
  // moves, the copied link no longer describes what is on screen.
  $effect(() => {
    void values;
    shareCopied = false;
  });

  $effect(() => () => clearTimeout(shareCopiedTimer));

  // Copy-on-click rather than keeping the URL in sync as controls move: a live
  // `replaceState` would spam history or break the back button for a reader
  // who is only spinning knobs, and `goto` would make this package depend on
  // SvelteKit's runtime — `packages/docs` has no `$app/*` import today.
  async function copyShareLink() {
    const query = encodeShareParams(controls, values);
    const { origin, pathname } = window.location;
    try {
      await navigator.clipboard.writeText(
        query ? `${origin}${pathname}?${query}` : `${origin}${pathname}`
      );
      shareCopied = true;
      clearTimeout(shareCopiedTimer);
      shareCopiedTimer = setTimeout(() => (shareCopied = false), 2000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  }

  const generatedCode = $derived.by(() => {
    if (!values) return '';
    if (codeGenerator) return codeGenerator(values);
    return generateDefaultCode(componentName, values, componentDefaults);
  });

  let codeExpanded = $state(true);
</script>

<!--
  Caption content, shared by the `<label for>` and the `<div>` + `aria-labelledby`
  arms so the two only differ in their wrapper element. `labelId` is set only on
  the aria-labelledby arm and lands on the bare label text — never on the wrapper,
  whose reset-dot `aria-label` would otherwise leak into the widget's computed
  accessible name.
-->
{#snippet controlCaption(control: ControlDefinition, labelId: string | undefined)}
  <span id={labelId}>{control.label}</span>
  {#if variantKeySet.has(control.key)}
    <Tooltip label="Style variant (tailwind-variants)" placement="top">
      <span class={styles.variantBadge()} aria-hidden="true">V</span>
    </Tooltip>
  {/if}
  <!--
    Dirty-state dot is rendered AFTER the V badge so the badge's
    horizontal position stays constant across clean/dirty toggles.
    The per-control (i) info icon was removed in v5.4.0 — descriptions
    are now surfaced via the single `?` help-toggle in the actions
    bar below the strip.
  -->
  {#if !isDefaultValue(control.key)}
    <button
      type="button"
      class={styles.modifiedDot()}
      onclick={() => resetToDefault(control.key)}
      title="Default: {componentDefaults[control.key]}. Click to reset."
      aria-label="Reset {control.label} to default"
    ></button>
  {/if}
{/snippet}

<section class={slot('root')} {...restProps}>
  {#if showHeader}
    <div class={slot('header')}>
      <h2 class={slot('title')}>{title}</h2>
      {#if subtitle}
        <p class={slot('subtitle')}>{subtitle}</p>
      {/if}
    </div>
  {/if}

  <div class="{slot('container')} {className ?? ''}" data-docs-stage="playground">
    <!-- Preview -->
    <div class={slot('preview')} data-docs-stage-frame>
      <div
        class={slot('previewContent')}
        style:min-height={previewMinHeight ? `${previewMinHeight}px` : undefined}
        {@attach latchPreviewHeight}
      >
        {@render children?.(values)}
      </div>
    </div>

    <!-- Controls -->
    <div class={slot('controlsPanel')}>
      <div class={slot('controlsHeader')}>
        <!--
          The dirty-state count is carried visually by the "Reset all (N)"
          button — but that button only EXISTS once something is modified, and a
          live region that appears together with its text is not announced. So
          the region lives outside the {#if}, always in the DOM, and only its
          text changes; `polite` (via role=status) queues behind the control's
          own value announcement instead of interrupting it.
        -->
        <span class="sr-only" role="status">
          {modifiedCount > 0 ? dt('playgroundModified', { count: modifiedCount }) : ''}
        </span>
        {#if modifiedCount > 0}
          <button type="button" class={styles.helpToggle()} onclick={resetAll}>
            Reset all ({modifiedCount})
          </button>
        {/if}
        {#if hasAnyDescription}
          <button
            type="button"
            class={[styles.helpToggle(), helpVisible && styles.helpToggleActive()]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={helpVisible}
            onclick={() => (helpVisible = !helpVisible)}
          >
            <span aria-hidden="true">?</span>
            {helpVisible ? 'Hints on' : 'Hints'}
          </button>
        {/if}
      </div>
      <div class={slot('controlsGrid')}>
        {#each visibleControls as control (control.key)}
          {@const description = getControlDescription(control)}
          <!-- The hint div only exists while helpVisible is on, so the
               aria-describedby reference must appear/disappear with it —
               a dangling idref is an a11y validation error. -->
          {@const hintId = helpVisible && description ? `${control.key}-hint` : undefined}
          {@const items = control.items ?? []}
          {@const isEnum = control.type === 'dropdown' || control.type === 'select'}
          {@const isSegment = isEnum && items.length <= 4 && items.length > 0}
          <!-- Which element the caption addresses depends on what the branch
               renders. `<label for>` only works against a *labelable* element
               (input / button / select / textarea) — pointing it at a
               `role="radiogroup"` div or a `role="slider"` thumb is a dead
               reference that focuses nothing. So:
                 • Input / color / Toggle → the branch's `<input id={key}>`.
                 • Select → its trigger `<button id={key}-trigger>`; a button is
                   labelable, so the caption both names it and focuses it.
                 • SegmentGroup / Slider → no labelable element exists; the
                   caption becomes a plain `<div>` carrying `<span id>` and the
                   widget references it via `aria-labelledby`. -->
          {@const usesGroupLabel =
            isSegment || control.type === 'slider' || control.type === 'range'}
          {@const labelId = `${control.key}-label`}
          {@const labelFor = usesGroupLabel
            ? undefined
            : isEnum
              ? `${control.key}-trigger`
              : control.key}
          <div class={slot('controlItem')}>
            {#if labelFor}
              <label for={labelFor} class={slot('controlLabel')}>
                {@render controlCaption(control, undefined)}
              </label>
            {:else}
              <div class={slot('controlLabel')}>
                {@render controlCaption(control, labelId)}
              </div>
            {/if}

            {#if isEnum}
              {#if isSegment}
                <!-- Render an enum with <= 4 options as a text SegmentGroup —
                     no dropdown click, all options visible inline.
                     SegmentGroup is naturally compact and does not need the
                     controlControl wrapper. -->
                <SegmentGroup
                  appearance="text"
                  size="sm"
                  value={String(values[control.key] ?? '')}
                  onValueChange={(value: string) =>
                    updateValue(control.key, value === '' ? null : value)}
                  aria-labelledby={labelId}
                  aria-describedby={hintId}
                >
                  {#each items as item (item.value)}
                    <SegmentItem value={String(item.value)}>{item.label}</SegmentItem>
                  {/each}
                </SegmentGroup>
              {:else}
                {#snippet controlSelectItem(
                  option: { label: string; value: string },
                  _isSelected: boolean,
                  _toggle: () => void
                )}
                  <span class="flex w-full items-center gap-2">
                    <span class="flex-1 truncate text-left">{option.label}</span>
                    {#if String(option.value) === String(control.defaultValue)}
                      <span class="text-text-tertiary text-[10px] leading-none opacity-50"
                        >default</span
                      >
                    {/if}
                  </span>
                {/snippet}
                <div class={slot('controlControl')}>
                  <Select
                    options={items.map((item) => ({
                      label: item.label,
                      value: String(item.value)
                    }))}
                    variant="ghost"
                    value={(values[control.key] ?? null) as string | null}
                    onValueChange={(value: string | null) => updateValue(control.key, value)}
                    size={fieldSize}
                    id={control.key}
                    customItem={controlSelectItem}
                    selectionIndicator="none"
                    aria-describedby={hintId}
                  />
                </div>
              {/if}
            {:else if control.type === 'checkbox' || control.type === 'boolean'}
              <!-- `aria-label` looks redundant next to the `<label for>` above,
                   but it is not: given no `label`/`aria-label` Toggle falls back
                   to a generic aria-label ("Toggle"), and aria-label outranks an
                   associated `<label>` in the accessible-name calculation — every
                   playground switch would announce as "Toggle". The `<label for>`
                   still earns its keep: it is what focuses the switch on click. -->
              <div class={slot('controlControlCompact')}>
                <Toggle
                  appearance="dot"
                  size="sm"
                  checked={Boolean(values[control.key])}
                  onCheckedChange={(val) => updateValue(control.key, val)}
                  id={control.key}
                  aria-label={control.label}
                  aria-describedby={hintId}
                />
              </div>
            {:else if control.type === 'text'}
              <div class={slot('controlControl')}>
                <Input
                  id={control.key}
                  variant="ghost"
                  size={fieldSize}
                  value={(values[control.key] as string) ?? ''}
                  placeholder={control.placeholder}
                  oninput={(e) => updateValue(control.key, e.currentTarget.value)}
                  aria-describedby={hintId}
                />
              </div>
            {:else if control.type === 'number'}
              <div class={slot('controlControl')}>
                <Input
                  id={control.key}
                  type="number"
                  variant="ghost"
                  size={fieldSize}
                  value={(values[control.key] as number | undefined) ??
                    (control.defaultValue as number | undefined) ??
                    0}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  oninput={(e) => updateValue(control.key, Number(e.currentTarget.value))}
                  aria-describedby={hintId}
                />
              </div>
            {:else if control.type === 'color'}
              <div class={slot('controlControlCompact')}>
                <input
                  id={control.key}
                  type="color"
                  value={values[control.key] || control.defaultValue || '#000000'}
                  onchange={(e) => updateValue(control.key, e.currentTarget.value)}
                  class={styles.colorInput()}
                  aria-describedby={hintId}
                />
              </div>
            {:else if control.type === 'slider' || control.type === 'range'}
              <!-- Knob-strip slider uses `appearance="rail"` (1px hairline +
                   8px dot) so its loudness matches the SegmentGroup `text`
                   and Toggle `dot` siblings on the same row. The default
                   pill thumb would crowd the strip and re-introduce the
                   "several incompatible UIs glued together" issue called
                   out in the v5 polish notes. -->
              <div class={slot('controlControl')}>
                <Slider
                  id={control.key}
                  appearance="rail"
                  value={(values[control.key] as number | undefined) ??
                    (control.defaultValue as number | undefined) ??
                    control.min ??
                    0}
                  min={control.min}
                  max={control.max}
                  step={control.step || 1}
                  showValue
                  onValueChange={(val) =>
                    typeof val === 'number' ? updateValue(control.key, val) : undefined}
                  aria-labelledby={labelId}
                  aria-describedby={hintId}
                />
              </div>
            {/if}
          </div>
          {#if helpVisible && description}
            <div class={slot('controlHint')} id="{control.key}-hint">{description}</div>
          {/if}
        {/each}
      </div>
      <!--
        Gated on the same condition as "Reset all (N)" above: with nothing
        modified the share link is just the page URL, so there is nothing worth
        copying and the row stays out of the layout entirely.
      -->
      {#if modifiedCount > 0}
        <div class={slot('actionsBar')}>
          <button type="button" class={styles.helpToggle()} onclick={copyShareLink}>
            {shareCopied ? dt('linkCopied') : dt('copyLink')}
          </button>
          <!--
            Copy confirmation for screen readers, for the reason CodePanel
            documents: the label flipping on the control the user just pressed is
            not a reliable announcement, a status region is. Unlike CodePanel's,
            this one may live inside the {#if} — it mounts *empty* alongside the
            button, so it is in the DOM well before the click that fills it.
            `shareCopied` is provably false at mount: the effect above clears it
            on any value change, and only a value change can bring this row in.
          -->
          <span class="sr-only" role="status">{shareCopied ? dt('linkCopied') : ''}</span>
        </div>
      {/if}
    </div>

    <!-- Collapsible Generated Code -->
    {#if generatedCode}
      <CodePanel
        code={generatedCode}
        language="svelte"
        {size}
        expanded={codeExpanded}
        onToggle={() => (codeExpanded = !codeExpanded)}
        {unstyled}
        slotClasses={{
          root: [slot('codePanel'), slotClasses?.codePanel].filter(Boolean).join(' '),
          toolbar: slotClasses?.codeToolbar,
          codeDisplay: slotClasses?.codeDisplay
        }}
      />
    {/if}
  </div>
</section>
