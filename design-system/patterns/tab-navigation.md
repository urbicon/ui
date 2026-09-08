# Tab Navigation

URL-based tab navigation for SvelteKit routes — each tab is a link to a route segment, and the URL is the only state.

## When to Use

Use this pattern when:

- Peer sections of a detail view need their own URL (bookmarkable, shareable, deep-linkable)
- Each section has distinct content that justifies a separate route
- The user navigates between sections without losing page context (e.g., project detail with Overview, Settings, Logs)

Do NOT use when:

- The sections are panels inside one document, or share state a navigation would drop — use `Tab` with `TabItem` / `TabPanel` and `bind:value`; it switches panels, it does not navigate
- There are only 2 sections — consider a simple toggle or inline layout
- Sections are hierarchical — use `Sidebar` navigation instead (see `settings-page` pattern)

## Layout

- **Structure:** shared layout (`+layout.svelte`) holding the tab bar — a `<nav>` of links — with a nested `+page.svelte` per section rendered as `children`
- **Placement:** tabs directly below the page header / breadcrumb, above the content area
- **Content:** each `+page.svelte` renders its own section content below the shared tab bar
- **Responsive:** the tab bar scrolls horizontally on narrow screens (collapse to a `Select` for 5+ tabs). A scroll container clips at its padding box, so the `py-1` on the `<nav>` is the room the focus ring needs to survive — which is why the rule under the strip is a `before:` line at that inset rather than the container's own `border-b`; `tab.variants.ts` records the same trade for `Tab`

## SvelteKit Route Structure

```
routes/
  project/[id]/
    +layout.svelte      ← shared tab bar
    +page.svelte         ← "Overview" (default tab)
    settings/
      +page.svelte       ← "Settings" tab
    logs/
      +page.svelte       ← "Logs" tab
    hooks/
      +page.svelte       ← "Hooks" tab
```

## Implementation

### Shared Layout with Link Tabs

The tab bar is navigation, so it is a `<nav>` of anchors. The browser gets real links (history, middle-click, copy link, prefetch, no JavaScript needed), assistive technology gets the current section through `aria-current="page"`, and nothing has to be kept in sync with the URL because nothing but the URL is read. The library ships no anchor primitive today (a Navigation-family `Link` is planned), so the tabs are plain `<a>` elements carrying utility classes.

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';

  const { children }: { children: Snippet } = $props();

  const tabs: { label: string; href: string; exact?: boolean }[] = $derived([
    // The index tab's href is a prefix of every sibling's, so it is the one that
    // must match exactly — otherwise it stays lit on every subsection.
    { label: 'Overview', href: `/project/${page.params.id}`, exact: true },
    { label: 'Settings', href: `/project/${page.params.id}/settings` },
    { label: 'Logs', href: `/project/${page.params.id}/logs` },
    { label: 'Hooks', href: `/project/${page.params.id}/hooks` }
  ]);

  // A section owns its subtree: /project/1/settings/advanced keeps Settings
  // current. Bare equality would leave no tab current there at all.
  const isCurrent = (href: string, exact = false) =>
    exact
      ? page.url.pathname === href
      : page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<div class="flex flex-col gap-6">
  <nav
    aria-label="Project sections"
    class="before:bg-border-subtle relative flex gap-1 overflow-x-auto py-1 before:absolute before:inset-x-0 before:bottom-1 before:z-0 before:h-px before:content-['']"
  >
    {#each tabs as tab (tab.href)}
      {@const active = isCurrent(tab.href, tab.exact)}
      <a
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        class={[
          'relative z-10 border-b-2 px-4 py-2 font-medium whitespace-nowrap transition-colors',
          'focus-visible:rounded-modify focus-visible:ring-primary/50 focus-visible:ring-2 focus-visible:outline-none',
          active
            ? 'border-primary text-primary-text'
            : 'text-text-tertiary hover:text-text-primary border-transparent'
        ]}
      >
        {tab.label}
      </a>
    {/each}
  </nav>

  {@render children()}
</div>
```

## Component Selection

| UI Need                                     | Component                      | When                                                                            |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| Route-addressed peer sections               | `<nav>` + `<a href>`           | This pattern — the URL is the state, `aria-current="page"` marks the active tab |
| Panels inside one document                  | `Tab` + `TabItem` + `TabPanel` | Client-side `bind:value`; nothing changes the URL                               |
| A view switch inside one page (list / grid) | `SegmentGroup` + `SegmentItem` | A chosen value, not a location — never a route switcher                         |
| 5+ sections on mobile                       | `Select`                       | Dropdown fallback for narrow screens                                            |
| Hierarchical subsections                    | `Sidebar`                      | Use `settings-page` pattern instead                                             |

## Behavioral Rules

- The default route (`+page.svelte` at the layout level) is the first tab.
- The active tab comes from `page.url.pathname` alone — the URL is the only source of truth, and there is no component state to keep in step. Matching is a prefix, not an equality: a tab owns its subtree (`pathname === href || pathname.startsWith(href + '/')`) so `/project/1/settings/advanced` keeps Settings current. The one exception is the index tab, whose href is a prefix of every sibling's — it matches exactly, or it never goes out.
- Tabs are `<a href>`, never buttons calling `goto()`: browser history, middle-click, copy-link, prefetch and the no-JavaScript fallback all come with the anchor.
- `aria-current="page"` on the active link is its accessible selected state. `role="tablist"` / `role="tab"` belong to `Tab`, whose triggers switch panels without navigating.
- Breadcrumbs above the tab bar show the entity context (e.g., "Projects / My Project"), not the tab name.
- Each tab page is independently loadable via URL (deep linking).

## Anti-Patterns

- Do not store the active tab in `$state` — derive it from `page.url`. Client-side state and URL will drift.
- Do not build route tabs out of `Tab` / `TabItem` with an `<a>` inside each trigger. `TabItem` renders a `<button role="tab">`, so the anchor is an interactive element inside another one — invalid HTML, a second tab stop inside every tab, and two competing activations. `Tab` is for `TabPanel`s inside one document.
- Do not turn `SegmentGroup` into a route switcher (`onValueChange` → `goto()`). It is a `radiogroup` announcing a chosen value, not a location, and a button that navigates loses every link affordance the anchor has for free.
- Do not duplicate the tab bar in every `+page.svelte` — put it in the shared `+layout.svelte`.
- Do not use this **route-based** pattern for settings where each section owns its save/cancel — navigating away loses unsaved edits. A small, flat settings page with one page-level save can use client-side `Tab` (`bind:value`); larger or per-section-save settings use `Sidebar` (see `settings-page`).

## Related

- Pattern: `settings-page` — the scale-based Tab-vs-Sidebar choice for settings
- Component: `Tab` — panels inside one document (`TabItem` / `TabPanel`, `bind:value`)
- Component: `SegmentGroup` — a value switch such as list / grid, not navigation
