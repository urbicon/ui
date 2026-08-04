<script lang="ts">
  import { useDocsI18n, getDocsLocales } from '$lib/i18n';
  import { useI18n, BASE_LOCALE } from '@urbicon-ui/i18n';
  import { CodeIcon, EyeOffIcon } from '@urbicon-ui/blocks';
  import { getCodeVisibilityContext } from '$lib/stores/code-visibility.svelte';
  import { ScrollSpy } from '$lib/stores/scroll-spy.svelte';
  import { tableOfContentsVariants } from './tableofcontents.variants';
  import type { TableOfContentsProps } from './index.js';

  const dt = useDocsI18n();
  const i18n = useI18n();

  // The kickers ("On this page", "Related", "Code", the code-toggle label) render
  // through `dt`, so `lang` tags ONLY those spans — never the whole aside. The
  // nav-link labels are the page's own section titles (content language, English
  // on this docs site); tagging the aside would mislabel them as the chrome
  // locale, a worse WCAG 3.1.2 miss than the few kicker words it fixes. `dt`
  // falls back to the base locale for any locale the docs package doesn't
  // translate, so declare the locale the kickers are ACTUALLY in. No provider →
  // base locale, which matches the untranslated default strings.
  const tocLocale = $derived(getDocsLocales().includes(i18n.locale) ? i18n.locale : BASE_LOCALE);

  let {
    title,
    navigation = [],
    position = 'right',
    width = 'md',
    trackScroll = true,
    activeSection,
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

  // `unstyled` drops the tv defaults; slotClasses always apply on top.
  type SlotName = keyof NonNullable<TableOfContentsProps['slotClasses']>;
  // Folds through tv(): a `slotClasses` entry strips the default it conflicts
  // with, so the override wins its bucket instead of both classes landing on
  // the element and the stylesheet order picking the winner. Same contract as
  // the ternary every `blocks` component uses, and as CodePanel /
  // TypesReference / PlaygroundConfigurator here. Under `unstyled` there are
  // no defaults to fold against, so the override stands alone.
  const slot = (name: SlotName): string => {
    if (unstyled) return slotClasses[name] ?? '';
    const fns = styles as unknown as Record<string, (a: { class?: string }) => string>;
    return fns[name]({ class: slotClasses[name] });
  };

  // Kickers resolve through the docs i18n unless the consumer overrides
  // `title` explicitly (the RELATED/CODE kickers are always localized).
  const tocTitle = $derived(title ?? dt('tocOnThisPage'));

  const navigationItems = $derived(
    navigation.map((item) => ({
      id: item.id,
      label: item.title,
      href: item.href ?? `#${item.id}`,
      children: (item.children ?? []).map((child) => ({
        id: child.id,
        label: child.title,
        href: child.href ?? `#${child.id}`
      }))
    }))
  );

  // Private fallback spy — only observes when no layout controls us via the
  // `activeSection` prop. DocsLayout passes its layout-wide spy's active id
  // down, so within the layout there is exactly ONE scroll listener.
  const spyIds = $derived(
    navigationItems.flatMap((item) => [item.id, ...item.children.map((child) => child.id)])
  );
  const spy = new ScrollSpy(() => spyIds);

  // Controlled wins; `trackScroll` only gates the self-tracking fallback.
  // The short-circuit is also what gates the listener: `spy.active` only
  // subscribes when it is actually read, so the condition lives here once
  // instead of being mirrored in an `$effect` that called `observe()`.
  const active = $derived(activeSection ?? (trackScroll ? spy.active : ''));

  // Plain function — reads the reactive `active` at render time, so each
  // template call re-evaluates when the active section changes.
  function shouldShowChildren(item: (typeof navigationItems)[number]): boolean {
    if (!item.children.length) return false;
    return active === item.id || item.children.some((child) => active === child.id);
  }
</script>

<!-- Named landmark: a docs page carries several <aside>s (every InfoCard is
     one), and ARIA needs same-type landmarks to be tellable apart. -->
<aside class={[slot('aside'), className]} aria-label={dt('tocLandmarkLabel')}>
  <p class={slot('title')}>
    <!-- `meta-marker` renders a mono kicker (Color Rooms drops the editorial
         `//` prefix) — only styled when the host page sets `.docs-rooms`. The
         `lang` marks the DEFAULT kicker (via `dt`); a consumer-supplied `title`
         is of unknown language, so it stays untagged (inherits the page lang). -->
    <span class="meta-marker" lang={title == null ? tocLocale : undefined}>{tocTitle}</span>
  </p>
  <nav class={slot('nav')} aria-label={tocTitle}>
    {#each navigationItems as item (item.id)}
      {@const isActive = active === item.id}
      {@const showChildren = shouldShowChildren(item)}
      <!-- Table-of-contents anchors navigate within the current route via
           `#hash`; `resolve()` only applies to SvelteKit route paths and
           would flag false positives for every TOC entry. -->
      <a
        href={item.href}
        aria-current={isActive ? 'location' : undefined}
        class={[slot('link'), slot(isActive ? 'linkActive' : 'linkInactive')]}
      >
        {item.label}
      </a>

      {#if showChildren}
        {#each item.children as child (child.id)}
          {@const childIsActive = active === child.id}
          <a
            href={child.href}
            aria-current={childIsActive ? 'location' : undefined}
            class={[
              slot('childLink'),
              slot(childIsActive ? 'childLinkActive' : 'childLinkInactive')
            ]}
          >
            {child.label}
          </a>
        {/each}
      {/if}
    {/each}
  </nav>

  {#if related && related.length > 0}
    <!--
      `RELATED` block.
      Sibling-list to the page-section nav above; the `meta-marker`
      kicker matches the `ON THIS PAGE` title. Hrefs are pre-resolved
      by the consumer, mirroring the existing TOC behaviour.
    -->
    <p class={slot('relatedTitle')}>
      <span class="meta-marker" lang={tocLocale}>{dt('tocRelated')}</span>
    </p>
    <nav class={slot('relatedNav')} aria-label={dt('tocRelated')}>
      {#each related as link (link.href)}
        <!-- hrefs are pre-resolved by the consumer -->
        <a href={link.href} class={slot('relatedLink')}>
          {link.label}
        </a>
      {/each}
    </nav>
  {/if}

  {#if codeVisibility && showCodeToggle}
    <!--
      `CODE` block.
      Hosts the global show/hide-all-code toggle as a Mono action so the
      sticky-bar can carry the source-link instead. The block only
      renders when a code-visibility context is available — i.e. when
      the host page is wrapped by DocsLayout, which is the only consumer
      that opts the user into the global toggle.
    -->
    <p class={slot('codeTitle')}>
      <span class="meta-marker" lang={tocLocale}>{dt('tocCode')}</span>
    </p>
    <button
      type="button"
      class={slot('codeToggle')}
      onclick={() => codeVisibility.toggle()}
      aria-pressed={codeVisibility.expanded}
    >
      {#if codeVisibility.expanded}
        <EyeOffIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {:else}
        <CodeIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {/if}
      <span class={slot('codeToggleLabel')} lang={tocLocale}>
        {codeToggleLabel}
      </span>
    </button>
  {/if}
</aside>
