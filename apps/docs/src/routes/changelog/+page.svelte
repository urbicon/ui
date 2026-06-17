<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import changelogMd from 'virtual:changelog';
  import { Badge } from '@urbicon-ui/blocks';

  interface ChangelogItem {
    scope?: string;
    message: string;
  }

  interface ChangelogGroup {
    name: string;
    items: ChangelogItem[];
  }

  interface ChangelogEntry {
    version: string;
    date: string;
    groups: ChangelogGroup[];
  }

  function parseChangelog(md: string): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];
    const lines = md.split('\n');
    let currentEntry: ChangelogEntry | null = null;
    let currentGroup: ChangelogGroup | null = null;

    for (const line of lines) {
      const versionMatch = line.match(/^## \[(.+?)\]\s*-?\s*([\d-]*)/);
      if (versionMatch) {
        currentEntry = {
          version: versionMatch[1],
          date: versionMatch[2] || '',
          groups: []
        };
        entries.push(currentEntry);
        currentGroup = null;
        continue;
      }

      const groupMatch = line.match(/^### (.+)/);
      if (groupMatch && currentEntry) {
        currentGroup = { name: groupMatch[1], items: [] };
        currentEntry.groups.push(currentGroup);
        continue;
      }

      const itemMatch = line.match(/^- (?:\*\*(.+?)\*\*: )?(.+)/);
      if (itemMatch && currentGroup) {
        currentGroup.items.push({
          scope: itemMatch[1] || undefined,
          message: itemMatch[2]
        });
      }
    }

    return entries;
  }

  const entries = parseChangelog(changelogMd);

  const groupIntents: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
    Features: 'primary',
    'Bug Fixes': 'danger',
    Refactoring: 'warning',
    Performance: 'success',
    Documentation: 'neutral',
    Testing: 'neutral',
    Miscellaneous: 'neutral',
    'CI/CD': 'neutral',
    Build: 'neutral',
    Styling: 'neutral'
  };
</script>

<SeoMeta title="Changelog" />

<div class="mx-auto max-w-3xl px-6 py-12">
  <h1 class="text-text-primary mb-2 text-3xl font-bold tracking-tight">Changelog</h1>
  <p class="text-text-secondary mb-10 text-base">
    All notable changes to Urbicon UI, organized by version.
  </p>

  {#each entries as entry (entry.version)}
    <section class="border-border-subtle mb-8 border-b pb-8 last:border-b-0">
      <div class="mb-4 flex items-baseline gap-3">
        <h2 class="text-text-primary text-xl font-bold">{entry.version}</h2>
        {#if entry.date}
          <span class="text-text-quaternary text-sm">{entry.date}</span>
        {/if}
      </div>

      {#each entry.groups as group (group.name)}
        <div class="mb-4">
          <h3 class="text-text-secondary mb-2 text-sm font-semibold tracking-wide uppercase">
            {group.name}
          </h3>
          <ul class="space-y-1.5">
            {#each group.items as item, i (i)}
              <li class="text-text-secondary flex items-start gap-2 text-sm">
                <span
                  class="text-border-default mt-2 block h-1 w-1 shrink-0 rounded-full bg-current"
                ></span>
                <span>
                  {#if item.scope}
                    <Badge
                      variant="soft"
                      intent={groupIntents[group.name] ?? 'neutral'}
                      size="sm"
                      class="mr-1 font-mono text-[11px]">{item.scope}</Badge
                    >
                  {/if}
                  {item.message}
                </span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>
  {/each}
</div>
