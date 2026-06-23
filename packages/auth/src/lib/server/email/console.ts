import type { EmailTransport, SendEmailParams } from './types.js';

export function createConsoleEmailTransport(): EmailTransport {
  return {
    async send(params: SendEmailParams): Promise<void> {
      console.log('--- Email ---');
      if (params.from) console.log(`From: ${params.from}`);
      console.log(`To: ${params.to}`);
      console.log(`Subject: ${params.subject}`);
      console.log(`HTML: ${params.html}`);
      if (params.text) console.log(`Text: ${params.text}`);
      console.log('--- /Email ---');
    }
  };
}
