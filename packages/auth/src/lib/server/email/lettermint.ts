import type { EmailTransport, SendEmailParams } from './types.js';

export interface LettermintConfig {
  apiKey: string;
  baseUrl?: string;
}

export function createLettermintTransport(config: LettermintConfig): EmailTransport {
  const baseUrl = config.baseUrl ?? 'https://api.lettermint.co';

  return {
    async send(params: SendEmailParams): Promise<void> {
      const response = await fetch(`${baseUrl}/v1/emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          to: params.to,
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
