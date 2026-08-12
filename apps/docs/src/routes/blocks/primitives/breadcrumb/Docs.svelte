<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import {
    Breadcrumb,
    ChevronRightIcon,
    HomeIcon,
    Kbd,
    type BreadcrumbItem
  } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  // Demo-only items don't navigate; they only illustrate the component's
  // shape. Real consumers pass real hrefs and omit the onclick override.
  const demoNoop = (event: MouseEvent) => event.preventDefault();

  const veryDeepItems = [
    { label: 'Org', href: '#', onclick: demoNoop },
    { label: 'Engineering', href: '#', onclick: demoNoop },
    { label: 'Platform', href: '#', onclick: demoNoop },
    { label: 'Design System', href: '#', onclick: demoNoop },
    { label: 'Primitives', href: '#', onclick: demoNoop },
    { label: 'Navigation', href: '#', onclick: demoNoop },
    { label: 'Breadcrumb' }
  ];

  // `BreadcrumbItem.icon` takes the icon *component*, never a name: a name
  // would go through the runtime registry and pull all 315 icons into the
  // bundle. The icon is decorative (the component wraps it in an `aria-hidden`
  // span), so the crumb announces as its `label` with no `aria-label` needed.
  const iconHomeItems = [
    { label: 'Home', href: '#', icon: HomeIcon, onclick: demoNoop },
    { label: 'Blog', href: '#', onclick: demoNoop },
    { label: 'Architecture', href: '#', onclick: demoNoop },
    { label: 'Monorepo Setup' }
  ];

  // A breadcrumb usually mirrors the route, so build it from the path rather
  // than hand-listing crumbs. Each segment becomes a crumb whose `href` is the
  // path up to it; the last segment is the current page. In a SvelteKit app
  // this takes `page.url.pathname` (from `$app/state`) instead of a literal.
  function itemsFromPath(pathname: string): BreadcrumbItem[] {
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, i) => ({
      label: segment.replace(/-/g, ' ').replace(/^[a-z]/, (c) => c.toUpperCase()),
      href: '/' + segments.slice(0, i + 1).join('/')
    }));
  }

  const pathItems = itemsFromPath('/settings/team/billing');
  // Live-preview only: block navigation to routes this docs site doesn't own.
  // The prerender crawler reads the rendered `href` and never sees `onclick`,
  // so the href has to go too — otherwise `/settings` fails the build.
  const pathPreviewItems = pathItems.map((item) => ({
    ...item,
    href: '#',
    onclick: demoNoop
  }));

  const galleryItems = [
    { label: 'Home', href: '#', onclick: demoNoop },
    { label: 'Gallery', href: '#', onclick: demoNoop },
    { label: 'Featured' }
  ];
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="From the current path"
      description="Breadcrumbs usually mirror the route, so derive them from the path instead of hand-listing each crumb. Wrapping the call in `$derived(itemsFromPath(page.url.pathname))` (with `page` from `$app/state`) re-runs it on every navigation, so the trail follows the current route. The last segment is the current page."
      isolate
      code={`<script lang="ts">
  import { page } from '$app/state';
  import { Breadcrumb, type BreadcrumbItem } from '@urbicon-ui/blocks';

  // Each segment becomes a crumb; its href is the path up to it.
  function itemsFromPath(pathname: string): BreadcrumbItem[] {
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, i) => ({
      label: segment.replace(/-/g, ' ').replace(/^[a-z]/, (c) => c.toUpperCase()),
      href: '/' + segments.slice(0, i + 1).join('/')
    }));
  }

  // Re-runs on every navigation, so the trail follows the current route.
  const items = $derived(itemsFromPath(page.url.pathname));
<\/script>

<Breadcrumb {items} />`}
    >
      <Breadcrumb items={pathPreviewItems} />
    </CodeExample>

    <CodeExample
      title="Icons"
      description="A per-item `icon` renders before that crumb's label. Pass the icon component itself (`icon: HomeIcon`), never its name, because a name pulls the whole icon set into the bundle. The same trail also swaps the default `/` for a `ChevronRightIcon` through the `separator` snippet, which sets the separator for every crumb."
      isolate
      code={`<script lang="ts">
  import { Breadcrumb, HomeIcon, ChevronRightIcon } from '@urbicon-ui/blocks';
<\/script>

<Breadcrumb
  items={[
    { label: 'Home', href: '/', icon: HomeIcon },
    { label: 'Blog', href: '/blog' },
    { label: 'Architecture', href: '/blog/architecture' },
    { label: 'Monorepo Setup' }
  ]}
>
  {#snippet separator()}
    <ChevronRightIcon size={14} />
  {/snippet}
</Breadcrumb>`}
    >
      <Breadcrumb items={iconHomeItems}>
        {#snippet separator()}
          <ChevronRightIcon size={14} />
        {/snippet}
      </Breadcrumb>
    </CodeExample>

    <CodeExample
      title="Collapsing long paths"
      description="Set `maxItems` to fold the middle of a deep trail into an expandable ellipsis (…). `itemsBeforeCollapse` and `itemsAfterCollapse` keep that many items at each end, and the current page is always shown. Clicking the ellipsis reveals the full path and moves focus to the first revealed item."
      isolate
    >
      <Breadcrumb items={veryDeepItems} maxItems={4} itemsBeforeCollapse={2} size="sm" />
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="Pill links"
      description="Restyle the trail into pill links with `slotClasses` and semantic tokens only. Each ancestor link sits in a neutral `surface` pill that shifts to a `primary` tint on hover, and the current page is a solid `primary` pill that marks position. The pill radius comes from the `commit` tier, so it tracks the theme rather than hardcoding `rounded-full`."
      isolate
      previewClass="flex items-center justify-center px-8 py-6"
    >
      <Breadcrumb
        items={galleryItems}
        slotClasses={{
          link: 'rounded-commit border border-border-subtle bg-surface-interactive px-2.5 py-1 text-text-secondary hover:bg-surface-selected hover:text-primary hover:no-underline focus-visible:rounded-commit',
          currentPage: 'rounded-commit bg-primary px-2.5 py-1 text-text-on-primary',
          separator: 'mx-1'
        }}
      >
        {#snippet separator()}
          <ChevronRightIcon size={14} />
        {/snippet}
      </Breadcrumb>
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      This is one of five ways to restyle a block. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        Renders as a <code class="text-text-primary">&lt;nav&gt;</code> with
        <code class="text-text-primary">aria-label="Breadcrumb"</code>, overridable with the
        <code class="text-text-primary">aria-label</code> prop. The last item carries
        <code class="text-text-primary">aria-current="page"</code> to announce the current page. A
        per-item
        <code class="text-text-primary">icon</code> is decorative: it renders inside an
        <code class="text-text-primary">aria-hidden</code> wrapper, so the crumb announces as its
        <code class="text-text-primary">label</code>
        alone. Give an icon-only crumb its own
        <code class="text-text-primary">aria-label</code> when the label is too terse to stand on its
        own.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        All breadcrumb links are standard
        <code class="text-text-primary">&lt;a&gt;</code> elements, fully focusable via
        <Kbd keys="Tab" />. Focus indicators use
        <code class="text-text-primary">focus-visible:</code> to only show on keyboard navigation.
      </p>
    </Note>
    <Note title="Semantic Markup">
      <p>
        Uses an ordered list (<code class="text-text-primary">&lt;ol&gt;</code>) inside the
        <code class="text-text-primary">&lt;nav&gt;</code> landmark, following the
        <a
          href="https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/"
          class="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          WAI-ARIA Breadcrumb pattern</a
        >. Separators are marked
        <code class="text-text-primary">aria-hidden="true"</code> to avoid screen reader clutter.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        Hover transitions on links respect
        <code class="text-text-primary">prefers-reduced-motion</code> via the design-token-based transition
        duration.
      </p>
    </Note>
  </NoteList>
</Section>
