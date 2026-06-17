<script lang="ts">
  import { getMenuContext } from './menu.context';

  const ctx = getMenuContext();
  if (!ctx) {
    throw new Error('MenuDivider must be used inside Menu');
  }
</script>

<div
  class={ctx.unstyled
    ? (ctx.slotClasses?.divider ?? '')
    : ctx.styles.divider({ class: ctx.slotClasses?.divider })}
  role="separator"
></div>
