<script lang="ts">
  import { untrack } from 'svelte';
  import { Alert } from '#lib/primitives/index.js';
  import { getBlocksConfig, resolveSlotClasses } from '#lib/provider/index.js';
  import { resolveClassChain } from '#lib/utils/variants.js';
  import type { A2uiValidationIssue } from './a2ui.types';
  import { basicA2uiCatalog } from './a2ui-basic-catalog';
  import type { A2uiCatalog } from './a2ui-catalog';
  import { resolveDynamic, writeDataModel } from './a2ui-data';
  import { readHidden } from './a2ui-node-common';
  import { A2UI_ACCESSIBILITY_PROP } from './a2ui-registry';
  import { type A2uiRenderContext, type A2uiRenderNode, buildRenderTree } from './a2ui-render';
  import {
    type A2uiProcessor,
    applyA2uiEnvelope,
    collectA2uiIssues,
    createA2uiProcessor,
    normalizeA2uiPayload
  } from './a2ui-validate';
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
    surfaceRequirements: surfaceRequirementsProp,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: A2UIViewProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  // Effective catalogs: the Basic catalog is always configured, consumer
  // catalogs follow. Resolved ONCE at init — `createIcons()` reads the
  // IconProvider context, so it must run during component init and cannot be
  // reactive: a `catalogs` value passed later is ignored. `untrack` captures the
  // initial prop value without a reactive subscription (the init-only capture is
  // deliberate — silences `state_referenced_locally`).
  const catalogs: readonly A2uiCatalog[] = [
    basicA2uiCatalog,
    ...(untrack(() => catalogsProp) ?? [])
  ];
  // What a render context carries for one catalog: its dispatcher and its icons.
  type CatalogWiring = Pick<
    A2uiRenderContext,
    'catalogId' | 'nodeComponent' | 'icons' | 'fallbackIcon'
  >;
  // biome-ignore lint/nursery/useSvelteReactiveClasses: init-only like `catalogs`; the loop below is its only writer
  const wiringById = new Map<string, CatalogWiring>();
  for (const catalog of catalogs) {
    if (wiringById.has(catalog.catalogId)) continue;
    wiringById.set(catalog.catalogId, {
      catalogId: catalog.catalogId,
      nodeComponent: catalog.Node,
      ...catalog.createIcons()
    });
  }
  // Draws the fault chips and placeholders of a surface that has no catalog of
  // its own; it resolves no component.
  const chipWiring = wiringById.get(basicA2uiCatalog.catalogId) as CatalogWiring;

  // A surface may mix catalogs per component (`@catalogId`), so a node whose
  // catalog differs from the context it is handed gets that catalog's wiring.
  // A node without a catalog is a fault chip, which any dispatcher draws.
  function wiredFor(node: A2uiRenderNode, context: A2uiRenderContext): A2uiRenderContext {
    const catalogId = node.instance?.catalog?.catalogId;
    if (catalogId === undefined || catalogId === context.catalogId) return context;
    const wiring = wiringById.get(catalogId);
    return wiring ? { ...context, ...wiring } : context;
  }

  function hiddenOf(node: A2uiRenderNode, context: A2uiRenderContext): boolean | undefined {
    return readHidden(
      node.instance?.props.get(A2UI_ACCESSIBILITY_PROP),
      (value) => context.resolve(value, node.scopePrefix).value
    );
  }
  // Init-fixed like the catalogs (validation config, not reactive UI state).
  const dataSchema = untrack(() => dataSchemaProp);
  const surfaceRequirements = untrack(() => surfaceRequirementsProp);

  // ── Processor (plain, non-reactive) + version counter ────────────────────
  // The processor mutates plain Maps in place (the streaming-markdown engine
  // pattern). A $state version counter is the single reactive primitive; the
  // render tree derives from it, so reading it is a real subscription (unlike a
  // `void messages` proxy read). `processor`/`consumed` are plain lets: their
  // reassignment must NOT itself trigger reactivity — the bump does.
  let processor: A2uiProcessor = createA2uiProcessor({ catalogs, dataSchema, surfaceRequirements });
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
        processor = createA2uiProcessor({ catalogs, dataSchema, surfaceRequirements });
        consumed = [];
        generation++;
      }
      for (let i = consumed.length; i < envelopes.length; i++) {
        applyA2uiEnvelope(processor, envelopes[i], i);
      }
      consumed = envelopes.slice();
      normalizeIssue = issue;
      version++;
    });
  });

  // Two-way write-back through the processor's own write path, then bump so the
  // render tree re-derives with the new value (bound labels update live). A
  // refused write changes nothing and reports nothing: what refuses it is the
  // binding, which validation reported, or the model at that moment, which the
  // next message may change. `undefined` removes the key.
  function writeBinding(surfaceId: string, pointer: string, value: unknown): void {
    const surface = processor.surfaces.get(surfaceId);
    if (!surface) return;
    const write = writeDataModel(surface.dataModel, pointer, value);
    if (!write.ok) return;
    surface.dataModel = write.model;
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
    // A server's `validateA2uiPayload` builds its list with this same call, so an
    // issue added beside it here is one the server never reports.
    const allIssues = collectA2uiIssues(processor, {
      streaming: isStreaming,
      payloadIssue: normalizeIssue
    });
    const summaryIssues: A2uiValidationIssue[] = [
      ...(normalizeIssue ? [normalizeIssue] : []),
      ...processor.globalIssues.filter((globalIssue) => globalIssue.severity === 'error')
    ];

    for (const surface of processor.surfaces.values()) {
      const root = buildRenderTree(surface);
      // The wiring the root starts with; `wiredFor` switches it per node.
      const wiring = (surface.catalog && wiringById.get(surface.catalog.catalogId)) || chipWiring;
      const context: A2uiRenderContext = {
        ...wiring,
        classes: currentClasses,
        unstyled: isUnstyled,
        urlPolicy,
        streaming: isStreaming,
        inline: false,
        surfaceId: surface.surfaceId,
        onAction,
        // Read lazily: the click, not the render, decides what the agent sees.
        actionDataModel: surface.sendDataModel ? () => surface.dataModel : undefined,
        resolve: (value, scope) =>
          resolveDynamic(value, surface.dataModel, scope, surface.callCatalogs),
        write: (pointer, value) => writeBinding(surface.surfaceId, pointer, value),
        remove: (pointer) => writeBinding(surface.surfaceId, pointer, undefined),
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
        issue.message,
        issue.functionCallId ?? ''
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
  dispatcher is the node component of the node's own catalog (Basic → A2UINode;
  a custom catalog → its own), read off the render context `wiredFor` hands it.
-->
{#snippet renderNode(node: A2uiRenderNode, context: A2uiRenderContext)}
  {@const wired = wiredFor(node, context)}
  {@const Node = wired.nodeComponent}
  {@const hidden = hiddenOf(node, wired)}
  {#if hidden === undefined}
    <Node {node} context={wired} renderChild={renderNode} />
  {:else}
    <!--
      `@accessibility.hidden`, around the whole component: `aria-hidden` alone
      would leave a control in the tab order that assistive technology is told
      does not exist (axe aria-hidden-focus), so it is `inert` as well. A span
      inside a Button label, where a div is invalid; `display: contents` keeps
      the component the flex child of its container. `undefined`, not `false`:
      where an element has no `inert` property (jsdom), `false` still leaves an
      `inert` attribute behind.
    -->
    <svelte:element
      this={wired.inline ? 'span' : 'div'}
      style="display: contents"
      inert={hidden || undefined}
      aria-hidden={hidden ? 'true' : undefined}
    >
      <Node {node} context={wired} renderChild={renderNode} />
    </svelte:element>
  {/if}
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
