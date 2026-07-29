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
    computeDemoOnlyKeys,
    computeOmittableDefaults,
    isDefaultValue as isDefaultValueImpl,
    countModified,
    numberFieldValue,
    readNumberField,
    reconcileNumberField,
    selectDisplayValue,
    resolveSegmentValue,
    resolveSelectValue
  } from './code-gen.js';
  import { extractChildMarkup } from './extract-markup.js';
  import { decodeShareParams, encodeShareParams } from './share.js';
  import { getCodeVisibilityContext } from '$lib/stores/code-visibility.svelte';

  const dt = useDocsI18n();

  let {
    title = dt('interactivePlayground', {}),
    subtitle = dt('playgroundSubtitle', {}),
    controls = [],
    // Defaulted for the same reason as `controls`: a playground without knobs
    // passes neither, and every read below would otherwise be `| undefined`.
    // A caller that binds still wins — a bindable's default only applies when
    // the prop is absent.
    values = $bindable({} as TValues),
    onValuesChange,
    codeGenerator,
    codeSetup,
    source,
    defaultCodeExpanded,
    componentName = 'Component',
    shareKey,
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
  // mark) so the stage can only grow, never shrink.
  //
  // The latch used to reset on every control change, on the theory that a new
  // state "legitimately has a different natural size". In practice that is the
  // loudest source of jumping there is: working down a control strip resizes
  // the stage under the pointer at almost every step, and the controls
  // themselves move with it. The stage now holds its high-water mark for as
  // long as the component is on screen.
  //
  // Two things still drop it, both because the old mark stops being a
  // measurement of anything: a width change (a reflow has a new natural
  // height) and "Reset all", where the reader has explicitly asked for the
  // starting state back.
  let previewMinHeight = $state(0);

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
      // The mark only remembers what fits on one screen. Without the cap it is
      // monotonic and remembers outliers forever: Calendar's Agenda view is
      // 1681 px, so every later view sat in a stage held open to that — going
      // back to Month left 1208 px of nothing below the calendar. A state that
      // tall makes the stage grow past the mark anyway (min-height only ever
      // sets a floor); it just must not become the floor for everything after
      // it. Below the cap — where the jitter that the latch exists to absorb
      // actually happens — nothing changes.
      const height = Math.min(node.offsetHeight, window.innerHeight * 0.7);
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
  // Was der Schnipsel weglassen darf, ist nicht dasselbe wie der Startwert des
  // Playgrounds — siehe `computeOmittableDefaults`.
  const omittableDefaults = $derived(computeOmittableDefaults(normalizedControls));
  const demoOnlyKeys = $derived(computeDemoOnlyKeys(normalizedControls));

  function isDefaultValue(key: string): boolean {
    return isDefaultValueImpl(key, values, componentDefaults);
  }

  function resetToDefault(key: string) {
    if (key in componentDefaults) {
      updateValue(key, componentDefaults[key]);
    }
  }

  // The number field commits only what `readNumberField` accepts, so `values`
  // can never hold a number the share codec would refuse to carry (both halves
  // reject out-of-range) and a cleared field can never mean `Number('')` → 0.
  function onNumberInput(control: ControlDefinition, raw: string) {
    const next = readNumberField(control, raw);
    if (next !== undefined) updateValue(control.key, next);
  }

  // Holding a value back mid-typing leaves the field showing text `values`
  // never took. Svelte only pushes `value` down when the bound expression
  // changes, so a field that settles on the value it already had (blank,
  // restored) has to be re-synced by hand.
  function onNumberBlur(control: ControlDefinition, input: HTMLInputElement) {
    const committed = numberFieldValue(control, values);
    const next = reconcileNumberField(control, input.value, committed);
    if (next !== committed) updateValue(control.key, next);
    input.value = String(next);
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
    // The one place the stage may shrink again: the reader asked for the
    // starting state, and a mark left over from a taller variant would keep
    // the stage padded out with nothing in it.
    previewMinHeight = 0;
  }

  // Share links: the query string carries only the controls the reader
  // actually changed (see `share.ts`), under the `_pg` scope below, so a link
  // seeds only the playground it was copied from. A query string is
  // page-global; a playground is not.
  const shareScope = $derived(shareKey ?? componentName);

  // Seeding happens on mount, never during init: the docs app is
  // adapter-static with `prerender = true`, so the prerendered HTML was built
  // with no query string at all. Reading `location.search` while rendering
  // would make the client's first render disagree with that HTML — a
  // hydration mismatch. Same reasoning as `DocsThemeToggle`.
  onMount(() => {
    const shared = decodeShareParams(controls, window.location.search, shareScope);
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
    const query = encodeShareParams(controls, values, shareScope);
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

  /**
   * Was die Demo *in* die Komponente stellt — aus dem Quelltext des Playgrounds
   * gehoben, nicht von Hand nachgeschrieben. Ohne `source` bleibt alles wie
   * bisher; ein Playground reicht ihn per `?raw`-Import herein.
   *
   * Referenziert das Markup Bezeichner, die der Schnipsel nicht deklariert,
   * wird es verworfen statt halb gedruckt: Ein `<ChatMessageList
   * messages={playgroundMessages} />` ohne `playgroundMessages` wäre Code, den
   * niemand ausführen kann. Der Hinweis geht an die Konsole, wo der Autor der
   * Seite ihn sieht — `playgrounds:lint` prüft es zusätzlich statisch.
   */
  const childMarkup = $derived.by(() => {
    if (!source) return null;
    const declared = [
      ...Object.keys(codeSetup?.consts ?? {}),
      ...Object.keys(codeSetup?.state ?? {}),
      ...(codeSetup?.bind ?? [])
    ];
    const { markup, unresolved } = extractChildMarkup(source, componentName, declared);
    if (unresolved.length > 0) {
      console.warn(
        `[PlaygroundConfigurator] ${componentName}: child markup dropped from the snippet — ` +
          `it refers to ${unresolved.join(', ')}, which the snippet does not declare. ` +
          `Add them to \`codeSetup.consts\` to show it.`
      );
      return null;
    }
    return markup;
  });

  const generatedCode = $derived.by(() => {
    if (!values) return '';
    if (codeGenerator) return codeGenerator(values);
    // Demo-Regler kommen aus den Controls selbst (`extra` ⇒ `demoOnly`), nicht
    // aus einer zweiten Liste im Playground — sonst driften die beiden.
    const setup = { ...codeSetup, demoOnly: [...(codeSetup?.demoOnly ?? []), ...demoOnlyKeys] };
    try {
      return generateDefaultCode(componentName, values, omittableDefaults, setup, childMarkup);
    } catch (error) {
      // A snippet that cannot be built is a bug in this playground's
      // `codeSetup` — but it must not take the whole docs page down with it.
      // The message lands where the author will see it: in the code panel.
      console.error(`[PlaygroundConfigurator] ${componentName}:`, error);
      return `// ${componentName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  // Code panel visibility, mirroring `CodeExample`: the page-wide "hide all code
  // examples" switch wins, a local toggle overrides it until that switch moves
  // again. The fallback differs though — a playground with no docs page around
  // it (the landing hero) starts **collapsed**: there the component is the
  // point, and an open code panel pushes the controls below the fold.
  const visibilityStore = getCodeVisibilityContext();
  let codeOverride = $state<boolean | null>(null);

  const codeExpanded = $derived.by(() => {
    if (codeOverride !== null) return codeOverride;
    if (defaultCodeExpanded !== undefined) return defaultCodeExpanded;
    if (visibilityStore) return visibilityStore.expanded;
    return false;
  });

  $effect(() => {
    if (visibilityStore) {
      // Touch `.mode` so flipping the global switch clears a stale local override.
      visibilityStore.mode;
      codeOverride = null;
    }
  });
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
        data-latched={previewMinHeight ? '' : undefined}
        {@attach latchPreviewHeight}
      >
        {@render children?.(values)}
      </div>
    </div>

    <!-- Controls. Skipped entirely when there are none: the auth family has no
         variant axes, only API paths and callbacks, and an empty panel below the
         stage reads as a playground whose knobs failed to load. Without it the
         configurator is still worth having — it carries the stage and the code
         panel, which is what those components were missing. -->
    {#if visibleControls.length > 0}
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
            <button type="button" class={slot('helpToggle')} onclick={resetAll}>
              {dt('resetAll', { count: modifiedCount })}
            </button>
          {/if}
          {#if hasAnyDescription}
            <!-- helpToggleActive is a state layer, not a slot: it has no
               slotClasses key, so `unstyled` drops it with the rest of the
               default styles — the pressed state is still carried by
               aria-pressed for consumers who restyle from scratch. -->
            <button
              type="button"
              class={[slot('helpToggle'), helpVisible && !unstyled && styles.helpToggleActive()]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={helpVisible}
              onclick={() => (helpVisible = !helpVisible)}
            >
              <span aria-hidden="true">?</span>
              {helpVisible ? dt('hintsOn') : dt('hints')}
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
                    variant="text"
                    size="sm"
                    value={selectDisplayValue(values[control.key]) ?? ''}
                    onValueChange={(value: string) =>
                      updateValue(control.key, resolveSegmentValue(items, value))}
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
                        <span class="text-text-tertiary text-3xs leading-none opacity-50"
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
                      value={selectDisplayValue(values[control.key])}
                      onValueChange={(value: string | null) =>
                        updateValue(control.key, resolveSelectValue(items, value))}
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
                    variant="dot"
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
                    value={numberFieldValue(control, values)}
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    oninput={(e) => onNumberInput(control, e.currentTarget.value)}
                    onblur={(e) => onNumberBlur(control, e.currentTarget)}
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
                <!-- Knob-strip slider uses `variant="rail"` (1px hairline +
                   8px dot) so its loudness matches the SegmentGroup `text`
                   and Toggle `dot` siblings on the same row. The default
                   pill thumb would crowd the strip and re-introduce the
                   "several incompatible UIs glued together" issue called
                   out in the v5 polish notes. -->
                <div class={slot('controlControl')}>
                  <Slider
                    id={control.key}
                    variant="rail"
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
            <button type="button" class={slot('helpToggle')} onclick={copyShareLink}>
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
    {/if}

    <!-- Collapsible Generated Code -->
    {#if generatedCode}
      <CodePanel
        code={generatedCode}
        language="svelte"
        {size}
        expanded={codeExpanded}
        onToggle={() => (codeOverride = codeOverride === null ? !codeExpanded : !codeOverride)}
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
