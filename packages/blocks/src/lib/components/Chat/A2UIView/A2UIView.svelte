<script lang="ts">
  import { Alert } from '$lib/primitives';
  import { untrack } from 'svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { resolveClassChain } from '$lib/utils/variants';
  import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';
  import { basicA2uiCatalog } from './a2ui-basic-catalog';
  import type { A2uiCatalog } from './a2ui-catalog';
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
    catalogs: catalogsProp,
    dataSchema: dataSchemaProp,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: A2UIViewProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Effective catalogs: the Basic catalog is always available and FIRST (the
  // default/fallback), consumer catalogs follow. Resolved ONCE at init —
  // `createIcons()` reads the IconProvider context, so it must run during
  // component init and cannot be reactive. Keep `catalogs` referentially stable.
  // `untrack` captures the initial prop value without a reactive subscription
  // (the init-only capture is deliberate — silences `state_referenced_locally`).
  const catalogs: readonly A2uiCatalog[] = [
    basicA2uiCatalog,
    ...(untrack(() => catalogsProp) ?? [])
  ];
  const catalogById = new Map<string, A2uiCatalog>();
  const iconsByCatalog = new Map<string, ReturnType<A2uiCatalog['createIcons']>>();
  for (const catalog of catalogs) {
    if (catalogById.has(catalog.catalogId)) continue;
    catalogById.set(catalog.catalogId, catalog);
    for (const alias of catalog.catalogIdAliases ?? []) {
      if (!catalogById.has(alias)) catalogById.set(alias, catalog);
    }
    iconsByCatalog.set(catalog.catalogId, catalog.createIcons());
  }
  const defaultCatalog = catalogs[0];
  const defaultIcons = iconsByCatalog.get(defaultCatalog.catalogId) ?? defaultCatalog.createIcons();
  // Init-fixed like the catalogs (validation config, not reactive UI state).
  const dataSchema = untrack(() => dataSchemaProp);

  // ── Processor (plain, non-reactive) + version counter ────────────────────
  // The processor mutates plain Maps in place (the streaming-markdown engine
  // pattern). A $state version counter is the single reactive primitive; the
  // render tree derives from it, so reading it is a real subscription (unlike a
  // `void messages` proxy read). `processor`/`consumed` are plain lets: their
  // reassignment must NOT itself trigger reactivity — the bump does.
  let processor: A2uiProcessor = createA2uiProcessor({ catalogs, dataSchema });
  let consumed: unknown[] = [];
  let normalizeIssue = $state<A2uiValidationIssue | undefined>(undefined);
  let version = $state(0);
  // Bumped ONLY on a full rebuild (payload replaced, not appended). It keys the
  // surface `{#each}`, so a rebuild remounts the node tree and A2UINode's local
  // input fallbacks reset — otherwise a typed-then-replaced literal input keeps
  // the stale text (a rebuild is documented to discard local edits). An
  // incremental append leaves it unchanged, so focus and edits survive.
  let generation = $state(0);

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
        processor = createA2uiProcessor({ catalogs, dataSchema });
        consumed = [];
        generation++;
      }
      for (let i = consumed.length; i < envelopes.length; i++) {
        // The engine's contract is that a hostile payload becomes ISSUES, never
        // an exception — so this catch should never fire, and it reports loudly
        // rather than swallowing. Before #134 the call was unguarded, and one
        // envelope naming a prototype key (`"component": "toString"`) took the
        // entire view down instead of the one node. Guarding here keeps the
        // surfaces that already parsed on screen, and puts the engine bug in
        // front of the reader where the issue list already lives.
        try {
          processor.apply(envelopes[i], i);
        } catch (error) {
          processor.globalIssues.push({
            severity: 'error',
            code: A2UI_ISSUE_CODES.ENGINE_ERROR,
            message: `The A2UI engine failed on message ${i}: ${
              error instanceof Error ? error.message : String(error)
            }`,
            path: `/messages/${i}`
          });
          if (import.meta.env?.DEV) console.error('[A2UIView] engine error', error);
        }
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
    resolveSlotClasses(
      blocksConfig,
      'A2UIView',
      preset,
      {},
      slotClassesProp,
      a2uiViewVariants.config
    )
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
      ? resolveClassChain(resolvedSlots?.root, className)
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
    const isUnstyled = unstyled;
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
      // Resolve the surface's catalog to its Svelte wiring: which dispatcher
      // renders it and which icon set it draws from. surface.catalog is one of
      // `catalogs`, so both lookups always hit; the `??` are belt-and-braces.
      const surfaceCatalog = catalogById.get(surface.catalog.catalogId) ?? defaultCatalog;
      const surfaceIcons = iconsByCatalog.get(surfaceCatalog.catalogId) ?? defaultIcons;
      const context: A2uiRenderContext = {
        classes: currentClasses,
        unstyled: isUnstyled,
        urlPolicy,
        streaming: isStreaming,
        inline: false,
        surfaceId: surface.surfaceId,
        onAction,
        // Read lazily: the click, not the render, decides what the agent sees.
        actionDataModel: surface.sendDataModel ? () => surface.dataModel : undefined,
        resolve: (value, scope) => resolveDynamic(value, surface.dataModel, scope),
        write: (pointer, value) => writeBinding(surface.surfaceId, pointer, value),
        remove: (pointer) => removeBinding(surface.surfaceId, pointer),
        icons: surfaceIcons.icons,
        fallbackIcon: surfaceIcons.fallbackIcon,
        nodeComponent: surfaceCatalog.Node,
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
  self-import inside the node dispatcher: a snippet that renders the dispatcher
  and passes ITSELF down as `renderChild` gives clean recursion without the
  circular component-type resolution that self-imports trip in svelte-check. The
  dispatcher is the surface catalog's own node component (Basic → A2UINode; a
  custom catalog → its own), read off the render context per surface.
-->
{#snippet renderNode(node: A2uiRenderNode, context: A2uiRenderContext)}
  {@const Node = context.nodeComponent}
  <Node {node} {context} renderChild={renderNode} />
{/snippet}

<!--
  Streaming skeleton: while the model is still emitting the (often large)
  updateComponents envelope, the surface exists without a root — show a quiet
  pulse instead of nothing so the wait is visible.
-->
{#snippet pendingSkeleton()}
  <div class={classes.pendingSurface} role="status">
    <span class="sr-only">{pendingLabel}</span>
    <div class={[classes.pendingBar, 'w-1/3']} aria-hidden="true"></div>
    <div class={[classes.pendingBar, 'w-full']} aria-hidden="true"></div>
    <div class={[classes.pendingBar, 'w-2/3']} aria-hidden="true"></div>
  </div>
{/snippet}

<div class={rootClass} {...restProps}>
  {#if view.summaryIssues.length}
    <Alert {unstyled} intent="danger" title={errorTitle}>
      <ul class={classes.errorList}>
        {#each view.summaryIssues as issue, index (`${issue.code}#${index}`)}
          <li>{issue.message}</li>
        {/each}
      </ul>
    </Alert>
  {/if}

  {#each view.surfaces as surface (`${surface.surfaceId}#${generation}`)}
    <div class={classes.surface}>
      {#if surface.root}
        {@render renderNode(surface.root, surface.context)}
      {:else if streamingProp}
        {@render pendingSkeleton()}
      {:else}
        <span class={classes.errorChip}>{errorTitle}</span>
      {/if}
    </div>
  {/each}

  {#if streamingProp && view.surfaces.length === 0 && !view.summaryIssues.length}
    <!-- Fence opened but no envelope has completed yet — same quiet pulse. -->
    {@render pendingSkeleton()}
  {/if}
</div>
