<script lang="ts">
  import { InfoCard } from '$lib';
  import { useDocsI18n } from '$lib/i18n';
  import { getCodeVisibilityContext } from '$lib/stores/code-visibility.svelte';
  import CodePanel from '../CodePanel/CodePanel.svelte';
  import { codeExampleVariants } from './codeexample.variants';
  import type { CodeExampleProps } from './index.js';

  const dt = useDocsI18n();

  let {
    title,
    code = '',
    language = 'svelte',
    size = 'md',
    preview = true,
    description,
    isolate,
    previewClass: previewClassProp,
    defaultExpanded,
    children,
    class: className,
    unstyled = false,
    slotClasses = {}
  }: CodeExampleProps = $props();

  const DEFAULT_PREVIEW_CLASS = 'flex flex-wrap items-center gap-4';
  const effectivePreviewClass = $derived(
    previewClassProp ?? (isolate ? DEFAULT_PREVIEW_CLASS : '')
  );

  const styles = $derived(codeExampleVariants({ size, hasPreview: preview }));

  const visibilityStore = getCodeVisibilityContext();

  let localOverride = $state<boolean | null>(null);

  const codeExpanded = $derived.by(() => {
    if (localOverride !== null) return localOverride;
    if (defaultExpanded !== undefined) return defaultExpanded;
    if (visibilityStore) return visibilityStore.expanded;
    return true;
  });

  function toggleCode() {
    localOverride = localOverride === null ? !codeExpanded : !localOverride;
  }

  $effect(() => {
    if (visibilityStore) {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      visibilityStore.mode;
      localOverride = null;
    }
  });

  function handleKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'X') {
      event.preventDefault();
      navigator.clipboard.writeText(code);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  class={unstyled
    ? [slotClasses?.container, className].filter(Boolean).join(' ')
    : styles.container({ class: [slotClasses?.container, className] })}
  data-docs-stage="example"
>
  {#if title}
    <h3 class={unstyled ? (slotClasses?.title ?? '') : styles.title({ class: slotClasses?.title })}>
      {title}
    </h3>
  {/if}

  {#if description}
    <div
      class={unstyled
        ? (slotClasses?.description ?? '')
        : styles.description({ class: slotClasses?.description })}
    >
      {description}
    </div>
  {/if}

  {#if preview}
    <div
      class={unstyled
        ? (slotClasses?.preview ?? '')
        : styles.preview({ class: slotClasses?.preview })}
      data-docs-stage-frame
    >
      <div
        data-docs-preview
        class={unstyled
          ? (slotClasses?.previewContent ?? '')
          : styles.previewContent({ class: slotClasses?.previewContent })}
      >
        {#if children}
          {#if effectivePreviewClass}
            <div class={effectivePreviewClass}>
              {@render children()}
            </div>
          {:else}
            {@render children()}
          {/if}
        {/if}
      </div>
    </div>
  {/if}

  {#if code}
    <CodePanel
      {code}
      {language}
      {size}
      expanded={codeExpanded}
      onToggle={toggleCode}
      {unstyled}
      slotClasses={{
        root: slotClasses?.codeSection,
        toolbar: slotClasses?.toolbar,
        codeToggle: slotClasses?.codeToggle,
        codeChevron: slotClasses?.codeChevron,
        languageTag: slotClasses?.languageTag,
        copyButton: slotClasses?.copyButton,
        codeCollapse: slotClasses?.codeCollapse
      }}
    />
  {:else}
    <InfoCard intent="warning" size="sm">
      <p>{dt('codeExtractionFallback')}</p>
    </InfoCard>
  {/if}
</div>
