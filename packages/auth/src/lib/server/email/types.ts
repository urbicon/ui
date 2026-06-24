export interface EmailTransport {
  send(params: SendEmailParams): Promise<void>;
}

export interface SendEmailParams {
  /**
   * Sender address (optionally `Display Name <addr@example.com>`). A per-send
   * `from` always wins; when omitted, a transport may fall back to its own
   * configured default (e.g. the Lettermint transport's `from`). Handlers resolve
   * it from `config.email.from` — see {@link EmailConfig} — so every outbound mail
   * carries a consistent From. Transports that require a sender (Lettermint) throw
   * when neither a per-send nor a configured `from` is set.
   */
  from?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}
