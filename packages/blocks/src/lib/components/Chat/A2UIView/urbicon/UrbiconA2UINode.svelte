<script lang="ts">
  import DangerCircleIconDefault from '#lib/icons/DangerCircleIcon.svelte';
  import { resolveIcon } from '#lib/icons/index.js';
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
  } from '#lib/primitives/index.js';
  import { fromDateInputValue, toDateInputValue } from '#lib/utils/date.js';
  import DatePicker from '../../../DatePicker/DatePicker.svelte';
  import EmptyState from '../../../EmptyState/EmptyState.svelte';
  import TimeInput from '../../../TimeInput/TimeInput.svelte';
  import { checkImageUrl, checkLinkUrl } from '../../markdown/url-policy.js';
  import StreamingMarkdown from '../../StreamingMarkdown/StreamingMarkdown.svelte';
  import type { A2uiActionEvent } from '../a2ui.types';
  import { A2UI_CALL_KEY, bindingPath, checksPass, coerceBoolean } from '../a2ui-data';
  import { coerceText, dedupeOptions, readAccessibility, splitDateTime } from '../a2ui-node-common';
  import {
    A2UI_ACCESSIBILITY_PROP,
    A2UI_CHECKS_PROP,
    A2UI_SVG_PATH_RE,
    A2UI_VALUE_PROP,
    ownEntry,
    rendersAsComponent
  } from '../a2ui-registry';
  import type { A2uiNodeProps, A2uiRenderNode } from '../a2ui-render';
  import { toInputString, toStringArray, writePointer } from '../a2ui-render';
  import { a2uiUrbiconVariants } from './a2ui-urbicon.variants';

  // Recursive dispatcher for the Urbicon A2UI catalog — the sibling of A2UINode,
  // mapping the richer Urbicon vocabulary (real intents/variants/sizes, Section,
  // RichText, Accordion) onto real Urbicon components. Same contract as A2UINode:
  // children come pre-expanded on `node.children`; recursion runs through the
  // `renderChild` snippet A2UIView threads down; the render-time plumbing is
  // deliberately duplicated (not shared) so this stays a self-contained renderer.
  let { node, context, renderChild }: A2uiNodeProps = $props();

  // Per-INSTANCE id namespace for the `@accessibility` references. Must stay a
  // top-level initializer (`props_id_invalid_placement` otherwise).
  const propsId = $props.id();

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
  // A component is a visible fault when it resolved to no catalog, is
  // unknown/unsupported or is missing a required prop (the processor already
  // emitted the reportable issue).
  const renders = $derived(instance ? rendersAsComponent(instance) : false);

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
  // A style prop the agent left out stays `undefined`, so the component resolves
  // it as it does for any call site naming none: the provider's theme `props`
  // first, then its own default. A fallback written here would read as an
  // instance value and outrank the theme. Same narrowing as `u`.
  function styleOpt<T extends string>(key: string): T | undefined {
    const value = nodeProps?.get(key);
    return typeof value === 'string' ? (value as T) : undefined;
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

  // `@accessibility`: `label` names the element that takes focus (the group, for
  // a component of several controls) or the component's role where nothing
  // does; `description` describes the same element, or each segment of a
  // TimeInput, after the field's own error; `live` goes on the component's root.
  // `hidden` is applied by the view around the whole component, label and
  // control alike.
  const accessibility = $derived(
    readAccessibility(
      nodeProps?.get(A2UI_ACCESSIBILITY_PROP),
      (value) => context.resolve(value, node.scopePrefix).value
    )
  );
  const ariaLabel = $derived(accessibility.label);
  const aria = $derived({
    'aria-description': accessibility.description,
    'aria-live': accessibility.live
  });
  // Where a primitive keeps an `aria-label` or `aria-description` off its
  // focused element, or lets its own label or its error's `aria-describedby`
  // outrank one, it still forwards an `aria-labelledby` there that wins, and an
  // `aria-describedby` it reads after its own: those controls take both by
  // reference to the `referenced()` elements.
  const labelRef = $derived(ariaLabel ? `${propsId}-a11y-label` : undefined);
  const descriptionRef = $derived(
    accessibility.description ? `${propsId}-a11y-description` : undefined
  );
  const byReference = $derived({
    'aria-labelledby': labelRef,
    'aria-describedby': descriptionRef,
    'aria-live': accessibility.live
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
      if (object.svgPath !== undefined) return undefined;
      if (bindingPath(value) !== undefined) {
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
      // A literal or a bound svgPath; the grammar guard runs on what it
      // resolves to, which for a binding nothing has inspected before.
      const svgPath = context.resolve(
        (value as Record<string, unknown>).svgPath,
        node.scopePrefix
      ).value;
      if (typeof svgPath === 'string' && A2UI_SVG_PATH_RE.test(svgPath)) return svgPath;
    }
    return undefined;
  });
  // Both names can come from a `{ "@path" }` binding, i.e. an arbitrary string
  // the validator never inspected — so these take own entries only (#134).
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
    if ((fc as Record<string, unknown>)[A2UI_CALL_KEY] !== 'openUrl') return undefined;
    const args = (fc as Record<string, unknown>).args;
    const url =
      args !== null && typeof args === 'object' ? (args as Record<string, unknown>).url : undefined;
    const resolvedUrl = context.resolve(url, node.scopePrefix).value;
    return typeof resolvedUrl === 'string' ? resolvedUrl : undefined;
  });
  const buttonUsable = $derived(actionEvent !== undefined || openUrlArg !== undefined);
  // A `disabled` that resolves with an issue — a binding refused in this
  // template item's scope — holds its failsafe, as one the validator refused
  // does; a value that resolves counts as a boolean.
  const disabledGate = $derived(context.resolve(raw('disabled'), node.scopePrefix));
  // `disabled` reads `@checks` (`readsChecks`): a failing rule holds it at its failsafe.
  const buttonDisabled = $derived(
    !buttonUsable ||
      disabledGate.issue !== undefined ||
      coerceBoolean(disabledGate.value) ||
      !checksPass(raw(A2UI_CHECKS_PROP), (value) => context.resolve(value, node.scopePrefix).value)
  );

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
    const userMessage = context.resolve(event.userMessage, node.scopePrefix).value;
    const payload: A2uiActionEvent = {
      ...(dataModel === undefined ? {} : { dataModel }),
      ...(typeof userMessage === 'string' ? { userMessage } : {}),
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
    return writePointer(instance, node.scopePrefix);
  }
  // A field the data model cannot take a write from is locked: an edit it
  // showed would be neither stored nor sent.
  const writeLocked = $derived(
    valuePointer() !== undefined && context.refusesWrite(raw(A2UI_VALUE_PROP), node.scopePrefix)
  );

  const textValue = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) return toInputString(resolved(A2UI_VALUE_PROP));
    return localText ?? toInputString(raw(A2UI_VALUE_PROP));
  });
  function onTextInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
    const pointer = valuePointer();
    if (pointer) context.write(pointer, target.value);
    else localText = target.value;
  }

  const boolValue = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) return coerceBoolean(resolved(A2UI_VALUE_PROP));
    return (
      localBool ??
      (typeof raw(A2UI_VALUE_PROP) === 'boolean' ? (raw(A2UI_VALUE_PROP) as boolean) : false)
    );
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
      const value = resolved(A2UI_VALUE_PROP);
      return typeof value === 'number' && Number.isFinite(value) ? value : sliderMin;
    }
    return (
      localNum ??
      (typeof raw(A2UI_VALUE_PROP) === 'number' ? (raw(A2UI_VALUE_PROP) as number) : sliderMin)
    );
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
      const v = resolved(A2UI_VALUE_PROP);
      return typeof v === 'string' ? v : undefined;
    }
    return (
      localStr ??
      (typeof raw(A2UI_VALUE_PROP) === 'string' ? (raw(A2UI_VALUE_PROP) as string) : undefined)
    );
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
    if (pointer) return toStringArray(resolved(A2UI_VALUE_PROP));
    return localList ?? toStringArray(raw(A2UI_VALUE_PROP));
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
    // `options` may itself be a { "@path" } binding — that is how an agent shows a
    // list it fetched mid-conversation (free slots, search hits) without
    // rewriting the component. Resolve it first, then the per-option labels.
    dedupeOptions(resolved('options'), (label) =>
      coerceText(context.resolve(label, node.scopePrefix).value)
    )
  );

  // ── DateTime (separate DatePicker / TimeInput) ─────────────────────────────
  const dtValue = $derived.by(() => {
    const pointer = valuePointer();
    if (pointer) return toInputString(resolved(A2UI_VALUE_PROP));
    return localText ?? toInputString(raw(A2UI_VALUE_PROP));
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
  // The model has one "no time" value, so a half-typed time (`null`) writes `""`.
  // TimeInput ignores no time that arrives while focus is inside a half-typed
  // field, so this echo keeps the digits typed so far; the cost is that an
  // agent's `""` landing at that moment does not clear it either.
  function onTimeChange(next: string | null | undefined): void {
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
  // The date/time line describes its field ahead of the `@accessibility`
  // description, the order Input reads its own error in.
  const errorId = $derived(fieldError ? `${propsId}-error` : undefined);
  const fieldDescribedBy = $derived(
    [errorId, descriptionRef].filter(Boolean).join(' ') || undefined
  );

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

<!-- What `byReference` points at: in the DOM for the reference, out of sight and
     out of the accessibility tree. No whitespace beside it: in a `pre-wrap`
     block container a whitespace text node is an empty line. -->
{#snippet referenced()}
  {#if labelRef}<span id={labelRef} hidden>{ariaLabel}</span>{/if}{#if descriptionRef}<span
      id={descriptionRef}
      hidden>{accessibility.description}</span
    >{/if}
{/snippet}

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
{:else if !renders}
  {@render faultChip(`${context.labels.unsupported}: ${component || node.id}`)}
{:else if component === 'Column'}
  <!-- biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is an expression, which the rule reads as no role; the attribute comes only with the role that supports it -->
  <div
    class={[
      context.classes.column,
      JUSTIFY[enumOr('justify', 'start')],
      ALIGN[enumOr('align', 'stretch')]
    ]}
    style={weightStyle}
    role={ariaLabel ? 'group' : undefined}
    aria-label={ariaLabel}
    {...aria}
  >
    {#each node.children as child (child.key)}
      {@render renderChild(child, blockCtx)}
    {/each}
  </div>
{:else if component === 'Row'}
  <!-- biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is an expression, which the rule reads as no role; the attribute comes only with the role that supports it -->
  <div
    class={[
      context.classes.row,
      JUSTIFY[enumOr('justify', 'start')],
      ALIGN[enumOr('align', 'center')]
    ]}
    style={weightStyle}
    role={ariaLabel ? 'group' : undefined}
    aria-label={ariaLabel}
    {...aria}
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
    {...aria}
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
  <!-- A div card is role=generic, which forbids a name; a labelled one is a group. -->
  <Card
    unstyled={context.unstyled}
    variant={styleOpt('variant')}
    role={ariaLabel ? 'group' : undefined}
    aria-label={ariaLabel}
    {...aria}
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
    {...aria}
  />
{:else if component === 'Section'}
  {@const sectionChild = childByKey('child')}
  <section class={styles.section()} style={weightStyle} aria-label={ariaLabel} {...aria}>
    <div class={styles.sectionHeader()}>
      <h3 class={styles.sectionTitle()}>{resolvedText('title')}</h3>
      {#if resolvedText('description')}
        <p class={styles.sectionDescription()}>{resolvedText('description')}</p>
      {/if}
    </div>
    {#if sectionChild}
      {@render renderChild(sectionChild, blockCtx)}
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
    {...aria}
  />
{:else if component === 'Text'}
  {@const value = resolvedText('text')}
  {@const variant = enumOr('variant', 'body')}
  {#if context.inline}
    <span class={context.classes.inlineText} style={weightStyle} {...aria}>{value}</span>
  {:else if variant === 'caption'}
    <span class={context.classes.caption} style={weightStyle} {...aria}>{value}</span>
  {:else if variant === 'body'}
    <p class={styles.body()} style={weightStyle} {...aria}>{value}</p>
  {:else}
    <svelte:element
      this={HEADING_TAG[variant] ?? 'h3'}
      class={[context.classes.heading, HEADING_SIZE[variant]]}
      style={weightStyle}
      {...aria}
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
    {...aria}
  />
{:else if component === 'Button'}
  <Button
    unstyled={context.unstyled}
    intent={styleOpt('intent')}
    variant={styleOpt('variant')}
    size={styleOpt('size')}
    style={weightStyle}
    aria-label={ariaLabel}
    {...aria}
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
    disabled={writeLocked}
    placeholder={resolvedText('placeholder') || undefined}
    error={fieldError || undefined}
    oninput={onTextInput}
    style={weightStyle}
    {...byReference}
  />{@render referenced()}
{:else if component === 'Textarea'}
  <Textarea
    unstyled={context.unstyled}
    label={resolvedText('label')}
    value={textValue}
    disabled={writeLocked}
    placeholder={resolvedText('placeholder') || undefined}
    error={fieldError || undefined}
    rows={typeof raw('rows') === 'number' ? (raw('rows') as number) : undefined}
    oninput={onTextInput}
    style={weightStyle}
    {...byReference}
  />{@render referenced()}
{:else if component === 'Checkbox'}
  <Checkbox
    unstyled={context.unstyled}
    label={resolvedText('label')}
    checked={boolValue}
    disabled={writeLocked}
    onCheckedChange={onBoolChange}
    style={weightStyle}
    aria-label={ariaLabel}
    {...aria}
  />
{:else if component === 'RadioGroup'}
  <RadioGroup
    unstyled={context.unstyled}
    label={resolvedText('label') || undefined}
    value={radioValue}
    disabled={writeLocked}
    onValueChange={onRadioChange}
    orientation={enumOr('orientation', 'vertical') === 'horizontal' ? 'horizontal' : 'vertical'}
    style={weightStyle}
    {...byReference}
  >
    {#each choiceOptions as option (option.value)}
      <RadioItem unstyled={context.unstyled} value={option.value} label={option.label} />
    {/each}
  </RadioGroup>{@render referenced()}
{:else if component === 'Select'}
  {#if selectMultiple}
    <Select
      unstyled={context.unstyled}
      multiple
      label={resolvedText('label') || undefined}
      placeholder={resolvedText('placeholder') || undefined}
      options={choiceOptions}
      value={selectValues}
      disabled={writeLocked}
      onValueChange={onSelectMultiple}
      style={weightStyle}
      {...byReference}
    />{@render referenced()}
  {:else}
    <Select
      unstyled={context.unstyled}
      label={resolvedText('label') || undefined}
      placeholder={resolvedText('placeholder') || undefined}
      options={choiceOptions}
      value={selectValues[0] ?? null}
      disabled={writeLocked}
      onValueChange={onSelectSingle}
      style={weightStyle}
      {...byReference}
    />{@render referenced()}
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
    disabled={writeLocked}
    onValueChange={onSliderChange}
    style={weightStyle}
    {...byReference}
  />{@render referenced()}
{:else if component === 'Toggle'}
  <Toggle
    unstyled={context.unstyled}
    label={resolvedText('label')}
    checked={boolValue}
    disabled={writeLocked}
    onCheckedChange={onBoolChange}
    style={weightStyle}
    {...byReference}
  />{@render referenced()}
{:else if component === 'DatePicker'}
  {@const label = resolvedText('label')}
  <div class={styles.field()} style={weightStyle} aria-live={accessibility.live}>
    <DatePicker
      unstyled={context.unstyled}
      label={label || undefined}
      value={dtParts.date || null}
      disabled={writeLocked}
      onValueChange={onDateChange}
      minDate={dtMinDate}
      maxDate={dtMaxDate}
      aria-labelledby={labelRef}
      aria-describedby={fieldDescribedBy}
    />{@render referenced()}{#if fieldError}<span id={errorId} class={styles.fieldError()}
        >{fieldError}</span
      >{/if}
  </div>
{:else if component === 'TimeInput'}
  {@const label = resolvedText('label')}
  <!-- TimeInput's group takes the name, and each of its segments the
       description. -->
  <div class={styles.field()} style={weightStyle} aria-live={accessibility.live}>
    <TimeInput
      unstyled={context.unstyled}
      label={label || undefined}
      value={dtParts.time || undefined}
      disabled={writeLocked}
      onValueChange={onTimeChange}
      withSeconds={dtParts.time.length > 5}
      min={dtMinParts.time && !dtMinParts.date ? dtMinParts.time : undefined}
      max={dtMaxParts.time && !dtMaxParts.date ? dtMaxParts.time : undefined}
      aria-labelledby={labelRef}
      aria-describedby={fieldDescribedBy}
    />{@render referenced()}{#if fieldError}<span id={errorId} class={styles.fieldError()}
        >{fieldError}</span
      >{/if}
  </div>
{:else if component === 'Badge'}
  {@const variant = styleOpt<'filled' | 'soft' | 'outlined' | 'dot'>('variant')}
  {#if variant === 'dot'}
    <Badge
      unstyled={context.unstyled}
      variant="dot"
      intent={styleOpt('intent')}
      aria-label={ariaLabel || resolvedText('text') || undefined}
      {...aria}
    />
  {:else}
    <Badge
      unstyled={context.unstyled}
      {variant}
      intent={styleOpt('intent')}
      aria-label={ariaLabel}
      {...aria}
    >
      {resolvedText('text')}
    </Badge>
  {/if}
{:else if component === 'Alert'}
  {@const childNode = childByKey('child')}
  <Alert
    unstyled={context.unstyled}
    title={resolvedText('title')}
    intent={styleOpt('intent')}
    variant={styleOpt('variant')}
    style={weightStyle}
    aria-label={ariaLabel}
    {...aria}
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
    intent={styleOpt('intent')}
    label={resolvedText('label') || undefined}
    style={weightStyle}
    aria-label={ariaLabel}
    {...aria}
  />
{:else if component === 'Stepper'}
  <Stepper
    unstyled={context.unstyled}
    activeStep={stepperCurrent}
    orientation={enumOr('orientation', 'horizontal') === 'vertical' ? 'vertical' : 'horizontal'}
    variant={styleOpt('variant')}
    style={weightStyle}
    aria-label={ariaLabel}
    {...aria}
  >
    {#each stepperSteps as step, i (`${step}#${i}`)}
      <StepperStep unstyled={context.unstyled} label={step} />
    {/each}
  </Stepper>
{:else if component === 'Accordion'}
  <!-- A role-less root forbids a name; a labelled Accordion is a group. -->
  <Accordion
    unstyled={context.unstyled}
    type={accordionMultiple ? 'multiple' : 'single'}
    variant={styleOpt('variant')}
    style={weightStyle}
    role={ariaLabel ? 'group' : undefined}
    aria-label={ariaLabel}
    {...aria}
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
  <!-- The root of a static Avatar has no role, so a labelled one is an image:
       its picture or initials inside become presentational. -->
  <Avatar
    unstyled={context.unstyled}
    src={avatarSrc}
    name={resolvedText('name') || undefined}
    variant={styleOpt('variant')}
    size={styleOpt('size')}
    role={ariaLabel ? 'img' : undefined}
    aria-label={ariaLabel}
    {...aria}
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
      {...aria}
      aria-hidden={ariaLabel ? undefined : 'true'}
    >
      <path d={iconSvgPath} />
    </svg>
  {:else}
    <!-- biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is an expression, which the rule reads as no role; the attribute comes only with the role that supports it -->
    <span
      class={context.classes.icon}
      style={weightStyle}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      {...aria}
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
      alt={ariaLabel ?? description}
      class={[
        context.classes.image,
        FIT[enumOr('fit', 'cover')],
        IMAGE_SIZE[enumOr('variant', 'mediumFeature')]
      ]}
      style={weightStyle}
      {...aria}
    />
  {:else}
    <span class={context.classes.blockedChip} style={weightStyle} {...aria}>
      {context.labels.blockedImage}{description ? `: ${description}` : ''}
    </span>
  {/if}
{/if}
