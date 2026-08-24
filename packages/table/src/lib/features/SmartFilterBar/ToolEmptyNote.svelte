<script lang="ts">
  import { useTableI18n } from '$lib';
  import type { ToolEmptyKey } from './tool-columns';

  /**
   * The sheet half of the empty-state policy: what a tool section shows in
   * place of controls it has nothing to build (#254).
   *
   * It takes the key rather than the sentence, so the five panels do not each
   * translate their own — `toolEmptyKey` picks which axis speaks and this turns
   * it into words, once. The bar half is MenuTrigger's `unavailable`, which
   * needs the string itself for `title` and the accessible name.
   *
   * A paragraph, not an empty control: the section keeps its place in the
   * accordion (the reader's other four tools must not move) and says why it is
   * not offering anything, which is the thing an option-less listbox never did.
   */
  let { reason }: { reason: ToolEmptyKey } = $props();

  const tt = useTableI18n();
</script>

<p class="text-text-secondary text-sm">{tt(reason)}</p>
