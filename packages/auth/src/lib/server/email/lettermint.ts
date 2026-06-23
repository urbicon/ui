import type { EmailTransport, SendEmailParams } from './types.js';

export interface LettermintConfig {
  /**
   * Lettermint API token, sent in the `x-lettermint-token` header. `token` is
   * the canonical name; `apiKey` is kept as a back-compat alias (when both are
   * set, `token` wins). One of the two is required.
   */
  token?: string;
  /** Back-compat alias for {@link LettermintConfig.token}. */
  apiKey?: string;
  /**
   * API base URL, without a trailing slash. The send endpoint is `${baseUrl}/send`.
   * @default 'https://api.lettermint.co/v1'
   */
  baseUrl?: string;
}

/**
 * Email transport backed by the Lettermint v2 send API. Zero-dependency: uses
 * the native `fetch` (no SDK). POSTs to `${baseUrl}/send` with the token in the
 * `x-lettermint-token` header and a JSON body of
 * `{ from, to: string[], subject, html?, text? }`.
 *
 * `from` is required by the API: pass it per-send (the auth handlers thread
 * `config.email.from` automatically) or the request will be rejected by
 * Lettermint. A non-2xx response is read and surfaced as an Error carrying the
 * status + response body.
 */
export function createLettermintTransport(config: LettermintConfig): EmailTransport {
  const token = config.token ?? config.apiKey;
  if (!token) {
    throw new Error('createLettermintTransport: a `token` (or its `apiKey` alias) is required.');
  }
  const baseUrl = config.baseUrl ?? 'https://api.lettermint.co/v1';

  return {
    async send(params: SendEmailParams): Promise<void> {
      const response = await fetch(`${baseUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-lettermint-token': token
        },
        body: JSON.stringify({
          from: params.from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text
        })
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Lettermint email failed (${response.status}): ${body}`);
      }
    }
  };
}
