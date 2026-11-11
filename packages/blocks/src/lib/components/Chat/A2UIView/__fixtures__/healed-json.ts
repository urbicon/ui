/**
 * A stand-in for a host's partial tool arguments: the JSON text cut at `end`,
 * then "best-effort recovery of incomplete JSON, with unclosed structures
 * automatically closed" (MCP Apps, `ui/notifications/tool-input-partial`).
 *
 * Closes an open string and every open object/array; where that still does not
 * parse (a dangling key, a trailing comma, half a `true`), it backs off one
 * character at a time until it does. The result is a freshly parsed object on
 * every call — the property the stabilizer exists for — and its last array
 * item may be cut short yet valid, e.g. a string value missing its end.
 */
export function healedPrefix(text: string, end: number): unknown {
  for (let cut = end; cut >= 0; cut--) {
    const candidate = closeOpen(text.slice(0, cut));
    try {
      return JSON.parse(candidate);
    } catch {
      // back off one character
    }
  }
  throw new Error('no prefix of the text parses, not even the empty one');
}

function closeOpen(prefix: string): string {
  const open: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of prefix) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') open.push('}');
    else if (ch === '[') open.push(']');
    else if (ch === '}' || ch === ']') open.pop();
  }
  return `${prefix}${inString ? '"' : ''}${open.reverse().join('')}`;
}
