import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { createMockUser } from '../../server/test-utils.js';
import AccountSettings from './AccountSettings/AccountSettings.svelte';
import RegisterPage from './RegisterPage/RegisterPage.svelte';
import ResetPasswordPage from './ResetPasswordPage/ResetPasswordPage.svelte';

/**
 * The checklist must be in the DOM on the FIRST paint, not from the first
 * keystroke. A description attached to an already-focused field is not
 * reliably re-announced, and there is deliberately no live region here (it
 * would fire on every keystroke), so rules that appear only after typing are
 * rules a screen-reader user never hears.
 *
 * `svelte/server`'s `render` is the cheapest oracle for that: no DOM, no
 * interaction, just the markup a user meets before touching the field.
 */
const user = createMockUser();

const cases = [
  [
    'RegisterPage',
    (props: Record<string, unknown>) => render(RegisterPage, { props: { token: '', ...props } })
  ],
  [
    'ResetPasswordPage',
    (props: Record<string, unknown>) =>
      render(ResetPasswordPage, { props: { token: '', ...props } })
  ],
  [
    'AccountSettings',
    (props: Record<string, unknown>) => render(AccountSettings, { props: { user, ...props } })
  ]
] as const;

describe.each(cases)(
  '%s renders the password rules before the field is touched',
  (_name, mount) => {
    it('has the list in the DOM and the field pointing at it', () => {
      const { body } = mount({});
      const list = body.match(/<ul id="([^"]+)"[^>]*aria-label="Password requirements"/);
      expect(list, 'the checklist must exist with an empty password field').not.toBeNull();
      expect(body).toContain(`aria-describedby="${list?.[1]}"`);
      // The default policy carries one rule, and it renders as unmet.
      expect(body).toContain('aria-label="Not met"');
    });

    it('drops both the list and the description when the checklist is switched off', () => {
      // Positive control on the oracle: the assertion above must be able to fail.
      const { body } = mount({ showRequirements: false });
      expect(body).not.toContain('aria-label="Password requirements"');
      expect(body).not.toContain('aria-describedby="');
    });
  }
);
