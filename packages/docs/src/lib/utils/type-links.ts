/**
 * Segment of a rendered TypeScript type expression.
 * `linked` marks an identifier that exactly matches a known type entry and
 * should be rendered as a cross-reference; everything else is plain text.
 */
export interface TypeSegment {
  text: string;
  linked: boolean;
}

/**
 * Matches, in priority order: single-/double-/backtick-quoted string literals
 * (consumed whole so their contents can never be mistaken for a type name),
 * then a bare TypeScript identifier.
 */
const SCAN = /'[^']*'|"[^"]*"|`[^`]*`|[A-Za-z_$][A-Za-z0-9_$]*/g;

/** True when the identifier at `start` is a member access (`Foo.Bar` — `Bar` is not a top-level type). */
function isMemberAccess(expression: string, start: number): boolean {
  return start > 0 && expression[start - 1] === '.';
}

/**
 * True when the identifier ending at `end` sits in a label position — a property or
 * parameter name rather than a type reference: `{ item: T }`, `(e: MouseEvent) => void`,
 * `Snippet<[item: T]>`, `label?: string`.
 */
function isLabelPosition(expression: string, end: number): boolean {
  let i = end;
  while (i < expression.length && /\s/.test(expression[i])) i++;
  if (expression[i] === '?') {
    i++;
    while (i < expression.length && /\s/.test(expression[i])) i++;
  }
  return expression[i] === ':';
}

/**
 * Splits a TypeScript type expression into plain-text and linkable segments.
 *
 * Only whole identifiers that are an **exact** match for a known type name are linked —
 * never a substring (`string` inside `MyString` is one token and will not match), never
 * the contents of a string literal (`'sm' | 'md'`), never a member access (`Foo.Bar`),
 * and never a property/parameter label (`item` in `Snippet<[item: T]>`). Identifiers
 * nested inside generics are linked (`ToasterSlots` in `Partial<Record<ToasterSlots, string>>`).
 *
 * Anything not positively identified stays plain text: an unlinked type is the
 * expected, correct outcome — a wrong link is not.
 */
export function tokenizeTypeExpression(
  expression: string | undefined,
  knownTypeNames: Iterable<string>
): TypeSegment[] {
  if (!expression) return [];

  const known = knownTypeNames instanceof Set ? knownTypeNames : new Set(knownTypeNames);
  if (known.size === 0) return [{ text: expression, linked: false }];

  const segments: TypeSegment[] = [];
  let lastIndex = 0;

  SCAN.lastIndex = 0;
  let match = SCAN.exec(expression);
  while (match !== null) {
    const token = match[0];
    const start = match.index;
    const end = SCAN.lastIndex;

    const isIdentifier = /^[A-Za-z_$]/.test(token);
    if (
      isIdentifier &&
      known.has(token) &&
      !isMemberAccess(expression, start) &&
      !isLabelPosition(expression, end)
    ) {
      if (start > lastIndex) {
        segments.push({ text: expression.slice(lastIndex, start), linked: false });
      }
      segments.push({ text: token, linked: true });
      lastIndex = end;
    }

    match = SCAN.exec(expression);
  }

  if (lastIndex < expression.length) {
    segments.push({ text: expression.slice(lastIndex), linked: false });
  }

  return segments;
}
