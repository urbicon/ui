import { describe, expect, it } from 'vitest';
import {
  HREF_FREE_CONTROLS,
  LINK_AS_BUTTON,
  LINK_AS_BUTTON_TITLE,
  linkRecipeNote
} from './link-as-button.js';

describe('link as button', () => {
  it('the note names the variants function the block demonstrates, for every control listed', () => {
    // Two pieces of prose about one recipe: the note is what a component entry
    // prints, the block is what the primer prints. Each name in the table has to
    // reach both, or the note sends an agent to a block that never mentions it.
    expect(Object.keys(HREF_FREE_CONTROLS).length).toBeGreaterThan(0);
    for (const [component, fn] of Object.entries(HREF_FREE_CONTROLS)) {
      const note = linkRecipeNote(component);
      expect(note, component).toContain('`href`');
      expect(note, component).toContain(`\`${fn}(`);
      expect(LINK_AS_BUTTON, component).toContain(`${fn}(`);
    }
  });

  it('the note points at the heading the primer prints the block under', () => {
    expect(linkRecipeNote('Button')).toContain(LINK_AS_BUTTON_TITLE);
    expect(linkRecipeNote('Button')).toContain('urbicon primer');
    expect(LINK_AS_BUTTON).toContain(`# ${LINK_AS_BUTTON_TITLE}`);
  });

  it('says nothing for a component the rule does not name', () => {
    // `Card` takes `href` by design (it owns structure); `Input` is not a control
    // a link would borrow a look from. Neither may be handed the sentence.
    expect(linkRecipeNote('Card')).toBeUndefined();
    expect(linkRecipeNote('Input')).toBeUndefined();
  });

  it('the block ends on the wrapper, and the wrapper is an anchor', () => {
    expect(LINK_AS_BUTTON).toContain('```svelte');
    expect(LINK_AS_BUTTON).toMatch(/<a \{href\}[^>]*class=\{buttonVariants\(/);
    // The element, not the word: the wrapper's own prop type is `Pick<ButtonProps,
    // …>`, so a bare substring test for `<Button` matches the type and passes on a
    // block that does render the component.
    expect(LINK_AS_BUTTON).not.toMatch(/<Button[\s/>]/);
  });
});
