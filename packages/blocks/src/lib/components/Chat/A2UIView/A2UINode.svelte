<script lang="ts">
  import {
    Button,
    Card,
    Checkbox,
    Input,
    RadioGroup,
    RadioItem,
    Separator,
    Skeleton,
    Slider,
    Tab,
    TabItem,
    TabPanel,
    Textarea
  } from '$lib/primitives';
  import { resolveIcon } from '$lib/icons';
  import DangerCircleIconDefault from '$lib/icons/DangerCircleIcon.svelte';
  import { fromDateInputValue, toDateInputValue } from '$lib/utils/date';
  import type { Snippet } from 'svelte';
  import DatePicker from '../../DatePicker/DatePicker.svelte';
  import TimeInput from '../../TimeInput/TimeInput.svelte';
  import StreamingMarkdown from '../StreamingMarkdown/StreamingMarkdown.svelte';
  import { checkImageUrl, checkLinkUrl } from '../markdown/url-policy.js';
  import type { A2uiActionEvent } from './a2ui.types';
  import { A2UI_REGISTRY, A2UI_SVG_PATH_RE, ownEntry } from './a2ui-registry';
  import { dedupeOptions, splitDateTime } from './a2ui-node-common';
  import type { A2uiRenderContext, A2uiRenderNode } from './a2ui-render';
  import { bindingPointer, toInputString, toStringArray } from './a2ui-render';

  // Recursive dispatcher: one instance renders one node of the assembled A2UI
  // render tree, mapping the trusted catalog subset onto real Urbicon
  // primitives. Children come pre-expanded on `node.children` (templates, scope,
  // bounds all resolved upstream in `buildRenderTree`) and are rendered through
  // the `renderChild` snippet (a self-referencing snippet A2UIView threads down)
  // with stable keys, so a keystroke-triggered rebuild never remounts a focused
  // input. Recursing via a snippet — not a self-import — sidesteps the
  // circular-component-type resolution that self-imports trip in svelte-check.
  // The single `context` prop threads resolved classes, the data-binding
  // resolver, two-way write-back and the action sink (house pattern of
  // `md-context.ts`, not a Svelte context).
  let {
    node,
    context,
    renderChild
  }: {
    node: A2uiRenderNode;
    context: A2uiRenderContext;
    renderChild: Snippet<[A2uiRenderNode, A2uiRenderContext]>;
  } = $props();

  // Per-INSTANCE id namespace for the DOM ids this dispatcher mints (Tabs).
  // Must stay a top-level initializer (`props_id_invalid_placement` otherwise).
  const propsId = $props.id();

  const DangerIcon = resolveIcon('danger', DangerCircleIconDefault);

  // Local fallback state for inputs whose `value` is a literal (no data-model
  // path to write back into). Bound inputs bypass these entirely.
  let localText = $state<string | undefined>(undefined);
  let localBool = $state<boolean | undefined>(undefined);
  let localNum = $state<number | undefined>(undefined);
  let localList = $state<string[] | undefined>(undefined);

  const instance = $derived(node.instance);
  const nodeProps = $derived(instance?.props);
  const component = $derived(instance?.component ?? '');
  const spec = $derived(ownEntry(A2UI_REGISTRY, component));

  // A component is a visible fault when it is unknown/unsupported or is missing
  // a required prop (the processor already emitted the reportable issue).
  const missingRequired = $derived.by(() => {
    if (!spec || !instance) return false;
    for (const [key, propSpec] of Object.entries(spec.props)) {
      if (propSpec.required && !instance.props.has(key)) return true;
    }
    return false;
  });

  function raw(key: string): unknown {
    return nodeProps?.get(key);
  }
  function enumOr(key: string, fallback: string): string {
    const value = nodeProps?.get(key);
    return typeof value === 'string' ? value : fallback;
  }
  function numOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }
  function text(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
  }
  function resolved(key: string): unknown {
    return context.resolve(nodeProps?.get(key), node.scopePrefix).value;
  }

  const ariaLabel = $derived.by(() => {
    const a11y = nodeProps?.get('accessibility');
    if (a11y !== null && typeof a11y === 'object') {
      const label = (a11y as Record<string, unknown>).label;
      if (typeof label === 'string' && label.length > 0) return label;
    }
    return undefined;
  });

  const weightStyle = $derived(node.weight != null ? `flex-grow:${node.weight}` : undefined);

  // Child contexts: block containers reset the inline flag; a Button label sets
  // it (Text then renders as a plain inline span). `context` is a plain object,
  // not a $state proxy, so spreading it is safe.
  const blockCtx = $derived(context.inline ? { ...context, inline: false } : context);
  const inlineCtx = $derived({ ...context, inline: true });

  // ── Enum → complete class-string lookups (kept as literals for Tailwind's scanner) ──
  const JUSTIFY: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    spaceBetween: 'justify-between',
    spaceAround: 'justify-around',
    spaceEvenly: 'justify-evenly',
    stretch: 'justify-stretch'
  };
  const ALIGN: Record<string, string> = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch'
  };
  const DIRECTION: Record<string, string> = { vertical: 'flex-col', horizontal: 'flex-row' };
  const FIT: Record<string, string> = {
    contain: 'object-contain',
    cover: 'object-cover',
    fill: 'object-fill',
    none: 'object-none',
    scaleDown: 'object-scale-down'
  };
  const IMAGE_SIZE: Record<string, string> = {
    icon: 'h-6 w-6',
    avatar: 'h-10 w-10 rounded-full',
    smallFeature: 'h-24 w-auto',
    mediumFeature: 'h-40 w-auto',
    largeFeature: 'h-64 w-auto',
    header: 'h-48 w-full'
  };
  const HEADING_SIZE: Record<string, string> = {
    h1: 'text-2xl',
    h2: 'text-xl',
    h3: 'text-lg',
    h4: 'text-base',
    h5: 'text-sm'
  };
  const HEADING_TAG: Record<string, string> = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    h4: 'h4',
    h5: 'h5'
  };
  const INPUT_TYPE: Record<string, string> = {
    shortText: 'text',
    number: 'number',
    obscured: 'password'
  };
  const BUTTON_STYLE: Record<
    string,
    { variant: 'filled' | 'text'; intent: 'primary' | 'neutral' }
  > = {
    default: { variant: 'filled', intent: 'neutral' },
    primary: { variant: 'filled', intent: 'primary' },
    borderless: { variant: 'text', intent: 'neutral' }
  };

  // ── Icon resolution ──────────────────────────────────────────────────────
  const iconName = $derived.by<string | undefined>(() => {
    const value = raw('name');
    if (typeof value === 'string') return value;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const object = value as Record<string, unknown>;
      if (typeof object.svgPath === 'string') return undefined; // handled below
      if (typeof object.path === 'string') {
        const r = context.resolve(value, node.scopePrefix).value;
        return typeof r === 'string' ? r : undefined;
      }
    }
    return undefined;
  });
  const iconSvgPath = $derived.by<string | undefined>(() => {
    const value = raw('name');
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const svgPath = (value as Record<string, unknown>).svgPath;
      // Re-apply the grammar guard before inlining — defense in depth.
      if (typeof svgPath === 'string' && A2UI_SVG_PATH_RE.test(svgPath)) return svgPath;
    }
    return undefined;
  });
  // `iconName` can come from a `{path}` binding, i.e. an arbitrary string the
  // validator never inspected — so this lookup takes own entries only (#134).
  const IconComp = $derived(
    (iconName && ownEntry(context.icons, iconName)) || context.fallbackIcon
  );

  // ── Action ────────────────────────────────────────────────────────────────
  const actionEvent = $derived.by(() => {
    const action = raw('action');
    if (action === null || typeof action !== 'object') return undefined;
    const event = (action as Record<string, unknown>).event;
    if (event === null || typeof event !== 'object') return undefined;
    const name = (event as Record<string, unknown>).name;
    return typeof name === 'string' ? (event as Record<string, unknown>) : undefined;
  });

  // A local `openUrl` function-call action: the only client-side action the
  // subset supports. Every other functionCall is unsupported (the validator
  // already warns) and leaves the button inert.
  const openUrlArg = $derived.by<string | undefined>(() => {
    const action = raw('action');
    if (action === null || typeof action !== 'object') return undefined;
    const fc = (action as Record<string, unknown>).functionCall;
    if (fc === null || typeof fc !== 'object') return undefined;
    const call = (fc as Record<string, unknown>).call;
    if (call !== 'openUrl') return undefined;
    const args = (fc as Record<string, unknown>).args;
    const url =
      args !== null && typeof args === 'object' ? (args as Record<string, unknown>).url : undefined;
    const resolvedUrl = context.resolve(url, node.scopePrefix).value;
    return typeof resolvedUrl === 'string' ? resolvedUrl : undefined;
  });
  const buttonUsable = $derived(actionEvent !== undefined || openUrlArg !== undefined);

  function dispatchButton() {
    if (actionEvent !== undefined) {
      dispatchAction();
      return;
    }
    if (openUrlArg !== undefined) {
      // Gate the URL through the same policy as markdown links before opening.
      const check = checkLinkUrl(openUrlArg, context.urlPolicy);
      if (check.ok) window.open(check.href, '_blank', 'noopener,noreferrer');
    }
  }

  function dispatchAction() {
    const event = actionEvent;
    if (!event || !instance) return;
    // Build context on a plain object; prototype keys are skipped (never used as
    // a key, so no pollution) — the processor already flagged them.
    const resolvedContext: Record<string, unknown> = {};
    const rawContext = event.context;
    if (rawContext !== null && typeof rawContext === 'object' && !Array.isArray(rawContext)) {
      for (const key of Object.keys(rawContext as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        resolvedContext[key] = context.resolve(
          (rawContext as Record<string, unknown>)[key],
          node.scopePrefix
        ).value;
      }
    }
    // `sendDataModel` surfaces ship the whole model alongside the context, so a
    // context the agent under-specified still tells it what the user entered.
    const dataModel = context.actionDataModel?.();
    const payload: A2uiActionEvent = {
      ...(dataModel === undefined ? {} : { dataModel }),
      name: event.name as string,
      surfaceId: context.surfaceId,
      sourceComponentId: instance.id,
      timestamp: new Date().toISOString(),
      context: resolvedContext
    };
    context.onAction?.(payload);
  }

  // ── Two-way inputs ──────────────────────────────────────────────────────
  function valuePointer(): string | undefined {
    return bindingPointer(raw('value'), node.scopePrefix);
  }

  const textValue = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) return toInputString(resolved('value'));
    return localText ?? toInputString(raw('value'));
  });
  function onTextInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
    const pointer = valuePointer();
    if (pointer) context.write(pointer, target.value);
    else localText = target.value;
  }

  const boolValue = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) return Boolean(resolved('value'));
    return localBool ?? (typeof raw('value') === 'boolean' ? (raw('value') as boolean) : false);
  });
  function onBoolChange(checked: boolean) {
    const pointer = valuePointer();
    if (pointer) context.write(pointer, checked);
    else localBool = checked;
  }

  const sliderMin = $derived(numOr(raw('min'), 0));
  const sliderMax = $derived(numOr(raw('max'), 100));
  const sliderValue = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) {
      const value = resolved('value');
      return typeof value === 'number' && Number.isFinite(value) ? value : sliderMin;
    }
    return localNum ?? (typeof raw('value') === 'number' ? (raw('value') as number) : sliderMin);
  });
  function onSliderChange(value: number | [number, number]) {
    const scalar = Array.isArray(value) ? value[0] : value;
    const pointer = valuePointer();
    if (pointer) context.write(pointer, scalar);
    else localNum = scalar;
  }

  const choiceSelected = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) return toStringArray(resolved('value'));
    return localList ?? toStringArray(raw('value'));
  });
  // Dedupe by value (first wins): the validator warns on duplicates, but the
  // keyed `{#each}` below is on option.value — two equal keys throw Svelte's
  // `each_key_duplicate` (a hard crash that would break the "never throw"
  // contract for an untrusted payload). Shared with the Urbicon dispatcher.
  const choiceOptions = $derived(
    // `options` may itself be a { path } binding — that is how an agent shows a
    // list it fetched mid-conversation (free slots, search hits) without
    // rewriting the component. Resolve it first, then the per-option labels.
    dedupeOptions(resolved('options'), (label) =>
      text(context.resolve(label, node.scopePrefix).value)
    )
  );
  const choiceLabel = $derived(text(resolved('label')));
  function writeChoice(next: string[]) {
    const pointer = valuePointer();
    if (pointer) context.write(pointer, next);
    else localList = next;
  }
  function onRadioChange(value: string) {
    writeChoice([value]);
  }
  function onOptionToggle(value: string, checked: boolean) {
    const current = choiceSelected;
    if (checked) writeChoice(current.includes(value) ? current : [...current, value]);
    else writeChoice(current.filter((item) => item !== value));
  }

  const buttonStyle = $derived(BUTTON_STYLE[enumOr('variant', 'default')] ?? BUTTON_STYLE.default);

  // ── DateTimeInput ────────────────────────────────────────────────────────
  // The spec's value is one ISO 8601 STRING covering date, time, or both. The
  // renderer treats it as a timezone-NAIVE literal: a trailing offset/Z is
  // stripped for display and never re-attached on write — timezone semantics
  // belong to the agent, not to a UI renderer without timezone context.
  const dtMode = $derived.by<'date' | 'time' | 'datetime'>(() => {
    const enableDate = raw('enableDate') === true;
    const enableTime = raw('enableTime') === true;
    if (enableDate && enableTime) return 'datetime';
    if (enableTime) return 'time';
    // Includes the neither-flag payload: read tolerantly as a date input (the
    // validator already reported DATETIME_NO_MODE).
    return 'date';
  });

  const dtParts = $derived(splitDateTime(textValue));
  const dtMinParts = $derived(splitDateTime(text(resolved('min'))));
  const dtMaxParts = $derived(splitDateTime(text(resolved('max'))));
  const dtMinDate = $derived(
    dtMinParts.date ? (fromDateInputValue(dtMinParts.date) ?? undefined) : undefined
  );
  const dtMaxDate = $derived(
    dtMaxParts.date ? (fromDateInputValue(dtMaxParts.date) ?? undefined) : undefined
  );
  // Time bounds apply only when the bound itself is time-only: on a date-time
  // bound the time limit would depend on the picked date — deliberately out of
  // scope for this renderer (the date part is still enforced above).
  const dtMinTime = $derived(dtMinParts.time && !dtMinParts.date ? dtMinParts.time : undefined);
  const dtMaxTime = $derived(dtMaxParts.time && !dtMaxParts.date ? dtMaxParts.time : undefined);

  function writeDateTime(nextDate: string, nextTime: string): void {
    // Partial fills stay valid partial ISO: date-only / time-only / "".
    const next = nextDate && nextTime ? `${nextDate}T${nextTime}` : nextDate || nextTime || '';
    const pointer = valuePointer();
    if (pointer) context.write(pointer, next);
    else localText = next;
  }
  function onDtDateChange(picked: Date | undefined): void {
    writeDateTime(
      picked ? toDateInputValue(picked) : '',
      dtMode === 'datetime' ? dtParts.time : ''
    );
  }
  function onDtTimeChange(nextTime: string | null): void {
    writeDateTime(dtMode === 'datetime' ? dtParts.date : '', nextTime ?? '');
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  // Pair each `tabs` item's title with its resolved panel by consuming child
  // nodes by id (in order), NOT by raw index: a cyclic item.child is dropped
  // from node.children entirely (no placeholder, unlike a dangling ref), which
  // would shift every later panel up by one under a positional zip.
  //
  // The item `value` becomes the `tab-${value}` / `tabpanel-${value}` DOM ids,
  // so its namespace is `$props.id()` — unique per COMPONENT INSTANCE and
  // character-safe. Neither payload-derived source works: `node.id` repeats
  // under a `{ componentId, path }` template, `node.key` is built without the
  // parent key (`a2ui-render.ts`) so it only distinguishes SIBLINGS — two
  // parents referencing one Tabs id (a diamond, which the graph check passes
  // deliberately) collide — and both can carry whitespace, which would turn
  // `aria-controls` into an IDREF list and sever the tab↔panel relation.
  //
  // The index is the item's only identity: A2UI gives a tab no stable id, and
  // both `title` and `child` may repeat. So an update that PREPENDS a tab keeps
  // the selection on the index, not on the tab that was open.
  const tabsLabelKey = A2UI_REGISTRY.Tabs.props.tabs.labelKey ?? 'label';
  const tabItems = $derived.by(() => {
    const items = raw('tabs');
    if (!Array.isArray(items))
      return [] as Array<{ value: string; title: string; child: A2uiRenderNode | undefined }>;
    const pool = node.children.filter((child) => child.slot === 'tabs');
    const used = new Set<number>();
    return items.map((item, i) => {
      const entry =
        item !== null && typeof item === 'object' ? (item as Record<string, unknown>) : undefined;
      let matched: A2uiRenderNode | undefined;
      if (typeof entry?.child === 'string') {
        for (let j = 0; j < pool.length; j++) {
          if (!used.has(j) && pool[j].id === entry.child) {
            matched = pool[j];
            used.add(j);
            break;
          }
        }
      }
      return {
        value: `${propsId}-tab-${i}`,
        title: entry ? text(context.resolve(entry[tabsLabelKey], node.scopePrefix).value) : '',
        child: matched
      };
    });
  });

  // Which tab is open is client-local — A2UI has no selection binding for Tabs,
  // so nothing is written back to the data model. The selection is validated on
  // READ rather than clamped on write: an `updateComponents` may shorten the
  // list, and a stored id pointing at a tab that no longer exists would leave
  // the strip with no active tab and an empty panel area.
  let selectedTab = $state('');
  const activeTab = $derived(
    tabItems.some((item) => item.value === selectedTab) ? selectedTab : (tabItems[0]?.value ?? '')
  );
</script>

{#snippet faultChip(label: string)}
  <span class={context.classes.errorChip}>
    <DangerIcon size={14} class={context.classes.errorIcon} />
    {label}
  </span>
{/snippet}

{#if instance === null}
  {#if context.streaming}
    <span class={context.classes.pending}>
      <Skeleton variant="text" width="6rem" />
      <span class="sr-only">{context.labels.pending}</span>
    </span>
  {:else}
    {@render faultChip(`${context.labels.unsupported}: ${node.id}`)}
  {/if}
{:else if !spec || missingRequired}
  {@render faultChip(`${context.labels.unsupported}: ${component || node.id}`)}
{:else if component === 'Column'}
  <!-- A plain <div> is role=generic, which forbids aria-label (axe
       aria-prohibited-attr, ignored by SR); a labelled group needs role="group". -->
  <div
    class={[
      context.classes.column,
      JUSTIFY[enumOr('justify', 'start')],
      ALIGN[enumOr('align', 'stretch')]
    ]}
    style={weightStyle}
    role={ariaLabel ? 'group' : undefined}
    aria-label={ariaLabel}
  >
    {#each node.children as child (child.key)}
      {@render renderChild(child, blockCtx)}
    {/each}
  </div>
{:else if component === 'Row'}
  <div
    class={[
      context.classes.row,
      JUSTIFY[enumOr('justify', 'start')],
      ALIGN[enumOr('align', 'stretch')]
    ]}
    style={weightStyle}
    role={ariaLabel ? 'group' : undefined}
    aria-label={ariaLabel}
  >
    {#each node.children as child (child.key)}
      {@render renderChild(child, blockCtx)}
    {/each}
  </div>
{:else if component === 'List'}
  <ul
    class={[
      context.classes.list,
      DIRECTION[enumOr('direction', 'vertical')],
      ALIGN[enumOr('align', 'stretch')]
    ]}
    style={weightStyle}
    aria-label={ariaLabel}
  >
    {#each node.children as child (child.key)}
      <li class={context.classes.listItem}>
        {@render renderChild(child, blockCtx)}
      </li>
    {/each}
  </ul>
{:else if component === 'Card'}
  <Card style={weightStyle} role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel}>
    {#if node.children[0]}
      {@render renderChild(node.children[0], blockCtx)}
    {/if}
  </Card>
{:else if component === 'Tabs'}
  <!-- An empty strip would render role="tablist" with no role="tab" child
       (axe aria-required-children); the empty list is reported as TABS_EMPTY.
       Tab retargets aria-label onto its inner role="tablist" (#135), so the
       label names the tablist itself — no role="group" workaround needed. -->
  {#if tabItems.length > 0}
    <Tab
      value={activeTab}
      onValueChange={(next) => (selectedTab = next)}
      style={weightStyle}
      aria-label={ariaLabel}
    >
      {#snippet tabs()}
        {#each tabItems as item (item.value)}
          <TabItem value={item.value}>{item.title}</TabItem>
        {/each}
      {/snippet}
      {#snippet panels()}
        {#each tabItems as item (item.value)}
          <TabPanel value={item.value}>
            {#if item.child}
              {@render renderChild(item.child, blockCtx)}
            {/if}
          </TabPanel>
        {/each}
      {/snippet}
    </Tab>
  {/if}
{:else if component === 'Divider'}
  <Separator
    orientation={enumOr('axis', 'horizontal') === 'vertical' ? 'vertical' : 'horizontal'}
  />
{:else if component === 'Text'}
  {@const value = text(resolved('text'))}
  {@const variant = enumOr('variant', 'body')}
  {#if context.inline}
    <span class={context.classes.inlineText} style={weightStyle}>{value}</span>
  {:else if variant === 'caption'}
    <span class={context.classes.caption} style={weightStyle}>{value}</span>
  {:else if variant === 'body'}
    <StreamingMarkdown
      content={value}
      size="sm"
      urlPolicy={context.urlPolicy}
      streaming={false}
      style={weightStyle}
    />
  {:else}
    <svelte:element
      this={HEADING_TAG[variant] ?? 'h3'}
      class={[context.classes.heading, HEADING_SIZE[variant]]}
      style={weightStyle}
    >
      {value}
    </svelte:element>
  {/if}
{:else if component === 'Image'}
  {@const url = text(resolved('url'))}
  {@const description = text(resolved('description'))}
  {@const check = checkImageUrl(url, context.urlPolicy)}
  {#if check.ok}
    <img
      src={check.href}
      alt={description}
      class={[
        context.classes.image,
        FIT[enumOr('fit', 'fill')],
        IMAGE_SIZE[enumOr('variant', 'mediumFeature')]
      ]}
      style={weightStyle}
    />
  {:else}
    <span class={context.classes.blockedChip} style={weightStyle}>
      {context.labels.blockedImage}{description ? `: ${description}` : ''}
    </span>
  {/if}
{:else if component === 'Icon'}
  {#if iconSvgPath}
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      class={context.classes.svgIcon}
      style={weightStyle}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
    >
      <path d={iconSvgPath} />
    </svg>
  {:else}
    <span
      class={context.classes.icon}
      style={weightStyle}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : 'true'}
    >
      <IconComp size={20} />
    </span>
  {/if}
{:else if component === 'Button'}
  <Button
    variant={buttonStyle.variant}
    intent={buttonStyle.intent}
    style={weightStyle}
    aria-label={ariaLabel}
    disabled={!buttonUsable}
    title={buttonUsable ? undefined : 'This action is not supported'}
    onclick={buttonUsable ? dispatchButton : undefined}
  >
    {#if node.children[0]}
      {@render renderChild(node.children[0], inlineCtx)}
    {/if}
  </Button>
  {#if !buttonUsable}
    <!-- A disabled button drops out of the tab order, so `title` is invisible to
         screen readers; an adjacent sr-only note is reachable in browse mode. -->
    <span class="sr-only">This action is not supported</span>
  {/if}
{:else if component === 'TextField'}
  {@const label = text(resolved('label'))}
  {@const variant = enumOr('variant', 'shortText')}
  {#if variant === 'longText'}
    <Textarea
      {label}
      value={textValue}
      oninput={onTextInput}
      style={weightStyle}
      aria-label={ariaLabel}
    />
  {:else}
    <Input
      {label}
      type={INPUT_TYPE[variant] ?? 'text'}
      value={textValue}
      oninput={onTextInput}
      style={weightStyle}
      aria-label={ariaLabel}
    />
  {/if}
{:else if component === 'CheckBox'}
  <Checkbox
    label={text(resolved('label'))}
    checked={boolValue}
    onCheckedChange={onBoolChange}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{:else if component === 'ChoicePicker'}
  {#if enumOr('variant', 'mutuallyExclusive') === 'multipleSelection'}
    <div
      class={context.classes.choiceGroup}
      style={weightStyle}
      role="group"
      aria-label={ariaLabel || choiceLabel || undefined}
    >
      {#if choiceLabel}
        <span class={context.classes.choiceLabel}>{choiceLabel}</span>
      {/if}
      {#each choiceOptions as option (option.value)}
        <Checkbox
          label={option.label}
          checked={choiceSelected.includes(option.value)}
          onCheckedChange={(checked) => onOptionToggle(option.value, checked)}
        />
      {/each}
    </div>
  {:else}
    <RadioGroup
      label={ariaLabel || choiceLabel || undefined}
      value={choiceSelected[0]}
      onValueChange={onRadioChange}
      style={weightStyle}
    >
      {#each choiceOptions as option (option.value)}
        <RadioItem value={option.value} label={option.label} />
      {/each}
    </RadioGroup>
  {/if}
{:else if component === 'Slider'}
  <!-- showValue is forced on: a generated surface has no other place to state
       the current number, and the agent cannot ask for it (not a catalog prop). -->
  <Slider
    label={text(resolved('label')) || undefined}
    value={sliderValue}
    min={sliderMin}
    max={sliderMax}
    showValue
    onValueChange={onSliderChange}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{:else if component === 'DateTimeInput'}
  {@const label = text(resolved('label'))}
  {#if dtMode === 'datetime'}
    <!-- The visible label sits on the date field; the group name gives the
         time segments their context (TimeInput's segments are self-labelled). -->
    <div
      class={[context.classes.row, 'flex-wrap']}
      style={weightStyle}
      role="group"
      aria-label={ariaLabel || label || undefined}
    >
      <DatePicker
        label={label || undefined}
        value={dtParts.date || null}
        onValueChange={onDtDateChange}
        minDate={dtMinDate}
        maxDate={dtMaxDate}
      />
      <TimeInput
        value={dtParts.time || null}
        onValueChange={onDtTimeChange}
        withSeconds={dtParts.time.length > 5}
        min={dtMinTime}
        max={dtMaxTime}
      />
    </div>
  {:else if dtMode === 'time'}
    <!-- TimeInput has no style/aria passthrough — weight + accessibility label
         live on a wrapper (role=group only when it actually carries a name). -->
    <div style={weightStyle} role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel}>
      <TimeInput
        label={label || undefined}
        value={dtParts.time || null}
        onValueChange={onDtTimeChange}
        withSeconds={dtParts.time.length > 5}
        min={dtMinTime}
        max={dtMaxTime}
      />
    </div>
  {:else}
    <!-- The accessibility label becomes the field label when no visible label
         is given: DatePicker spreads an aria-label onto its role-less root div
         (AT-ignored, axe aria-prohibited-attr), so the name must travel
         through `label` to reach the actual input. -->
    <DatePicker
      label={label || ariaLabel || undefined}
      value={dtParts.date || null}
      onValueChange={onDtDateChange}
      minDate={dtMinDate}
      maxDate={dtMaxDate}
      style={weightStyle}
    />
  {/if}
{/if}
