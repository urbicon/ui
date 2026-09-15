<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import changelogMd from 'virtual:changelog';
  import { Badge, Link } from '@urbicon-ui/blocks';
  import { parseChangelog, tokenizeInline } from '$lib/changelog';

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

<SeoMeta
  title="Changelog"
  description="All notable changes to Urbicon UI, organized by version."
  ogType="article"
/>

<div class="mx-auto max-w-3xl px-6 py-12">
  <h1 class="text-text-primary mb-2 text-3xl font-bold tracking-tight">Changelog</h1>
  <p class="text-text-secondary mb-10 text-base">
    All notable changes to Urbicon UI, organized by version.
  </p>

  {#each entries as entry (entry.version)}
    <!-- One region per release, named by its own version heading. The page
         carries 98 of them, and unnamed they are 98 landmark boundaries a
         screen reader announces as nothing. -->
    <section
      class="border-border-subtle mb-8 border-b pb-8 last:border-b-0"
      aria-labelledby="release-{entry.version}"
    >
      <div class="mb-4 flex items-baseline gap-3">
        <h2 id="release-{entry.version}" class="text-text-primary text-xl font-bold">
          {entry.version}
        </h2>
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
                      class="text-2xs mr-1 font-mono">{item.scope}</Badge
                    >
                  {/if}
                  {#each tokenizeInline(item.message) as token, t (t)}
                    {#if token.kind === 'link'}
                      <Link href={token.href} target="_blank" rel="noopener noreferrer"
                        >{token.text}</Link
                      >
                    {:else if token.kind === 'code'}
                      <code class="bg-surface-subtle rounded-modify px-1 font-mono text-xs"
                        >{token.text}</code
                      >
                    {:else}{token.text}{/if}
                  {/each}
                </span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>
  {/each}
</div>
