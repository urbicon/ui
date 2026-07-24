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
    Textarea
  } from '$lib/primitives';
  import { resolveIcon } from '$lib/icons';
  import DangerCircleIconDefault from '$lib/icons/DangerCircleIcon.svelte';
  import type { Snippet } from 'svelte';
  import StreamingMarkdown from '../StreamingMarkdown/StreamingMarkdown.svelte';
  import { checkImageUrl } from '../markdown/url-policy.js';
  import type { A2uiActionEvent } from './a2ui.types';
  import { A2UI_REGISTRY, A2UI_SVG_PATH_RE } from './a2ui-registry';
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
  const spec = $derived(component ? A2UI_REGISTRY[component] : undefined);

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
  const IconComp = $derived((iconName && context.icons[iconName]) || context.fallbackIcon);

  // ── Action ────────────────────────────────────────────────────────────────
  const actionEvent = $derived.by(() => {
    const action = raw('action');
    if (action === null || typeof action !== 'object') return undefined;
    const event = (action as Record<string, unknown>).event;
    if (event === null || typeof event !== 'object') return undefined;
    const name = (event as Record<string, unknown>).name;
    return typeof name === 'string' ? (event as Record<string, unknown>) : undefined;
  });

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
    const payload: A2uiActionEvent = {
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
  const choiceOptions = $derived.by(() => {
    const options = raw('options');
    if (!Array.isArray(options)) return [] as Array<{ value: string; label: string }>;
    return options
      .filter(
        (option): option is Record<string, unknown> =>
          option !== null && typeof option === 'object' && typeof option.value === 'string'
      )
      .map((option) => ({
        value: option.value as string,
        label: text(context.resolve(option.label, node.scopePrefix).value)
      }));
  });
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
  <div
    class={[
      context.classes.column,
      JUSTIFY[enumOr('justify', 'start')],
      ALIGN[enumOr('align', 'stretch')]
    ]}
    style={weightStyle}
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
  <Card style={weightStyle} aria-label={ariaLabel}>
    {#if node.children[0]}
      {@render renderChild(node.children[0], blockCtx)}
    {/if}
  </Card>
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
  {@const usable = actionEvent !== undefined}
  <Button
    variant={buttonStyle.variant}
    intent={buttonStyle.intent}
    style={weightStyle}
    aria-label={ariaLabel}
    disabled={!usable}
    title={usable ? undefined : 'Unsupported action'}
    onclick={usable ? dispatchAction : undefined}
  >
    {#if node.children[0]}
      {@render renderChild(node.children[0], inlineCtx)}
    {/if}
  </Button>
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
  <Slider
    label={text(resolved('label')) || undefined}
    value={sliderValue}
    min={sliderMin}
    max={sliderMax}
    onValueChange={onSliderChange}
    style={weightStyle}
    aria-label={ariaLabel}
  />
{/if}
