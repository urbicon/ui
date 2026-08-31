<script lang="ts">
  import type { Snippet } from 'svelte';
  import { getMenuContext } from './menu.context';

  // `children` is required rather than optional: a section that renders only a
  // heading has no group for `aria-labelledby` to name, and that shape is what
  // made the same `section` slot announce differently per call form. Requiring
  // the snippet moves the mistake from runtime to `svelte-check`.
  let { label, children }: { label: string; children: Snippet } = $props();
  const ctx = getMenuContext();
  if (!ctx) {
    throw new Error('MenuSection must be used inside Menu');
  }

  // The heading needs a DOM id for `aria-labelledby`, and `$props.id()` is the
  // only source of one that survives SSR → hydration. Prefixed with the menu's
  // root id so two menus on a page stay distinguishable while debugging.
  const propsId = $props.id();
  const headingId = $derived(`${ctx.rootId}-section-${propsId}`);
</script>

<!--
  `role="presentation"`, not `separator`: a non-focusable `separator` takes
  presentational children per ARIA 1.2 — cited from the specification, not
  observed in a screen reader. What is measured here: with the heading a
  `separator`, no element in the panel computed the accessible name "Group A"
  (dom-accessibility-api over the rendered DOM); with it a `presentation`
  element the group references, the group does. `separator` is MenuDivider's.
-->
<div
  id={headingId}
  role="presentation"
  class={ctx.unstyled
    ? (ctx.slotClasses?.section ?? '')
    : ctx.styles.section({ class: ctx.slotClasses?.section })}
>
  {label}
</div>
<!--
  The set boundary ARIA expects around a `menuitemradio` group: without it,
  posinset/setsize are computed over the whole menu, browser-dependently.
  `role="presentation"` on the heading does not stop it labelling the group.
-->
<div
  role="group"
  aria-labelledby={headingId}
  class={ctx.unstyled
    ? (ctx.slotClasses?.group ?? '')
    : ctx.styles.group({ class: ctx.slotClasses?.group })}
>
  {@render children()}
</div>
