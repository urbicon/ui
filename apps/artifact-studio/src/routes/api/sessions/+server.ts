import { error, json } from '@sveltejs/kit';
import { registerSession } from '$lib/server/registry';
import { StudioSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

/** Alle Sitzungen, neueste zuerst. */
export const GET: RequestHandler = () => json(StudioSession.list());

/** Eine neue Sitzung anlegen — holt dabei den Primer aus der echten CLI. */
export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json()) as { title?: string; model?: string; effort?: string };
  const title = body.title?.trim();
  if (!title) error(400, 'title fehlt');

  try {
    const session = await StudioSession.create({
      title,
      ...(body.model ? { model: body.model } : {}),
      ...(body.effort ? { effort: body.effort } : {})
    });
    registerSession(session);
    return json(session.state);
  } catch (e) {
    // Fail-loud bis in die Oberfläche: ein fehlender API-Key oder eine kaputte
    // CLI muss dort stehen, wo jemand hinsieht, nicht nur im Serverlog.
    error(500, e instanceof Error ? e.message : String(e));
  }
};
