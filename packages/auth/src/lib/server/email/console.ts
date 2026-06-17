import type { EmailTransport, SendEmailParams } from './types.js';

export function createConsoleEmailTransport(): EmailTransport {
  return {
    async send(params: SendEmailParams): Promise<void> {
      console.log('--- Email ---');
      console.log(`To: ${params.to}`);
      console.log(`Subject: ${params.subject}`);
      console.log(`HTML: ${params.html}`);
      if (params.text) console.log(`Text: ${params.text}`);
      console.log('--- /Email ---');
    }
  };
}
