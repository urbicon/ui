export interface EmailTransport {
  send(params: SendEmailParams): Promise<void>;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}
