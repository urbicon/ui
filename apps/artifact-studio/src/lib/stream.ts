/**
 * stream.ts — den Ereignisstrom eines Turns lesen.
 *
 * Der Gegenpart zu `api/sessions/[id]/turn`: NDJSON über einen `fetch`-Body.
 * Die einzige Feinheit ist der Zeilenpuffer — ein Chunk endet nicht zwingend an
 * einer Zeilengrenze, und eine halbe JSON-Zeile zu parsen wirft.
 */
import type { StudioEvent } from './events';

export async function* runTurn(
  sessionId: string,
  instruction: string,
  signal?: AbortSignal
): AsyncGenerator<StudioEvent> {
  const response = await fetch(`/api/sessions/${sessionId}/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ instruction }),
    ...(signal ? { signal } : {})
  });

  if (!response.ok || !response.body) {
    yield { type: 'error', message: `${response.status} ${await response.text()}` };
    return;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    // Die letzte Zeile kann unvollständig sein — sie bleibt im Puffer.
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line) as StudioEvent;
    }
  }
  if (buffer.trim()) yield JSON.parse(buffer) as StudioEvent;
}
