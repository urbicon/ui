import { error } from '@sveltejs/kit';
import type { StudioEvent } from '$lib/events';
import { getSession } from '$lib/server/registry';
import type { RequestHandler } from './$types';

/**
 * Ein Wunsch → ein Ereignisstrom.
 *
 * NDJSON statt SSE: der Wunsch geht per POST hin (`EventSource` kann nur GET),
 * und eine Zeile JSON je Ereignis braucht kein Protokoll drumherum. Der Client
 * liest den `ReadableStream` und trennt an `\n`.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const session = getSession(params.id);
  if (!session) error(404, `Keine Sitzung ${params.id}`);

  const body = (await request.json()) as { instruction?: string };
  const instruction = body.instruction?.trim();
  if (!instruction) error(400, 'instruction fehlt');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StudioEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of session.run(instruction)) send(event);
      } catch (e) {
        // Ein Fehler im Generator darf den Strom nicht einfach abreißen lassen —
        // der Client sähe sonst „läuft noch" bis in alle Ewigkeit.
        send({ type: 'error', message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      // Ohne das puffern manche Proxys den Strom bis zum Ende — genau der
      // Effekt, gegen den der ganze Strom gebaut ist.
      'X-Accel-Buffering': 'no'
    }
  });
};
