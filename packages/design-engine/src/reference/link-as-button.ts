/**
 * A link that looks like a button: the rule and the recipe, authored once so the
 * primer and a component's entry — the `llm.txt` that `urbicon get-component`
 * and the MCP `get_component` both serve — state one answer. The contract is
 * docs/COMPONENT-API-CONVENTIONS.md § Polymorphic Elements: a component takes
 * `href` only where it owns structure an `<a>` could not rebuild from the
 * exported variants function alone.
 */

/**
 * The controls a link is asked to look like, each with the variants function an
 * anchor borrows that look from. None of them takes `href` — that is the rule
 * the note below carries — and a component entry gets the note exactly when its
 * name is a key here.
 */
export const HREF_FREE_CONTROLS: Readonly<Record<string, string>> = {
  Button: 'buttonVariants',
  Badge: 'badgeVariants'
};

/** The heading the primer prints the block under — what the note points at. */
export const LINK_AS_BUTTON_TITLE = 'A link that looks like a button';

/**
 * One sentence for a component entry, or `undefined` for a component the rule
 * does not name. Appended at render time — never written into the JSDoc, which
 * would make it a second copy of the recipe.
 */
export function linkRecipeNote(component: string): string | undefined {
  const fn = HREF_FREE_CONTROLS[component];
  if (!fn) return undefined;
  return `Takes no \`href\`. A link that should look like a ${component} is an \`<a>\` with \`${fn}({ … }).base()\` on it — the recipe in \`urbicon primer\` under "${LINK_AS_BUTTON_TITLE}".`;
}

/**
 * The block for the primer: the rule, then the wrapper it comes down to.
 *
 * The wrapper exists three times over — here, in
 * docs/COMPONENT-API-CONVENTIONS.md § Polymorphic Elements, and on the Button
 * documentation page (`apps/docs`, which does not depend on this package, so
 * neither can derive from the other). Edit one, edit all three.
 */
export const LINK_AS_BUTTON = `# ${LINK_AS_BUTTON_TITLE}

\`Button\` and \`Badge\` never take \`href\` — a link in a button's clothes is an \`<a>\` wearing the exported variants function. \`Card\` does take one, because it owns structure (header · content · footer) an anchor could not rebuild; a link that is only a link belongs to the Navigation family's \`Link\` (planned). Keep the wrapper in your app: internal-vs-external URL, \`resolve()\`, \`target\`/\`rel\` are routing decisions the library cannot see.

\`\`\`svelte
<!-- LinkButton.svelte -->
<script lang="ts">
  import { buttonVariants, type ButtonProps } from '@urbicon-ui/blocks';
  import type { HTMLAnchorAttributes } from 'svelte/elements';

  let {
    href,
    intent = 'neutral',
    variant = 'filled',
    size = 'md',
    class: className,
    children,
    ...rest
  }: HTMLAnchorAttributes & Pick<ButtonProps, 'intent' | 'variant' | 'size' | 'class'> = $props();
</script>

<a {href} class={buttonVariants({ intent, variant, size }).base({ class: className })} {...rest}>
  {@render children?.()}
</a>
\`\`\`

The same call with \`badgeVariants()\` gives an anchor the Badge look.
`;
