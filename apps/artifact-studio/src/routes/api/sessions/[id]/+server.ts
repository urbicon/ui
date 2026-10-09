import { error } from '@sveltejs/kit';
import { getSession } from '#lib/server/registry.js';
import type { RequestHandler } from './$types';

/** Der Zustand einer Sitzung — Versionen, Modell, ob gerade ein Turn läuft. */
export const GET: RequestHandler = ({ params }) => {
  const session = getSession(params.id);
  if (!session) error(404, `Keine Sitzung ${params.id}`);
  return Response.json(session.state);
};
