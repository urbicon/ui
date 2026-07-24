<script lang="ts">
  import { Alert } from '$lib/primitives';
  import { untrack } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { type IconComponent, resolveIcon } from '$lib/icons';
  import PlusIconDefault from '$lib/icons/PlusIcon.svelte';
  import ArrowLeftIconDefault from '$lib/icons/ArrowLeftIcon.svelte';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import TrashIconDefault from '$lib/icons/TrashIcon.svelte';
  import EditIconDefault from '$lib/icons/EditIcon.svelte';
  import DangerCircleIconDefault from '$lib/icons/DangerCircleIcon.svelte';
  import HomeIconDefault from '$lib/icons/HomeIcon.svelte';
  import InfoCircleIconDefault from '$lib/icons/InfoCircleIcon.svelte';
  import MailIconDefault from '$lib/icons/MailIcon.svelte';
  import MenuIconDefault from '$lib/icons/MenuIcon.svelte';
  import SearchIconDefault from '$lib/icons/SearchIcon.svelte';
  import SendIconDefault from '$lib/icons/SendIcon.svelte';
  import SettingsIconDefault from '$lib/icons/SettingsIcon.svelte';
  import StarIconDefault from '$lib/icons/StarIcon.svelte';
  import WarningTriangleIconDefault from '$lib/icons/WarningTriangleIcon.svelte';
  import CircleHelpIconDefault from '$lib/icons/CircleHelpIcon.svelte';
  import A2UINode from './A2UINode.svelte';
  import type { A2uiValidationIssue } from './a2ui.types';
  import { deleteAtPointer, resolveDynamic, setAtPointer } from './a2ui-data';
  import {
    type A2uiProcessor,
    collectGraphIssues,
    createA2uiProcessor,
    normalizeA2uiPayload
  } from './a2ui-validate';
  import { type A2uiRenderContext, type A2uiRenderNode, buildRenderTree } from './a2ui-render';
  import { a2uiViewVariants } from './a2ui-view.variants';
  import type { A2UIViewProps } from './index';

  let {
    payload,
    streaming: streamingProp = false,
    urlPolicy,
    onAction,
    onValidationError,
    errorTitle = 'Invalid UI payload',
    unsupportedLabel = 'Unsupported component',
    blockedImageLabel = 'Image blocked',
    pendingLabel = 'Loading UI',
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: A2UIViewProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // A2UI icon-enum name → resolved Urbicon icon. Resolved ONCE via direct
  // imports (tree-shakeable — never getIcon()); an IconProvider override still
  // wins, the direct import is the fallback. Built here (not per node) and
  // threaded through the render context.
  const icons: Readonly<Record<string, IconComponent>> = {
    add: resolveIcon('plus', PlusIconDefault),
    arrowBack: resolveIcon('arrowLeft', ArrowLeftIconDefault),
    check: resolveIcon('check', CheckIconDefault),
    close: resolveIcon('close', CloseIconDefault),
    delete: resolveIcon('trash', TrashIconDefault),
    edit: resolveIcon('edit', EditIconDefault),
    error: resolveIcon('danger', DangerCircleIconDefault),
    home: resolveIcon('home', HomeIconDefault),
    info: resolveIcon('info', InfoCircleIconDefault),
    mail: resolveIcon('mail', MailIconDefault),
    menu: resolveIcon('menu', MenuIconDefault),
    search: resolveIcon('search', SearchIconDefault),
    send: resolveIcon('send', SendIconDefault),
    settings: resolveIcon('settings', SettingsIconDefault),
    star: resolveIcon('star', StarIconDefault),
    warning: resolveIcon('warning', WarningTriangleIconDefault)
  };
  const fallbackIcon = resolveIcon('circleHelp', CircleHelpIconDefault);

  // ── Processor (plain, non-reactive) + version counter ────────────────────
  // The processor mutates plain Maps in place (the streaming-markdown engine
  // pattern). A $state version counter is the single reactive primitive; the
  // render tree derives from it, so reading it is a real subscription (unlike a
  // `void messages` proxy read). `processor`/`consumed` are plain lets: their
  // reassignment must NOT itself trigger reactivity — the bump does.
  let processor: A2uiProcessor = createA2uiProcessor();
  let consumed: unknown[] = [];
  let normalizeIssue = $state<A2uiValidationIssue | undefined>(undefined);
  let version = $state(0);

  function bump(): void {
    version++;
  }

  // Incremental consumption: if the first `consumed.length` envelopes are
  // referentially identical to the new payload, apply only the appended ones
  // (two-way edits in the data model survive). Otherwise rebuild from scratch.
  // Reads `payload` (tracked) to re-run on every immutable payload change; the
  // mutation is untracked so the `version++`/`normalizeIssue` writes never make
  // this effect depend on the state it drives (avoids an update-depth loop).
  $effect(() => {
    const { envelopes, issue } = normalizeA2uiPayload(payload);
    untrack(() => {
      const prefixMatches =
        envelopes.length >= consumed.length && consumed.every((env, i) => env === envelopes[i]);
      if (!prefixMatches) {
        processor = createA2uiProcessor();
        consumed = [];
      }
      for (let i = consumed.length; i < envelopes.length; i++) {
        processor.apply(envelopes[i], i);
      }
      consumed = envelopes.slice();
      normalizeIssue = issue;
      version++;
    });
  });

  function isContainer(value: unknown): boolean {
    return value !== null && typeof value === 'object';
  }

  // Two-way write-back: mutate the surface data model in place, then bump so the
  // render tree re-derives with the new value (bound labels update live).
  function writeBinding(surfaceId: string, pointer: string, value: unknown): void {
    const surface = processor.surfaces.get(surfaceId);
    if (!surface) return;
    if (!isContainer(surface.dataModel)) {
      const firstSegment = pointer.replace(/^\//, '').split('/')[0];
      surface.dataModel = /^(?:0|[1-9]\d*|-)$/.test(firstSegment) ? [] : {};
    }
    setAtPointer(surface.dataModel, pointer, value);
    bump();
  }
  function removeBinding(surfaceId: string, pointer: string): void {
    const surface = processor.surfaces.get(surfaceId);
    if (!surface) return;
    deleteAtPointer(surface.dataModel, pointer);
    bump();
  }

  // ── Resolved slot classes ────────────────────────────────────────────────
  const styles = a2uiViewVariants();
  const resolvedSlots = $derived(
    resolveSlotClasses(blocksConfig, 'A2UIView', preset, {}, slotClassesProp)
  );
  const classes = $derived.by(() => {
    const out: Record<string, string> = {};
    for (const [name, slotFn] of Object.entries(styles)) {
      const override = resolvedSlots?.[name];
      out[name] = unstyled ? (override ?? '') : slotFn({ class: override });
    }
    return out;
  });
  const rootClass = $derived(
    unstyled
      ? [resolvedSlots?.root, className].filter(Boolean).join(' ')
      : styles.root({ class: [resolvedSlots?.root, className] })
  );

  // ── Render tree + issue collection (re-derives on every version bump) ────
  interface SurfaceView {
    surfaceId: string;
    root: A2uiRenderNode | null;
    context: A2uiRenderContext;
  }

  const view = $derived.by(() => {
    version; // subscription to processing + edits
    const isStreaming = streamingProp;
    const currentClasses = classes;
    const surfaces: SurfaceView[] = [];
    const summaryIssues: A2uiValidationIssue[] = [];
    const allIssues: A2uiValidationIssue[] = [];

    if (normalizeIssue) {
      summaryIssues.push(normalizeIssue);
      allIssues.push(normalizeIssue);
    }
    for (const globalIssue of processor.globalIssues) {
      allIssues.push(globalIssue);
      if (globalIssue.severity === 'error') summaryIssues.push(globalIssue);
    }

    for (const surface of processor.surfaces.values()) {
      for (const surfaceIssue of surface.issues) allIssues.push(surfaceIssue);
      for (const graphIssue of collectGraphIssues(surface, { streaming: isStreaming })) {
        allIssues.push(graphIssue);
      }
      const root = buildRenderTree(surface);
      const context: A2uiRenderContext = {
        classes: currentClasses,
        urlPolicy,
        streaming: isStreaming,
        inline: false,
        surfaceId: surface.surfaceId,
        onAction,
        resolve: (value, scope) => resolveDynamic(value, surface.dataModel, scope),
        write: (pointer, value) => writeBinding(surface.surfaceId, pointer, value),
        remove: (pointer) => removeBinding(surface.surfaceId, pointer),
        icons,
        fallbackIcon,
        labels: {
          unsupported: unsupportedLabel,
          blockedImage: blockedImageLabel,
          pending: pendingLabel
        }
      };
      surfaces.push({ surfaceId: surface.surfaceId, root, context });
    }
    return { surfaces, summaryIssues, allIssues };
  });

  // Fire onValidationError only when the issue list actually changes. Seeded
  // with the empty signature so an issue-free first render stays silent.
  let lastIssueSig = '[]';
  $effect(() => {
    const issues = view.allIssues;
    const signature = JSON.stringify(
      issues.map((issue) => [
        issue.severity,
        issue.code,
        issue.surfaceId ?? '',
        issue.path ?? '',
        issue.message
      ])
    );
    if (signature !== lastIssueSig) {
      lastIssueSig = signature;
      onValidationError?.(issues);
    }
  });
</script>

<!--
  The render tree recurses through this self-referencing snippet rather than a
  self-import inside A2UINode: a snippet that renders A2UINode and passes ITSELF
  down as `renderChild` gives clean recursion without the circular component-type
  resolution that self-imports trip in svelte-check.
-->
{#snippet renderNode(node: A2uiRenderNode, context: A2uiRenderContext)}
  <A2UINode {node} {context} renderChild={renderNode} />
{/snippet}

<div class={rootClass} {...restProps}>
  {#if view.summaryIssues.length}
    <Alert intent="danger" title={errorTitle}>
      <ul class={classes.errorList}>
        {#each view.summaryIssues as issue, index (`${issue.code}#${index}`)}
          <li>{issue.message}</li>
        {/each}
      </ul>
    </Alert>
  {/if}

  {#each view.surfaces as surface (surface.surfaceId)}
    <div class={classes.surface}>
      {#if surface.root}
        {@render renderNode(surface.root, surface.context)}
      {:else if !streamingProp}
        <span class={classes.errorChip}>{errorTitle}</span>
      {/if}
    </div>
  {/each}
</div>
