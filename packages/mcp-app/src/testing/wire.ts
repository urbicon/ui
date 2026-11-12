/**
 * The wire between view and host, checked the way a host checks it: with the
 * Zod schemas of `@modelcontextprotocol/ext-apps` and the MCP SDK.
 *
 * **The spec text is not the oracle here.** The spec (2026-01-26 and draft)
 * shows `ui/message` with an object as `content`, the SDK's types
 * (`spec.types.ts`) an array of content blocks, and Claude rejects the object
 * with "Invalid params for ui/message: content: Invalid input: expected array,
 * received object" — the sentence `McpUiMessageRequestSchema` of 1.7.5
 * produces, which `wire.test.ts` pins. The peer is pinned exactly for that
 * reason.
 */
import * as apps from '@modelcontextprotocol/ext-apps/app-bridge';
import * as sdk from '@modelcontextprotocol/sdk/types.js';

type Issue = { path: PropertyKey[]; message: string };
type Schema = {
  safeParse(value: unknown): { success: true } | { success: false; error: { issues: Issue[] } };
};

/** The method name of a schema, when it is a request or notification with a fixed name. */
function methodOf(schema: unknown): string | undefined {
  const method = (schema as { shape?: { method?: { value?: unknown } } })?.shape?.method?.value;
  return typeof method === 'string' ? method : undefined;
}

/**
 * Requests, notifications and results by method — derived from the exports,
 * not copied: `XRequestSchema` carries its method, its result is called
 * `XResultSchema`. ext-apps first; the two share no name.
 */
function tables() {
  const requests = new Map<string, Schema>();
  const notifications = new Map<string, Schema>();
  const results = new Map<string, Schema>();
  for (const mod of [apps, sdk] as Record<string, unknown>[]) {
    for (const [name, schema] of Object.entries(mod)) {
      const method = methodOf(schema);
      if (!method) continue;
      if (name.endsWith('RequestSchema') && !requests.has(method)) {
        requests.set(method, schema as Schema);
        const result = mod[name.replace(/RequestSchema$/, 'ResultSchema')];
        if (result) results.set(method, result as Schema);
      } else if (name.endsWith('NotificationSchema') && !notifications.has(method)) {
        notifications.set(method, schema as Schema);
      }
    }
  }
  // These two answer `{}` in the SDK and have no result schema of their own
  // (`App.updateModelContext`, `Protocol.ping`: `EmptyResultSchema`).
  for (const method of ['ping', 'ui/update-model-context']) {
    if (!results.has(method)) results.set(method, sdk.EmptyResultSchema as Schema);
  }
  return { requests, notifications, results };
}

const { requests, notifications, results } = tables();

function issues(schema: Schema, value: unknown, prefix: string[]): string | null {
  const parsed = schema.safeParse(value);
  if (parsed.success) return null;
  return parsed.error.issues
    .map((issue) => {
      const path = issue.path.map(String);
      const rel = prefix.every((p, i) => path[i] === p) ? path.slice(prefix.length) : path;
      return rel.length > 0 ? `${rel.join('.')}: ${issue.message}` : issue.message;
    })
    .join('; ');
}

/**
 * What a host would object to in this message — as a sentence, `null` when it
 * passes. For an answer, `answers` names the method of the request it answers
 * (the answer itself carries none).
 */
export function wireProblem(message: unknown, answers?: string): string | null {
  if (typeof message !== 'object' || message === null) return 'not a JSON-RPC message';
  const m = message as { method?: unknown; id?: unknown; error?: unknown; result?: unknown };
  if (typeof m.method === 'string') {
    const isRequest = m.id !== undefined;
    const envelope = isRequest ? sdk.JSONRPCRequestSchema : sdk.JSONRPCNotificationSchema;
    const wrapped = issues(envelope as Schema, message, []);
    if (wrapped) return `${m.method}: ${wrapped}`;
    const schema = (isRequest ? requests : notifications).get(m.method);
    if (!schema) {
      return `no schema knows the ${isRequest ? 'request' : 'notification'} ${m.method}`;
    }
    const problem = issues(schema, message, ['params']);
    return problem ? `Invalid params for ${m.method}: ${problem}` : null;
  }
  if ('error' in m) {
    const problem = issues(sdk.JSONRPCErrorResponseSchema as Schema, message, []);
    return problem ? `Error response: ${problem}` : null;
  }
  const envelope = issues(sdk.JSONRPCResultResponseSchema as Schema, message, []);
  if (envelope) return `Response: ${envelope}`;
  if (!answers) return 'response without a request';
  const schema = results.get(answers);
  if (!schema) return `no schema knows the result of ${answers}`;
  const problem = issues(schema, m.result, []);
  return problem ? `Invalid result for ${answers}: ${problem}` : null;
}
