<script lang="ts">
  import { getMenuContext } from './menu.context';

  const ctx = getMenuContext();
  if (!ctx) {
    throw new Error('MenuDivider must be used inside Menu');
  }
</script>

<!--
  The only `role="separator"` in the Menu family. A labelled group heading must
  not borrow it: two divs a line apart with the same role, one carrying text and
  one empty, is a role collision — MenuSection renders `presentation` + `group`.
-->
<div
  class={ctx.unstyled
    ? (ctx.slotClasses?.divider ?? '')
    : ctx.styles.divider({ class: ctx.slotClasses?.divider })}
  role="separator"
></div>
