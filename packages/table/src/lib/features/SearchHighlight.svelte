<script lang="ts">
  import { splitSearchSegments } from '$lib/utils';

  let {
    text = '',
    searchTerm = '',
    highlightClass = 'table-search-highlight'
  }: {
    text: string;
    searchTerm?: string;
    highlightClass?: string;
  } = $props();

  let segments = $derived(splitSearchSegments(text, searchTerm));
</script>

<span class="inline"
  >{#each segments as segment, i (i)}{#if segment.highlighted}<mark class={highlightClass}
        >{segment.text}</mark
      >{:else}{segment.text}{/if}{/each}</span
>
