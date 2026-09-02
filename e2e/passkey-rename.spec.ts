import { expect, test } from '@playwright/test';

/**
 * The one `<PasskeyManager>` rename assertion jsdom cannot make.
 *
 * A focused element that is given the `disabled` attribute loses focus to
 * `<body>` — a real behaviour of every engine, and one jsdom does not
 * implement. The component's unit suite therefore stayed green while, in a
 * browser, pressing Enter to save dropped the keyboard at the top of the
 * document for the length of the request, and left it there on a refusal. That
 * matters most in the case the rename endpoint introduces: the panel mounted
 * inside a dialog, a `404` coming back, and Escape then closing the dialog
 * instead of the form.
 *
 * Measured before the fix, identically in Chromium and Firefox:
 *   ENTER-out-of-field ["FIELD","BODY","BUTTON(Rename)"]
 *   CLICK-on-Save      ["FIELD","BODY","BUTTON(Rename)"]
 * and after it, focus never reaching BODY.
 *
 * The in-flight window is what this samples, bounded by the rename trigger's
 * own absence rather than by a timeout: the trigger is unmounted for exactly as
 * long as the form is open, so the sampler stops before the row comes back and
 * cannot mistake the one-tick gap at unmount — during which focus legitimately
 * has nowhere to sit, until `focusRenameTrigger` runs — for the defect.
 *
 * It runs against the docs preview's mocked backend (350 ms of latency, see
 * `auth-demo-fetch.ts`), so it needs no auth server and no authenticator.
 */
test.describe('PasskeyManager — renaming keeps the keyboard', () => {
  test('focus never falls to <body> while the rename is in flight', async ({ page }) => {
    await page.goto('/auth/components/passkey-manager');

    const trigger = page.getByRole('button', { name: /^Rename — MacBook Touch ID/ }).first();
    await trigger.waitFor({ state: 'visible' });
    // The trigger's own id is the scope: it is unmounted while its row is being
    // renamed, so "is it back?" answers "is the form still open?" exactly.
    const triggerId = await trigger.getAttribute('id');
    expect(triggerId, 'the rename trigger carries the id the panel focuses back').toBeTruthy();

    await trigger.click();
    const field = page.getByRole('textbox', { name: 'Passkey name' }).first();
    await expect(field).toBeFocused();

    // The field opens with the name selected (typing replaces it), so collapse
    // the selection before appending. ArrowRight and not End: on macOS End
    // scrolls without moving the caret, and the selection survives it.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type(' 2');
    await page.keyboard.press('Enter');

    const trail: string[] = await page.evaluate(async (id) => {
      const seen = new Set<string>();
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && document.getElementById(id as string) === null) {
        const active = document.activeElement;
        seen.add(!active || active === document.body ? 'BODY' : active.tagName);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      return [...seen];
    }, triggerId);

    // Positive control: an empty or one-sample trail would pass the assertion
    // below for the wrong reason.
    expect(trail.length, `sampled nothing: ${JSON.stringify(trail)}`).toBeGreaterThan(0);
    expect(trail, 'focus was dropped to <body> mid-rename').not.toContain('BODY');
    expect(trail, 'the field is what holds focus during the write').toContain('INPUT');

    // And it comes back to the control the user left.
    await expect(page.locator(`#${triggerId}`)).toBeFocused();
    await expect(page.getByText('MacBook Touch ID 2')).toBeVisible();
  });
});
