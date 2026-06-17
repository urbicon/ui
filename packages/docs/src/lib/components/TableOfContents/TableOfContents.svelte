<script lang="ts">
  import { onMount } from 'svelte';
  import { useDocsI18n } from '$lib/i18n';
  import { CodeIcon, EyeOffIcon } from '@urbicon-ui/blocks';
  import { getCodeVisibilityContext } from '$lib/stores/code-visibility.svelte';

  const BROWSER = typeof window !== 'undefined';
  import { tableOfContentsVariants } from './tableofcontents.variants';
  import type { TableOfContentsProps } from './index.js';
  import type { NavigationItem } from '@urbicon-ui/shared-types';

  const dt = useDocsI18n();

  let {
    title = 'On this page',
    navigation = [],
    position = 'right',
    width = 'md',
    trackScroll = true,
    related,
    showCodeToggle = true,
    class: className,
    unstyled = false,
    slotClasses = {}
  }: TableOfContentsProps = $props();

  // The code-visibility store is provided by DocsLayout; we read it
  // optionally so the TOC works standalone too. The `// CODE` block
  // only renders when a store is available.
  const codeVisibility = getCodeVisibilityContext();
  const codeToggleLabel = $derived(
    codeVisibility?.expanded ? dt('hideAllCode') : dt('showAllCode')
  );

  const styles = $derived(tableOfContentsVariants({ position, width }));

  type TocItem = {
    id: string;
    label?: string;
    title?: string;
    href?: string;
    children?: TocItem[];
  };

  const navigationItems = $derived(
    ((navigation ?? []) as TocItem[]).map((item) => ({
      id: item.id,
      label: item.label ?? item.title,
      href: item.href ?? `#${item.id}`,
      children: item.children ?? []
    }))
  );

  const allItems = $derived(() => {
    const flatten = (items: NavigationItem[]): NavigationItem[] => {
      return items.reduce((acc, item) => {
        acc.push({ ...item, href: item.href || `#${item.id}` });
        if (item.children) {
          acc.push(...flatten(item.children as NavigationItem[]));
        }
        return acc;
      }, [] as NavigationItem[]);
    };
    return flatten(navigationItems as unknown as NavigationItem[]);
  });

  let activeSection = $state('');

  const shouldShowChildren = $derived((item: (typeof navigationItems)[number]) => {
    if (!item.children?.length) return false;
    if (activeSection === item.id) return true;
    return item.children.some((child) => activeSection === child.id);
  });

  onMount(() => {
    if (!BROWSER || !trackScroll) return;

    const updateActiveSection = () => {
      const items = allItems();
      let lastMatch = '';
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.3) {
            lastMatch = el.id;
          }
        }
      }
      if (lastMatch) activeSection = lastMatch;
    };

    updateActiveSection();

    const handleScroll = () => requestAnimationFrame(updateActiveSection);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  });
</script>

<aside
  class={unstyled
    ? [slotClasses?.aside, className].filter(Boolean).join(' ')
    : styles.aside({ class: [slotClasses?.aside, className] })}
>
  <p class={unstyled ? (slotClasses?.title ?? '') : styles.title({ class: slotClasses?.title })}>
    <!-- Editorial: `meta-marker` renders the `// ` prefix in mono — only
         picks up styling when the host page sets `.docs-editorial`. -->
    <span class="meta-marker">{title}</span>
  </p>
  <nav class={unstyled ? (slotClasses?.nav ?? '') : styles.nav({ class: slotClasses?.nav })}>
    {#each navigationItems as item (item.id)}
      {@const isActive = trackScroll && activeSection === item.id}
      {@const showChildren = shouldShowChildren(item)}
      <!-- Table-of-contents anchors navigate within the current route via
           `#hash`; `resolve()` only applies to SvelteKit route paths and
           would flag false positives for every TOC entry. -->
      <!-- eslint-disable svelte/no-navigation-without-resolve -->
      <a
        href={item.href}
        class="{unstyled ? '' : styles.link()} {unstyled
          ? ''
          : isActive
            ? styles.linkActive()
            : styles.linkInactive()}"
      >
        {item.label}
      </a>

      {#if item.children?.length && showChildren}
        {#each item.children as child (child.id)}
          {@const childIsActive = trackScroll && activeSection === child.id}
          <a
            href={child.href || `#${child.id}`}
            class="{unstyled ? '' : styles.childLink()} {unstyled
              ? ''
              : childIsActive
                ? styles.childLinkActive()
                : styles.childLinkInactive()}"
          >
            {child.label ?? child.title}
          </a>
        {/each}
      {/if}
      <!-- eslint-enable svelte/no-navigation-without-resolve -->
    {/each}
  </nav>

  {#if related && related.length > 0}
    <!--
      Editorial `// RELATED` block.
      Sibling-list to the page-section nav above; the `meta-marker`
      kicker matches the `// ON THIS PAGE` title. Hrefs are pre-resolved
      by the consumer, mirroring the existing TOC behaviour.
    -->
    <p
      class={unstyled
        ? (slotClasses?.relatedTitle ?? '')
        : styles.relatedTitle({ class: slotClasses?.relatedTitle })}
    >
      <span class="meta-marker">Related</span>
    </p>
    <nav
      class={unstyled
        ? (slotClasses?.relatedNav ?? '')
        : styles.relatedNav({ class: slotClasses?.relatedNav })}
    >
      {#each related as link (link.href)}
        <!-- eslint-disable svelte/no-navigation-without-resolve -- hrefs are pre-resolved by the consumer -->
        <a
          href={link.href}
          class={unstyled
            ? (slotClasses?.relatedLink ?? '')
            : styles.relatedLink({ class: slotClasses?.relatedLink })}
        >
          {link.label}
        </a>
        <!-- eslint-enable svelte/no-navigation-without-resolve -->
      {/each}
    </nav>
  {/if}

  {#if codeVisibility && showCodeToggle}
    <!--
      Editorial `// CODE` block.
      Hosts the global show/hide-all-code toggle as a Mono action so the
      sticky-bar can carry the source-link instead. The block only
      renders when a code-visibility context is available — i.e. when
      the host page is wrapped by DocsLayout, which is the only consumer
      that opts the user into the global toggle.
    -->
    <p
      class={unstyled
        ? (slotClasses?.codeTitle ?? '')
        : styles.codeTitle({ class: slotClasses?.codeTitle })}
    >
      <span class="meta-marker">Code</span>
    </p>
    <button
      type="button"
      class={unstyled
        ? (slotClasses?.codeToggle ?? '')
        : styles.codeToggle({ class: slotClasses?.codeToggle })}
      onclick={() => codeVisibility.toggle()}
      aria-pressed={codeVisibility.expanded}
    >
      {#if codeVisibility.expanded}
        <EyeOffIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {:else}
        <CodeIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {/if}
      <span>{codeToggleLabel}</span>
    </button>
  {/if}
</aside>
