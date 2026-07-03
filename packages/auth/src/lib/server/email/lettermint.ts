import type { EmailTransport, SendEmailParams } from './types.js';

/** Default request budget; a stalled connection shouldn't hang the caller forever. */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface LettermintConfig {
  /** Lettermint API token, sent in the `x-lettermint-token` header. Required. */
  token: string;
  /**
   * Default sender (optionally `Display Name <addr@example.com>`), used when a
   * send carries no `from` of its own. A per-send `from` always wins. The
   * Lettermint v2 API requires a sender, so a send with neither a per-send nor a
   * configured `from` throws before issuing the request.
   */
  from?: string;
  /**
   * API base URL, without a trailing slash. The send endpoint is `${baseUrl}/send`.
   * @default 'https://api.lettermint.co/v1'
   */
  baseUrl?: string;
  /**
   * Abort the request after this many milliseconds (via `AbortSignal.timeout`),
   * surfaced as an Error so a stalled connection can't hang the caller forever.
   * @default 10000
   */
  timeoutMs?: number;
}

/**
 * Email transport backed by the Lettermint v2 send API. Zero-dependency: uses
 * the native `fetch` (no SDK). POSTs to `${baseUrl}/send` with the token in the
 * `x-lettermint-token` header and a JSON body of
 * `{ from, to: string[], subject, html?, text? }`.
 *
 * The sender resolves from the per-send `from`, falling back to the transport's
 * configured {@link LettermintConfig.from}. The API requires a sender, so a send
 * with neither throws (the auth handlers thread `config.email.from`, so their
 * mails always carry one). The request is bounded by
 * {@link LettermintConfig.timeoutMs}; a timeout and a non-2xx response are both
 * surfaced as an Error (the latter carrying the status + response body).
 */
export function createLettermintTransport(config: LettermintConfig): EmailTransport {
  const token = config.token;
  if (!token) {
    throw new Error('createLettermintTransport: a `token` is required.');
  }
  const baseUrl = config.baseUrl ?? 'https://api.lettermint.co/v1';
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async send(params: SendEmailParams): Promise<void> {
      const from = params.from ?? config.from;
      if (!from) {
        throw new Error(
          'Lettermint requires a sender: pass `from` per-send, set the transport `from`, or configure `config.email.from`.'
        );
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-lettermint-token': token
          },
          body: JSON.stringify({
            from,
            to: [params.to],
            subject: params.subject,
            html: params.html,
            text: params.text
          }),
          signal: AbortSignal.timeout(timeoutMs)
        });
      } catch (err) {
        // AbortSignal.timeout aborts with a DOMException named 'TimeoutError'
        // (which is an `instanceof Error` in Node/Bun); re-surface it with the
        // elapsed budget. Any other fetch/network error propagates untouched.
        if (err instanceof Error && err.name === 'TimeoutError') {
          throw new Error(`Lettermint email timed out after ${timeoutMs}ms`);
        }
        throw err;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Lettermint email failed (${response.status}): ${body}`);
      }
    }
  };
}
