<script lang="ts">
  import {
    Accordion,
    AccordionItem,
    Alert,
    Avatar,
    Badge,
    Button,
    Card,
    Checkbox,
    Input,
    Progress,
    RadioGroup,
    RadioItem,
    Select,
    Separator,
    Skeleton,
    Slider,
    Stepper,
    StepperStep,
    Textarea,
    Toggle
  } from '$lib/primitives';
  import { resolveIcon } from '$lib/icons';
  import DangerCircleIconDefault from '$lib/icons/DangerCircleIcon.svelte';
  import { fromDateInputValue, toDateInputValue } from '$lib/utils/date';
  import DatePicker from '../../../DatePicker/DatePicker.svelte';
  import EmptyState from '../../../EmptyState/EmptyState.svelte';
  import TimeInput from '../../../TimeInput/TimeInput.svelte';
  import StreamingMarkdown from '../../StreamingMarkdown/StreamingMarkdown.svelte';
  import { checkImageUrl, checkLinkUrl } from '../../markdown/url-policy.js';
  import type { A2uiActionEvent } from '../a2ui.types';
  import { coerceText, dedupeOptions, splitDateTime } from '../a2ui-node-common';
  import type { A2uiNodeProps, A2uiRenderNode } from '../a2ui-render';
  import { bindingPointer, toInputString, toStringArray } from '../a2ui-render';
  import { A2UI_SVG_PATH_RE, ownEntry } from '../a2ui-registry';
  import { URBICON_A2UI_REGISTRY } from './a2ui-urbicon-registry';
  import { a2uiUrbiconVariants } from './a2ui-urbicon.variants';

  // Recursive dispatcher for the Urbicon A2UI catalog — the sibling of A2UINode,
  // mapping the richer Urbicon vocabulary (real intents/variants/sizes, Section,
  // RichText, Accordion) onto real Urbicon components. Same contract as A2UINode:
  // children come pre-expanded on `node.children`; recursion runs through the
  // `renderChild` snippet A2UIView threads down; the render-time plumbing is
  // deliberately duplicated (not shared) so this stays a self-contained renderer.
  let { node, context, renderChild }: A2uiNodeProps = $props();

  const styles = a2uiUrbiconVariants();
  const DangerIcon = resolveIcon('danger', DangerCircleIconDefault);

  // Narrow a validated enum string to the exact component union it feeds. Safe:
  // every value is registry-validated to be a subset of the real component axis
  // (the drift test enforces `values ⊆ axis`), so this cast can never widen past
  // what the component accepts.
  function u<T extends string>(value: string): T {
    return value as T;
  }

  // Local fallback state for inputs whose `value`/`current` is a literal (no
  // data-model path to write back into). Bound inputs bypass these entirely.
  let localText = $state<string | undefined>(undefined);
  let localBool = $state<boolean | undefined>(undefined);
  let localNum = $state<number | undefined>(undefined);
  let localStr = $state<string | undefined>(undefined);
  let localList = $state<string[] | undefined>(undefined);

  const instance = $derived(node.instance);
  const nodeProps = $derived(instance?.props);
  const component = $derived(instance?.component ?? '');
  const spec = $derived(ownEntry(URBICON_A2UI_REGISTRY, component));

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
  /** The resolved child node that came from a named childId slot (Card header/footer/child, …). */
  function childByKey(slot: string): A2uiRenderNode | undefined {
    return node.children.find((child) => child.slot === slot);
  }
  function enumOr(key: string, fallback: string): string {
    const value = nodeProps?.get(key);
    return typeof value === 'string' ? value : fallback;
  }
  function numOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }
  function resolved(key: string): unknown {
    return context.resolve(nodeProps?.get(key), node.scopePrefix).value;
  }
  function resolvedText(key: string): string {
    return coerceText(resolved(key));
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

  const blockCtx = $derived(context.inline ? { ...context, inline: false } : context);
  const inlineCtx = $derived({ ...context, inline: true });

  // ── Enum → complete class-string lookups (literals for Tailwind's scanner) ──
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
  const HEADING_TAG: Record<string, string> = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5' };

  // ── Icon resolution (Icon.name and EmptyState.icon) ────────────────────────
  function iconNameFrom(key: string): string | undefined {
    const value = raw(key);
    if (typeof value === 'string') return value;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const object = value as Record<string, unknown>;
      if (typeof object.svgPath === 'string') return undefined;
      if (typeof object.path === 'string') {
        const r = context.resolve(value, node.scopePrefix).value;
        return typeof r === 'string' ? r : undefined;
      }
    }
    return undefined;
  }
  const iconName = $derived(iconNameFrom('name'));
  const iconSvgPath = $derived.by<string | undefined>(() => {
    const value = raw('name');
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const svgPath = (value as Record<string, unknown>).svgPath;
      if (typeof svgPath === 'string' && A2UI_SVG_PATH_RE.test(svgPath)) return svgPath;
    }
    return undefined;
  });
  // Both names can come from a `{path}` binding, i.e. an arbitrary string the
  // validator never inspected — so these take own entries only (#134).
  const IconComp = $derived(
    (iconName && ownEntry(context.icons, iconName)) || context.fallbackIcon
  );
  const emptyStateIcon = $derived.by(() => {
    const name = iconNameFrom('icon');
    return name ? ownEntry(context.icons, name) : undefined;
  });

  // ── Action (Button) ─────────────────────────────────────────────────────────
  const actionEvent = $derived.by(() => {
    const action = raw('action');
    if (action === null || typeof action !== 'object') return undefined;
    const event = (action as Record<string, unknown>).event;
    if (event === null || typeof event !== 'object') return undefined;
    const name = (event as Record<string, unknown>).name;
    return typeof name === 'string' ? (event as Record<string, unknown>) : undefined;
  });
  const openUrlArg = $derived.by<string | undefined>(() => {
    const action = raw('action');
    if (action === null || typeof action !== 'object') return undefined;
    const fc = (action as Record<string, unknown>).functionCall;
    if (fc === null || typeof fc !== 'object') return undefined;
    if ((fc as Record<string, unknown>).call !== 'openUrl') return undefined;
    const args = (fc as Record<string, unknown>).args;
    const url =
      args !== null && typeof args === 'object' ? (args as Record<string, unknown>).url : undefined;
    const resolvedUrl = context.resolve(url, node.scopePrefix).value;
    return typeof resolvedUrl === 'string' ? resolvedUrl : undefined;
  });
  const buttonUsable = $derived(actionEvent !== undefined || openUrlArg !== undefined);
  const buttonDisabled = $derived(!buttonUsable || Boolean(resolved('disabled')));

  function dispatchButton() {
    if (actionEvent !== undefined) {
      dispatchAction();
      return;
    }
    if (openUrlArg !== undefined) {
      const check = checkLinkUrl(openUrlArg, context.urlPolicy);
      if (check.ok) window.open(check.href, '_blank', 'noopener,noreferrer');
    }
  }
  function dispatchAction() {
    const event = actionEvent;
    if (!event || !instance) return;
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

  // ── Two-way inputs ──────────────────────────────────────────────────────────
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

  // RadioGroup: value is a single string in the data model.
  const radioValue = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) {
      const v = resolved('value');
      return typeof v === 'string' ? v : undefined;
    }
    return localStr ?? (typeof raw('value') === 'string' ? (raw('value') as string) : undefined);
  });
  function onRadioChange(value: string) {
    const pointer = valuePointer();
    if (pointer) context.write(pointer, value);
    else localStr = value;
  }

  // Select: value is ALWAYS a string array in the data model. Single-select
  // adapts to Select's single-value shape (value = first, write a one-element
  // array); multi-select maps straight through.
  const selectValues = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) return toStringArray(resolved('value'));
    return localList ?? toStringArray(raw('value'));
  });
  const selectMultiple = $derived(raw('multiple') === true);
  function writeSelect(next: string[]) {
    const pointer = valuePointer();
    if (pointer) context.write(pointer, next);
    else localList = next;
  }
  // Select is generic over string | number | boolean; our option values are
  // always strings, so coerce on write-back to keep the model a string array.
  function onSelectSingle(value: string | number | boolean | null) {
    // Only null clears; an empty-string option value is a real (if degenerate)
    // selection and must round-trip as [''], not [] (which would deselect it).
    writeSelect(value === null ? [] : [String(value)]);
  }
  function onSelectMultiple(value: Array<string | number | boolean>) {
    writeSelect(value.map((item) => String(item)));
  }

  const choiceOptions = $derived(
    // `options` may itself be a { path } binding — that is how an agent shows a
    // list it fetched mid-conversation (free slots, search hits) without
    // rewriting the component. Resolve it first, then the per-option labels.
    dedupeOptions(resolved('options'), (label) =>
      coerceText(context.resolve(label, node.scopePrefix).value)
    )
  );

  // ── DateTime (separate DatePicker / TimeInput) ─────────────────────────────
  const dtValue = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) return toInputString(resolved('value'));
    return localText ?? toInputString(raw('value'));
  });
  const dtParts = $derived(splitDateTime(dtValue));
  const dtMinParts = $derived(splitDateTime(resolvedText('min')));
  const dtMaxParts = $derived(splitDateTime(resolvedText('max')));
  const dtMinDate = $derived(
    dtMinParts.date ? (fromDateInputValue(dtMinParts.date) ?? undefined) : undefined
  );
  const dtMaxDate = $derived(
    dtMaxParts.date ? (fromDateInputValue(dtMaxParts.date) ?? undefined) : undefined
  );
  function writeDateTime(next: string): void {
    const pointer = valuePointer();
    if (pointer) context.write(pointer, next);
    else localText = next;
  }
  function onDateChange(picked: Date | undefined): void {
    writeDateTime(picked ? toDateInputValue(picked) : '');
  }
  function onTimeChange(next: string | null): void {
    writeDateTime(next ?? '');
  }

  // ── Stepper / Accordion display data ───────────────────────────────────────
  const stepperSteps = $derived.by(() => {
    const steps = raw('steps');
    if (!Array.isArray(steps)) return [] as string[];
    return steps.filter((s): s is string => typeof s === 'string');
  });
  const stepperCurrent = $derived.by(() => {
    const v = resolved('current');
    return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
  });

  // Accordion: pair each labeledChildren item's label with the resolved child
  // node (aligned by index — childRefs pushes one child per item). Each item
  // gets a stable, unique AccordionItem value so open-state and the keyed each
  // never collide, even on duplicate/dangling child ids.
  const accordionItems = $derived.by(() => {
    const items = raw('items');
    if (!Array.isArray(items))
      return [] as Array<{ value: string; label: string; child: A2uiRenderNode | undefined }>;
    // Pair each item's label with its resolved panel by consuming child nodes by
    // id (in order), NOT by raw index: a cyclic item.child is dropped from
    // node.children entirely (no placeholder, unlike a dangling ref), which would
    // shift every later panel up by one under a positional zip. Consume-by-id
    // keeps labels aligned and leaves a cyclic/missing panel empty.
    const pool = node.children.filter((child) => child.slot === 'items');
    const used = new Set<number>();
    return items.map((item, i) => {
      const childId =
        item !== null && typeof item === 'object' ? (item as { child?: unknown }).child : undefined;
      let matched: A2uiRenderNode | undefined;
      if (typeof childId === 'string') {
        for (let j = 0; j < pool.length; j++) {
          if (!used.has(j) && pool[j].id === childId) {
            matched = pool[j];
            used.add(j);
            break;
          }
        }
      }
      return {
        value: `item-${i}`,
        label:
          item !== null && typeof item === 'object'
            ? coerceText(
                context.resolve((item as { label?: unknown }).label, node.scopePrefix).value
              )
            : '',
        child: matched
      };
    });
  });
  const accordionMultiple = $derived(raw('multiple') === true);

  // ── Field-error (Input/Textarea use the native prop; date/time show a line) ──
  const fieldError = $derived(resolvedText('error'));

  // ── Image ──────────────────────────────────────────────────────────────────
  const imageCheck = $derived(checkImageUrl(resolvedText('url'), context.urlPolicy));
  // Avatar src is gated through the same policy; a blocked URL falls back to initials.
  const avatarSrc = $derived.by(() => {
    const src = resolvedText('src');
    if (!src) return undefined;
    const check = checkImageUrl(src, context.urlPolicy);
    return check.ok ? check.href : undefined;
  });
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
      <Skeleton unstyled={context.unstyled} variant="text" width="6rem" />
      <span class="sr-only">{context.labels.pending}</span>
    </span>
  {:else}
    {@render faultChip(`${context.labels.unsupported}: ${node.id}`)}
  {/if}
{:else if !spec || missingRequired}
  {@render faultChip(`${context.labels.unsupported}: ${component || node.id}`)}
{:else if component === 'Column'}
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
      ALIGN[enumOr('align', 'center')]
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
    class={[context.classes.list, DIRECTION[enumOr('direction', 'vertical')]]}
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
  {@const headerNode = childByKey('header')}
  {@const footerNode = childByKey('footer')}
  {@const bodyNode = childByKey('child')}
  {#snippet cardHeader()}
    {#if headerNode}{@render renderChild(headerNode, blockCtx)}{/if}
  {/snippet}
  {#snippet cardFooter()}
    {#if footerNode}{@render renderChild(footerNode, blockCtx)}{/if}
  {/snippet}
  <Card
    unstyled={context.unstyled}
    variant={u(enumOr('variant', 'quiet'))}
    aria-label={ariaLabel}
    header={headerNode ? cardHeader : undefined}
    footer={footerNode ? cardFooter : undefined}
  >
    {#if bodyNode}{@render renderChild(bodyNode, blockCtx)}{/if}
  </Card>
{:else if component === 'Separator'}
  <Separator
    unstyled={context.unstyled}
    orientation={enumOr('orientation', 'horizontal') === 'vertical' ? 'vertical' : 'horizontal'}
    style={weightStyle}
  />
{:else if component === 'Section'}
  <section class={styles.section()} style={weightStyle} aria-label={ariaLabel}>
    <div class={styles.sectionHeader()}>
      <h3 class={styles.sectionTitle()}>{resolvedText('title')}</h3>
      {#if resolvedText('description')}
        <p class={styles.sectionDescription()}>{resolvedText('description')}</p>
      {/if}
    </div>
    {#if childByKey('child')}
      {@render renderChild(childByKey('child')!, blockCtx)}
    {/if}
  </section>
{:else if component === 'EmptyState'}
  {@const ctaNode = childByKey('cta')}
  {#snippet emptyCta()}
    {#if ctaNode}{@render renderChild(ctaNode, blockCtx)}{/if}
  {/snippet}
  <EmptyState
    unstyled={context.unstyled}
    title={resolvedText('title')}
    description={resolvedText('description') || undefined}
    icon={emptyStateIcon}
    cta={ctaNode ? emptyCta : undefined}
  />
{:else if component === 'Text'}
  {@const value = resolvedText('text')}
  {@const variant = enumOr('variant', 'body')}
  {#if context.inline}
    <span class={context.classes.inlineText} style={weightStyle}>{value}</span>
  {:else if variant === 'caption'}
    <span class={context.classes.caption} style={weightStyle}>{value}</span>
  {:else if variant === 'body'}
    <p class={styles.body()} style={weightStyle}>{value}</p>
  {:else}
    <svelte:element
      this={HEADING_TAG[variant] ?? 'h3'}
      class={[context.classes.heading, HEADING_SIZE[variant]]}
      style={weightStyle}
    >
      {value}
    </svelte:element>
  {/if}
{:else if component === 'RichText'}
  <StreamingMarkdown
    content={resolvedText('content')}
    size="sm"
    urlPolicy={context.urlPolicy}
    streaming={false}
    style={weightStyle}
  />
{:else if component === 'Button'}
  <Button
    unstyled={context.unstyled}
    intent={u(enumOr('intent', 'neutral'))}
    variant={u(enumOr('variant', 'filled'))}
    size={u(enumOr('size', 'md'))}
    style={weightStyle}
    aria-label={ariaLabel}
    disabled={buttonDisabled}
    title={buttonUsable ? undefined : 'This action is not supported'}
    onclick={buttonUsable ? dispatchButton : undefined}
  >
    {#if node.children[0]}
      {@render renderChild(node.children[0], inlineCtx)}
    {/if}
  </Button>
  {#if !buttonUsable}
    <span class="sr-only">This action is not supported</span>
  {/if}
{:else if component === 'Input'}
  <Input
    unstyled={context.unstyled}
    label={resolvedText('label')}
    type={u(enumOr('inputType', 'text'))}
    value={textValue}
    placeholder={resolvedText('placeholder') || undefined}
    error={fieldError || undefined}
    oninput={onTextInput}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{:else if component === 'Textarea'}
  <Textarea
    unstyled={context.unstyled}
    label={resolvedText('label')}
    value={textValue}
    placeholder={resolvedText('placeholder') || undefined}
    error={fieldError || undefined}
    rows={typeof raw('rows') === 'number' ? (raw('rows') as number) : undefined}
    oninput={onTextInput}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{:else if component === 'Checkbox'}
  <Checkbox
    unstyled={context.unstyled}
    label={resolvedText('label')}
    checked={boolValue}
    onCheckedChange={onBoolChange}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{:else if component === 'RadioGroup'}
  <RadioGroup
    unstyled={context.unstyled}
    label={resolvedText('label') || ariaLabel || undefined}
    value={radioValue}
    onValueChange={onRadioChange}
    orientation={enumOr('orientation', 'vertical') === 'horizontal' ? 'horizontal' : 'vertical'}
    style={weightStyle}
  >
    {#each choiceOptions as option (option.value)}
      <RadioItem unstyled={context.unstyled} value={option.value} label={option.label} />
    {/each}
  </RadioGroup>
{:else if component === 'Select'}
  {#if selectMultiple}
    <Select
      unstyled={context.unstyled}
      multiple
      label={resolvedText('label') || undefined}
      placeholder={resolvedText('placeholder') || undefined}
      options={choiceOptions}
      value={selectValues}
      onValueChange={onSelectMultiple}
      style={weightStyle}
      aria-label={ariaLabel}
    />
  {:else}
    <Select
      unstyled={context.unstyled}
      label={resolvedText('label') || undefined}
      placeholder={resolvedText('placeholder') || undefined}
      options={choiceOptions}
      value={selectValues[0] ?? null}
      onValueChange={onSelectSingle}
      style={weightStyle}
      aria-label={ariaLabel}
    />
  {/if}
{:else if component === 'Slider'}
  <!-- showValue is forced on: a generated surface has no other place to state
       the current number, and the agent cannot ask for it (not a catalog prop). -->
  <Slider
    unstyled={context.unstyled}
    label={resolvedText('label') || undefined}
    value={sliderValue}
    min={sliderMin}
    max={sliderMax}
    step={typeof raw('step') === 'number' ? (raw('step') as number) : undefined}
    showValue
    onValueChange={onSliderChange}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{:else if component === 'Toggle'}
  <Toggle
    unstyled={context.unstyled}
    label={resolvedText('label')}
    checked={boolValue}
    onCheckedChange={onBoolChange}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{:else if component === 'DatePicker'}
  {@const label = resolvedText('label')}
  <div class={styles.field()} style={weightStyle}>
    <DatePicker
      unstyled={context.unstyled}
      label={label || ariaLabel || undefined}
      value={dtParts.date || null}
      onValueChange={onDateChange}
      minDate={dtMinDate}
      maxDate={dtMaxDate}
    />
    {#if fieldError}
      <span class={styles.fieldError()}>{fieldError}</span>
    {/if}
  </div>
{:else if component === 'TimeInput'}
  {@const label = resolvedText('label')}
  <div
    class={styles.field()}
    style={weightStyle}
    role={ariaLabel ? 'group' : undefined}
    aria-label={ariaLabel}
  >
    <TimeInput
      unstyled={context.unstyled}
      label={label || undefined}
      value={dtParts.time || null}
      onValueChange={onTimeChange}
      withSeconds={dtParts.time.length > 5}
      min={dtMinParts.time && !dtMinParts.date ? dtMinParts.time : undefined}
      max={dtMaxParts.time && !dtMaxParts.date ? dtMaxParts.time : undefined}
    />
    {#if fieldError}
      <span class={styles.fieldError()}>{fieldError}</span>
    {/if}
  </div>
{:else if component === 'Badge'}
  {@const variant = enumOr('variant', 'filled')}
  {#if variant === 'dot'}
    <Badge
      unstyled={context.unstyled}
      variant="dot"
      intent={u(enumOr('intent', 'primary'))}
      aria-label={ariaLabel || resolvedText('text') || undefined}
    />
  {:else}
    <Badge
      unstyled={context.unstyled}
      variant={variant as 'filled' | 'soft' | 'outlined'}
      intent={u(enumOr('intent', 'primary'))}
    >
      {resolvedText('text')}
    </Badge>
  {/if}
{:else if component === 'Alert'}
  {@const childNode = childByKey('child')}
  <Alert
    unstyled={context.unstyled}
    title={resolvedText('title')}
    intent={u(enumOr('intent', 'primary'))}
    variant={u(enumOr('variant', 'soft'))}
    style={weightStyle}
  >
    {#if resolvedText('description')}
      <span>{resolvedText('description')}</span>
    {/if}
    {#if childNode}
      {@render renderChild(childNode, blockCtx)}
    {/if}
  </Alert>
{:else if component === 'Progress'}
  {@const indeterminate = raw('indeterminate') === true}
  {@const progressValue = resolved('value')}
  <Progress
    unstyled={context.unstyled}
    value={indeterminate || typeof progressValue !== 'number' || !Number.isFinite(progressValue)
      ? undefined
      : progressValue}
    max={numOr(raw('max'), 100)}
    intent={u(enumOr('intent', 'primary'))}
    label={resolvedText('label') || undefined}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{:else if component === 'Stepper'}
  <Stepper
    unstyled={context.unstyled}
    activeStep={stepperCurrent}
    orientation={enumOr('orientation', 'horizontal') === 'vertical' ? 'vertical' : 'horizontal'}
    variant={u(enumOr('variant', 'default'))}
    style={weightStyle}
    aria-label={ariaLabel}
  >
    {#each stepperSteps as step, i (`${step}#${i}`)}
      <StepperStep unstyled={context.unstyled} label={step} />
    {/each}
  </Stepper>
{:else if component === 'Accordion'}
  <Accordion
    unstyled={context.unstyled}
    type={accordionMultiple ? 'multiple' : 'single'}
    variant={u(enumOr('variant', 'default'))}
    style={weightStyle}
    aria-label={ariaLabel}
  >
    {#each accordionItems as item (item.value)}
      <AccordionItem unstyled={context.unstyled} value={item.value} title={item.label}>
        {#if item.child}
          {@render renderChild(item.child, blockCtx)}
        {/if}
      </AccordionItem>
    {/each}
  </Accordion>
{:else if component === 'Avatar'}
  <Avatar
    unstyled={context.unstyled}
    src={avatarSrc}
    name={resolvedText('name') || undefined}
    alt={resolvedText('name') || ariaLabel || undefined}
    variant={u(enumOr('variant', 'circle'))}
    size={u(enumOr('size', 'md'))}
  />
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
{:else if component === 'Image'}
  {@const description = resolvedText('description')}
  {#if imageCheck.ok}
    <img
      src={imageCheck.href}
      alt={description}
      class={[
        context.classes.image,
        FIT[enumOr('fit', 'cover')],
        IMAGE_SIZE[enumOr('variant', 'mediumFeature')]
      ]}
      style={weightStyle}
    />
  {:else}
    <span class={context.classes.blockedChip} style={weightStyle}>
      {context.labels.blockedImage}{description ? `: ${description}` : ''}
    </span>
  {/if}
{/if}
