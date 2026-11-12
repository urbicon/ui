/**
 * The fixture's scenario — what an app adds to the generic run: the view's
 * own content and buttons, measured against the server rather than the view.
 */
import type { HostScenario, OpenHost } from '@urbicon-ui/mcp-app/testing/host';
import { mcpResult } from '@urbicon-ui/mcp-app/testing/host';
import { FONTS_PATH, GREETING, type Note } from './shared.ts';

const FONT_FAMILY = 'JetBrains Mono';
/** The sentence the host fails the reload with — the fixture's own, not the host's default. */
const RELOAD_DROPPED = 'The fixture has the host drop this reload.';

async function requests(o: OpenHost, method: string) {
  return (await o.state()).viewRequests.filter((request) => request.method === method);
}

const outcome = (o: OpenHost) =>
  o.view.evaluate(() => document.getElementById('outcome')?.textContent ?? null);

async function click(o: OpenHost, name: string): Promise<void> {
  await o.view.getByRole('button', { name }).click();
  await o.view
    .waitForFunction(() => Boolean(document.getElementById('outcome')?.textContent), null, {
      timeout: 5_000
    })
    .catch(() => {});
}

async function clearOutcome(o: OpenHost): Promise<void> {
  await o.view.evaluate(() => {
    const el = document.getElementById('outcome');
    if (el) el.textContent = '';
  });
}

export function fixtureScenario(id: string, origin: string): HostScenario {
  return {
    async beforeResult(o) {
      // The result is still latched (or not yet replayed): the view says it waits.
      const waiting = await o.view
        .waitForFunction(
          () => document.querySelector('[role="status"]')?.textContent === 'Waiting for the note…',
          null,
          { timeout: 3_000 }
        )
        .then(() => true)
        .catch(() => false);
      o.check('fixture:waiting', 'before the result, the view says it waits', waiting);
    },

    async afterResult(o) {
      const { structuredContent } = (await mcpResult(o.endpoint, 'tools/call', {
        name: 'get_note',
        arguments: { id }
      })) as { structuredContent: { note: Note } };
      const expected = structuredContent.note.title;
      const shown = await o.view
        .locator('h1')
        .textContent({ timeout: 10_000 })
        .catch(() => null);
      o.notes.push(`start to title: ${Math.round(performance.now() - o.started)} ms`);
      o.check(
        'fixture:title',
        'the view shows the title of the note',
        shown === expected,
        JSON.stringify({ shown, expected })
      );

      const greeting = await o.view
        .waitForFunction((line) => document.body.textContent?.includes(line), GREETING, {
          timeout: 3_000
        })
        .then(() => true)
        .catch(() => false);
      o.check(
        'fixture:lazy',
        'the dynamically imported module ran (no preload placeholder left)',
        greeting
      );

      const faces = await o.view.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].map((face) => ({
          family: face.family.replace(/["']/g, ''),
          status: face.status
        }));
      });
      o.check(
        'fixture:fonts',
        `${FONT_FAMILY} loads from the app's origin, with 200 and Access-Control-Allow-Origin: *`,
        faces.some((face) => face.family === FONT_FAMILY && face.status === 'loaded') &&
          !faces.some((face) => face.status === 'error') &&
          o.responses.length > 0 &&
          o.responses.every(
            (response) =>
              response.url.startsWith(`${origin}${FONTS_PATH}`) &&
              response.status === 200 &&
              response.cors === '*'
          ),
        JSON.stringify({ faces, responses: o.responses })
      );

      await click(o, 'Open in the app');
      const links = await requests(o, 'ui/open-link');
      o.check(
        'fixture:open-link',
        "“Open in the app” sends ui/open-link with the app's origin from the base meta",
        links.length === 1 && links[0]?.params?.url === `${origin}/notes/${id}`,
        JSON.stringify(links)
      );

      await clearOutcome(o);
      await click(o, 'Ask about it');
      const messages = await requests(o, 'ui/message');
      const content = messages[0]?.params?.content as { type: string; text: string }[] | undefined;
      o.check(
        'fixture:ask',
        '“Ask about it” sends ui/message with content as an array, and the host answers',
        messages.length === 1 &&
          Array.isArray(content) &&
          Boolean(content[0]?.text.includes(expected)) &&
          (await outcome(o)) === 'Asked.',
        JSON.stringify({ messages, outcome: await outcome(o) })
      );

      await clearOutcome(o);
      await click(o, 'Reload');
      const calls = (await requests(o, 'tools/call')).map((request) => request.params?.name);
      const contexts = await requests(o, 'ui/update-model-context');
      o.check(
        'fixture:reload',
        '“Reload” calls get_note through the host and tells the model (ui/update-model-context)',
        JSON.stringify(calls) === '["get_note"]' &&
          contexts.length === 1 &&
          (await outcome(o)) === 'Reloaded.',
        JSON.stringify({ calls, contexts, outcome: await outcome(o) })
      );

      await clearOutcome(o);
      await o.host.failNext('get_note', RELOAD_DROPPED);
      await click(o, 'Reload');
      const failed = {
        outcome: await outcome(o),
        title: await o.view.locator('h1').textContent()
      };
      o.check(
        'fixture:reload-failed',
        "a failed call shows the host's sentence, and the card keeps the note",
        failed.outcome === RELOAD_DROPPED && failed.title === expected,
        JSON.stringify(failed)
      );
    }
  };
}
