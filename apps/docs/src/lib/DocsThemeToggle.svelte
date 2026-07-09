<script lang="ts">
  import { SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';
  import { useAppI18n } from '$lib/i18n';
  import { onMount } from 'svelte';

  const ta = useAppI18n();

  // Storage key + values mirror the head script in app.html: 'rooms' is the
  // shipped default (persisted as the ABSENCE of the key, like ThemeSwitcher's
  // system mode), 'library' is the only explicitly stored deviation.
  const STORAGE_KEY = 'urbicon-docs-theme';
  type Variant = 'rooms' | 'library';

  // SSR renders the shipped default (rooms). The app.html head script has
  // already applied the correct `.docs-rooms` class on <html> from localStorage
  // before first paint, so onMount only syncs this control's active segment — no
  // DOM write here, and no hydration mismatch (the segment flips client-side
  // after mount, exactly like ThemeSwitcher's icon).
  let variant = $state<Variant>('rooms');

  onMount(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'library') variant = 'library';
  });

  // Fires after `bind:value` has already updated `variant`. Toggles the class on
  // <html> (not <body> — the head script can't touch <body>, so we keep the same
  // target here) and persists the choice, dropping the key on rooms so the
  // default stays implicit.
  function persist(next: string) {
    document.documentElement.classList.toggle('docs-rooms', next === 'rooms');
    if (next === 'library') {
      localStorage.setItem(STORAGE_KEY, 'library');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
</script>

<div>
  <span class="text-text-quaternary mb-1.5 block text-xs">
    {ta('chrome.themeVariant.label')}
  </span>
  <SegmentGroup
    bind:value={variant}
    onValueChange={persist}
    size="sm"
    aria-label={ta('chrome.themeVariant.label')}
  >
    <SegmentItem value="rooms">{ta('chrome.themeVariant.rooms')}</SegmentItem>
    <SegmentItem value="library">{ta('chrome.themeVariant.library')}</SegmentItem>
  </SegmentGroup>
</div>
