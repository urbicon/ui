# Tab Navigation

URL-based tab navigation for SvelteKit routes — each tab maps to a route segment.

## When to Use

Use this pattern when:
- Peer sections of a detail view need their own URL (bookmarkable, shareable)
- Each section has distinct content that justifies a separate route
- The user navigates between sections without losing page context (e.g., project detail with Overview, Settings, Logs)

Do NOT use when:
- Sections share state that would be lost on navigation — use client-side `Tab` with `bind:value` instead
- There are only 2 sections — consider a simple toggle or inline layout
- Sections are hierarchical — use `Sidebar` navigation instead (see `settings-page` pattern)

## Layout

- **Structure:** shared layout (`+layout.svelte`) with `Tab` or `SegmentGroup` + nested `+page.svelte` per section
- **Placement:** tabs directly below the page header / breadcrumb, above the content area
- **Content:** each `+page.svelte` renders its own section content below the shared tab bar
- **Responsive:** on mobile, consider horizontal scroll for the tab bar, or collapse to a `Select` dropdown for 5+ tabs

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

### Shared Layout with Tab Navigation

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { Tab } from '@urbicon-ui/blocks';

  const { children } = $props();

  const tabs = [
    { label: 'Overview', href: `/project/${page.params.id}` },
    { label: 'Settings', href: `/project/${page.params.id}/settings` },
    { label: 'Logs', href: `/project/${page.params.id}/logs` },
    { label: 'Hooks', href: `/project/${page.params.id}/hooks` },
  ];

  const activeTab = $derived(
    tabs.findIndex((t) => page.url.pathname === t.href) ?? 0
  );
</script>

<div class="flex flex-col gap-6">
  <Tab.Root value={tabs[activeTab]?.label}>
    {#each tabs as tab}
      <Tab.Trigger value={tab.label}>
        <a href={tab.href}>{tab.label}</a>
      </Tab.Trigger>
    {/each}
  </Tab.Root>

  {@render children()}
</div>
```

### Alternative: SegmentGroup (Compact)

For fewer tabs (2-4) where a more compact visual is preferred:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { SegmentGroup } from '@urbicon-ui/blocks';

  const segments = [
    { value: 'overview', label: 'Overview', href: `/project/${page.params.id}` },
    { value: 'settings', label: 'Settings', href: `/project/${page.params.id}/settings` },
  ];

  const current = $derived(
    segments.find((s) => page.url.pathname === s.href)?.value ?? 'overview'
  );
</script>

<SegmentGroup
  value={current}
  onValueChange={(v) => {
    const seg = segments.find((s) => s.value === v);
    if (seg) goto(seg.href);
  }}
>
  {#each segments as seg}
    <SegmentGroup.Item value={seg.value}>{seg.label}</SegmentGroup.Item>
  {/each}
</SegmentGroup>
```

## Component Selection

| UI Need | Component | When |
|---|---|---|
| 3+ peer sections | `Tab` | Standard horizontal tabs |
| 2-4 compact options | `SegmentGroup` | Tighter visual, pill-style |
| 5+ sections on mobile | `Select` | Dropdown fallback for narrow screens |
| Hierarchical subsections | `Sidebar` | Use `settings-page` pattern instead |

## Behavioral Rules

- The default route (`+page.svelte` at the layout level) is the first/primary tab.
- Active tab is derived from `page.url.pathname`, not from component state — the URL is the source of truth.
- Use `<a href>` for navigation, not `goto()`, to preserve browser history and link behavior.
- Breadcrumbs above the tab bar should show the entity context (e.g., "Projects / My Project"), not the tab name.
- Each tab page should be independently loadable via URL (deep linking).

## Anti-Patterns

- Do not store active tab in `$state` — derive it from the URL. Client-side state and URL will drift.
- Do not use `Tab` with `bind:value` for route-based navigation — use `<a href>` inside tab triggers.
- Do not duplicate the tab bar in every `+page.svelte` — put it in the shared `+layout.svelte`.
- Do not use this pattern for settings with save/cancel — use the `settings-page` pattern with `Sidebar` instead.

## Related

- Pattern: `settings-page` — for hierarchical settings navigation
- Component: `Tab` — the underlying tab component API
- Component: `SegmentGroup` — compact alternative for few sections
