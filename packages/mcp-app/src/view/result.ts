import type { CallToolResult } from './bridge.ts';

/**
 * The sentence of an error result — its first non-empty text block, trimmed,
 * or `fallback`.
 *
 * A server may put a second block after it with a hint for the model (which
 * tool to call next); the view shows the first sentence instead of making up
 * its own, and leaves the hint to the model that reads both.
 */
export function problemOf(result: CallToolResult, fallback: string): string {
  const first = result.content.find(
    (block) => block.type === 'text' && typeof block.text === 'string' && block.text.trim()
  );
  return typeof first?.text === 'string' ? first.text.trim() : fallback;
}
