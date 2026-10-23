<script lang="ts">
  import { useBlocksI18n } from '#lib';
  import { createSlotHelper, getCalendarContext } from './calendar.context';

  const bt = useBlocksI18n();

  interface CalendarLegendInternalProps {
    orientation?: 'horizontal' | 'vertical';
    class?: string;
  }

  let { orientation = 'horizontal', class: className = '' }: CalendarLegendInternalProps = $props();

  const ctx = getCalendarContext();
  const slot = createSlotHelper(ctx);
</script>

{#if ctx.categories.length > 0}
  <!-- biome-ignore lint/a11y/useSemanticElements: a ul styled list-style: none loses its list role in WebKit unless the role is repeated; the div states it once -->
  <div
    class="{slot('legend', className)} {orientation === 'vertical' ? 'flex-col items-start' : ''}"
    role="list"
    aria-label={bt('calendar.legend')}
  >
    {#each ctx.categories as category (category.id)}
      <!-- biome-ignore lint/a11y/useSemanticElements: an li outside a ul is invalid, and the list is a div (see the role=list above) -->
      <div class={slot('legendItem')} role="listitem">
        <span
          class={slot('legendDot')}
          style="background-color: {category.color}"
          aria-hidden="true"
        ></span>
        <span class={slot('legendLabel')}>{category.label}</span>
      </div>
    {/each}
  </div>
{/if}
