import { createHighlighter, type Highlighter } from 'shiki';
import { editorialDark, editorialLight } from './shiki-editorial-themes';

class HighlighterService {
  private highlighter: Highlighter | null = null;
  private initPromise: Promise<Highlighter> | null = null;
  private isInitialized = false;

  async getHighlighter(): Promise<Highlighter> {
    if (this.highlighter) {
      return this.highlighter;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.initializeHighlighter();
    this.highlighter = await this.initPromise;

    if (!this.isInitialized && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.dispose());
      this.isInitialized = true;
    }

    return this.highlighter;
  }

  private async initializeHighlighter(): Promise<Highlighter> {
    return createHighlighter({
      themes: [editorialLight, editorialDark],
      langs: ['svelte', 'typescript', 'javascript', 'css', 'html', 'bash', 'json', 'toml', 'ini']
    });
  }

  async highlightCode(code: string, language: string): Promise<string> {
    const timeoutMs = 1500;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('shiki-timeout')), timeoutMs)
    );
    try {
      const highlighter = await Promise.race([this.getHighlighter(), timeout]);
      return (highlighter as Highlighter).codeToHtml(code, {
        lang: language,
        themes: {
          light: 'editorial-light',
          dark: 'editorial-dark'
        }
      });
    } catch {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<pre><code>${escaped}</code></pre>`;
    }
  }

  dispose(): void {
    if (this.highlighter) {
      this.highlighter.dispose();
      this.highlighter = null;
      this.initPromise = null;
    }
  }
}

export const highlighterService = new HighlighterService();
