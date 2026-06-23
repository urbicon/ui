export interface EmailTransport {
  send(params: SendEmailParams): Promise<void>;
}

export interface SendEmailParams {
  /**
   * Sender address (optionally `Display Name <addr@example.com>`). When omitted,
   * the transport falls back to its own configured default (e.g. a Lettermint
   * verified sender or the console transport's placeholder). Handlers resolve it
   * from `config.email.from` so every outbound mail can carry a consistent
   * From — see {@link EmailConfig}.
   */
  from?: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}
