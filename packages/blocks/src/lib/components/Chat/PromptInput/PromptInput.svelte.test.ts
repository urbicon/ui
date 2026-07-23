// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptInputProps } from './index';
import PromptInput from './PromptInput.svelte';

// Interaction layer for the chat composer — the submit contract (key gestures,
// IME guard, trim + clear), the busy → stop swap, and the attachment intake it
// borrows from the shared file-intake core (paste/remove/reject). Same stack as
// the CodeBlock/StreamingMarkdown pilots: Svelte's own mount/unmount,
// @testing-library/dom, native vitest matchers. useBlocksI18n is read-tolerant,
// so rejection texts resolve to the base (en) locale without a provider.
//
// URL.createObjectURL / revokeObjectURL are not implemented in jsdom, so we stub
// them per the intake core's preview-URL lifecycle.

const createObjectURL = vi.fn(() => 'blob:mock-preview');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  // Keep the real URL constructor (new URL(...)) — only stub the two statics.
  vi.stubGlobal('URL', Object.assign(globalThis.URL, { createObjectURL, revokeObjectURL }));
});

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function render(initial: Partial<PromptInputProps> = {}) {
  const props = $state<PromptInputProps>({ onSubmit: () => {}, ...initial } as PromptInputProps);
  const instance = mount(PromptInput, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
  return props;
}

const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const sendButton = () => screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;

// Dispatch a real KeyboardEvent so `isComposing` / `keyCode` init survive
// (jsdom honors both on the constructor). Returns whether the event was NOT
// canceled — false means the component called preventDefault (i.e. it submitted).
function pressKey(el: Element, init: KeyboardEventInit & { keyCode?: number }) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...init
  });
  const notCanceled = el.dispatchEvent(event);
  flushSync();
  return notCanceled;
}

function pasteFiles(el: Element, files: File[]) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files } });
  el.dispatchEvent(event);
  flushSync();
}

const imageFile = (name = 'photo.png') => new File(['x'], name, { type: 'image/png' });

describe('PromptInput (composer interaction)', () => {
  it('submits trimmed text on Enter and clears the value', () => {
    const onSubmit = vi.fn();
    const props = render({ value: '  hello world  ', onSubmit });

    const canceled = !pressKey(textarea(), {});

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ text: 'hello world', attachments: [] });
    expect(canceled).toBe(true); // preventDefault ran — no newline inserted.
    expect(props.value).toBe(''); // clearOnSubmit default.
  });

  it('does not submit on Shift+Enter (inserts a newline instead)', () => {
    const onSubmit = vi.fn();
    render({ value: 'draft', onSubmit });

    const notCanceled = pressKey(textarea(), { shiftKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(notCanceled).toBe(true); // default not prevented → newline.
  });

  it('never submits while an IME composition is in progress', () => {
    const onSubmit = vi.fn();
    render({ value: 'こんにちは', onSubmit });

    const notCanceled = pressKey(textarea(), { isComposing: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(notCanceled).toBe(true);
  });

  it('honors the keyCode 229 IME fallback', () => {
    const onSubmit = vi.fn();
    render({ value: 'draft', onSubmit });

    const notCanceled = pressKey(textarea(), { keyCode: 229 });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(notCanceled).toBe(true);
  });

  describe('mod-enter mode', () => {
    it('lets plain Enter insert a newline (no submit)', () => {
      const onSubmit = vi.fn();
      render({ value: 'draft', submitOn: 'mod-enter', onSubmit });

      const notCanceled = pressKey(textarea(), {});

      expect(onSubmit).not.toHaveBeenCalled();
      expect(notCanceled).toBe(true);
    });

    it('submits on Ctrl+Enter', () => {
      const onSubmit = vi.fn();
      render({ value: 'draft', submitOn: 'mod-enter', onSubmit });

      const canceled = !pressKey(textarea(), { ctrlKey: true });

      expect(onSubmit).toHaveBeenCalledWith({ text: 'draft', attachments: [] });
      expect(canceled).toBe(true);
    });
  });

  it('disables send and refuses submit when there is no text and no attachments', () => {
    const onSubmit = vi.fn();
    render({ value: '   ', onSubmit });

    expect(sendButton().disabled).toBe(true);

    fireEvent.click(sendButton());
    pressKey(textarea(), {});

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('replaces send with a stop button while busy, fires onStop, and blocks Enter submit', () => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    render({ value: 'in-flight', busy: true, onSubmit, onStop });

    // Send is gone; stop is shown.
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    const stop = screen.getByRole('button', { name: 'Stop' });

    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);

    // Enter must not submit while a response is streaming.
    pressKey(textarea(), {});
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('adds a chip when an image file is pasted', () => {
    render({ allowAttachments: true });

    pasteFiles(textarea(), [imageFile('shot.png')]);

    // The chip strip renders the file name + a preview image sourced from the stub URL.
    expect(screen.getByText('shot.png')).toBeTruthy();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const img = document.querySelector('img');
    expect(img?.getAttribute('src')).toBe('blob:mock-preview');
    // A pasted attachment enables submit even with empty text.
    expect(sendButton().disabled).toBe(false);
  });

  it('revokes the preview and fires no submit when a chip is removed', () => {
    const onSubmit = vi.fn();
    render({ allowAttachments: true, onSubmit });

    pasteFiles(textarea(), [imageFile('doc.png')]);
    expect(screen.getByText('doc.png')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove doc.png' }));
    flushSync();

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview');
    expect(screen.queryByText('doc.png')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('surfaces the first rejection inline and calls onAttachmentReject when maxFiles is exceeded', () => {
    const onAttachmentReject = vi.fn();
    render({ allowAttachments: true, maxFiles: 1, onAttachmentReject });

    // One paste with two files: the first is accepted, the second overflows maxFiles.
    pasteFiles(textarea(), [imageFile('a.png'), imageFile('b.png')]);

    expect(onAttachmentReject).toHaveBeenCalledTimes(1);
    const rejections = onAttachmentReject.mock.calls[0][0];
    expect(rejections).toHaveLength(1);
    expect(rejections[0].errors[0].code).toBe('TOO_MANY_FILES');

    // Inline error line, announced via role=status, carries the first message.
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Maximum 1 files allowed');

    // The accepted file still made it in.
    expect(screen.getByText('a.png')).toBeTruthy();
  });

  it('clears the inline error on the next successful add', () => {
    render({ allowAttachments: true, maxFiles: 1 });

    pasteFiles(textarea(), [imageFile('a.png'), imageFile('b.png')]);
    expect(screen.getByRole('status').textContent).toBe('Maximum 1 files allowed');

    // Remove the accepted one, then add a fresh single file — error must clear.
    // The status region is permanently rendered (A6), so it stays in the DOM
    // with empty text rather than being removed.
    fireEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    flushSync();
    pasteFiles(textarea(), [imageFile('c.png')]);

    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.getByText('c.png')).toBeTruthy();
  });

  // ── A6: live region is permanently present ─────────────────────────────────
  it('keeps the status region in the DOM even with no error (permanent live region)', () => {
    render({ allowAttachments: true });
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(status.className).toContain('sr-only'); // collapsed, reserves no layout
  });

  // ── A1: busy Enter is not swallowed ────────────────────────────────────────
  it('does not swallow Enter while busy — no submit AND no preventDefault (newline allowed)', () => {
    const onSubmit = vi.fn();
    render({ value: 'still typing', busy: true, submitOn: 'enter', onSubmit });

    const notCanceled = pressKey(textarea(), {});

    expect(onSubmit).not.toHaveBeenCalled();
    // The keystroke must fall through so the textarea inserts a newline.
    expect(notCanceled).toBe(true);
  });

  // ── A3: text-selection drops fall through ──────────────────────────────────
  it('does not preventDefault a drop that carries no files (text drop falls through)', () => {
    render({ allowAttachments: true });

    const event = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [] } });
    const notCanceled = textarea().dispatchEvent(event);
    flushSync();

    expect(notCanceled).toBe(true); // default not prevented → native text insert.
  });

  // ── A4: stale error cleared on every submit, independent of clearOnSubmit ───
  it('clears the inline error on submit even when clearOnSubmit is false', () => {
    render({ allowAttachments: true, maxFiles: 1, clearOnSubmit: false });

    // Provoke a rejection (second file overflows maxFiles).
    pasteFiles(textarea(), [imageFile('a.png'), imageFile('b.png')]);
    expect(screen.getByRole('status').textContent).toBe('Maximum 1 files allowed');

    // The accepted attachment keeps send enabled; submitting must clear the error.
    fireEvent.click(sendButton());
    flushSync();

    expect(screen.getByRole('status').textContent).toBe('');
  });

  // ── A5: onSubmit gets a fresh array each time (no aliasing) ─────────────────
  it('hands onSubmit a shallow copy of attachments — distinct references per submit', () => {
    const onSubmit = vi.fn();
    render({ allowAttachments: true, clearOnSubmit: false, onSubmit });

    pasteFiles(textarea(), [imageFile('a.png')]);

    fireEvent.click(sendButton());
    fireEvent.click(sendButton());

    expect(onSubmit).toHaveBeenCalledTimes(2);
    const first = onSubmit.mock.calls[0][0].attachments;
    const second = onSubmit.mock.calls[1][0].attachments;
    expect(first).not.toBe(second); // not the same array reference…
    expect(second).toEqual(first); // …but equal content.
  });

  // ── A7: focus is moved deterministically after chip removal ────────────────
  it('moves focus to the remaining chip, then to the textarea, when chips are removed', async () => {
    render({ allowAttachments: true });

    pasteFiles(textarea(), [imageFile('a.png'), imageFile('b.png')]);
    expect(screen.getByText('a.png')).toBeTruthy();
    expect(screen.getByText('b.png')).toBeTruthy();

    // Remove the first chip → focus lands on the (now-first) remaining chip's
    // remove button.
    fireEvent.click(screen.getByRole('button', { name: 'Remove a.png' }));
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove b.png' }));
    });

    // Remove the last remaining chip → focus falls back to the textarea.
    fireEvent.click(screen.getByRole('button', { name: 'Remove b.png' }));
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(textarea());
    });
  });

  it('reflects the active submit mode in aria-keyshortcuts', () => {
    render({ submitOn: 'enter' });
    expect(textarea().getAttribute('aria-keyshortcuts')).toBe('Enter');

    dispose?.();
    document.body.replaceChildren();

    render({ submitOn: 'mod-enter' });
    expect(textarea().getAttribute('aria-keyshortcuts')).toBe('Meta+Enter Control+Enter');
  });

  it('exposes accessible names for the textarea and action buttons', () => {
    render({
      allowAttachments: true,
      label: 'Ask anything',
      sendLabel: 'Absenden',
      attachLabel: 'Datei anhängen'
    });

    expect(screen.getByRole('textbox', { name: 'Ask anything' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Absenden' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Datei anhängen' })).toBeTruthy();
  });

  it('defaults the textarea accessible name to "Message"', () => {
    render();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeTruthy();
  });

  it('fires onValueChange while typing', () => {
    const onValueChange = vi.fn();
    render({ onValueChange });

    fireEvent.input(textarea(), { target: { value: 'hi there' } });

    expect(onValueChange).toHaveBeenLastCalledWith('hi there');
  });
});
