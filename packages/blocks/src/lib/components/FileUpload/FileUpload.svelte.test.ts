// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIntakeEntry } from '#lib/utils/file-intake.js';
import FileUploadInFormField from './__fixtures__/FileUploadInFormField.svelte';
import FileUpload from './FileUpload.svelte';

// The root's restProps contract (COMPONENT-API-CONVENTIONS § restProps ordering): rest spreads
// first, so the region landmark survives a consumer `role`; a consumer `aria-label` names the
// region over the localized default on purpose, because that default is the same for every
// instance on a page.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function render(props: ComponentProps<typeof FileUpload> = {}) {
  const instance = mount(FileUpload, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

function renderInField(props: ComponentProps<typeof FileUploadInFormField> = {}) {
  const instance = mount(FileUploadInFormField, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;
const dropzone = () => document.querySelector<HTMLElement>('[data-blocks-dropzone-state]');

function clicksOn(el: HTMLElement) {
  const events: MouseEvent[] = [];
  el.addEventListener('click', (e) => events.push(e));
  return events;
}

function describedByTexts(el: HTMLElement) {
  return (el.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent?.replace(/\s+/g, ' ').trim());
}

describe('FileUpload (restProps)', () => {
  it('keeps the region landmark against a consumer role', () => {
    render({ role: 'presentation', 'data-testid': 'upload' });
    const root = screen.getByTestId('upload');
    expect(root.getAttribute('role')).toBe('region');
  });

  it('is named by the localized default without a consumer aria-label', () => {
    render();
    expect(screen.getByRole('region', { name: 'File upload' })).toBeTruthy();
  });

  it('is named by a consumer aria-label over the localized default', () => {
    render({ 'aria-label': 'Invoice attachments' });
    expect(screen.getByRole('region', { name: 'Invoice attachments' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'File upload' })).toBeNull();
  });
});

describe('FileUpload in a FormField (the FormField @example as written)', () => {
  it('points the label at the native file input', () => {
    renderInField();
    const control = screen.getByLabelText('Document');
    expect(control).toBe(fileInput());
  });

  it('keeps the labelled control in the accessibility tree and the tab order', () => {
    renderInField();
    const control = fileInput();
    expect(control.hasAttribute('aria-hidden')).toBe(false);
    expect(control.tabIndex).toBe(0);
  });

  it('describes the control with the helper and the error, and flags it invalid', () => {
    renderInField();
    expect(describedByTexts(fileInput())).toContain('PDF, JPG, PNG — max 10 MB');

    dispose?.();
    renderInField({ error: 'Pick a PDF' });
    expect(describedByTexts(fileInput())).toContain('Pick a PDF');
    expect(fileInput().getAttribute('aria-invalid')).toBe('true');
  });

  it('leaves id, aria-describedby and aria-invalid off the region', () => {
    renderInField({ error: 'Pick a PDF' });
    const region = screen.getByRole('region', { name: 'File upload' });
    expect(region.hasAttribute('id')).toBe(false);
    expect(region.hasAttribute('aria-describedby')).toBe(false);
    expect(region.hasAttribute('aria-invalid')).toBe(false);
  });

  it('opens the picker from a label click: the click reaches the file input', () => {
    renderInField();
    const clicks = clicksOn(fileInput());
    document.querySelector('label')!.click();
    expect(clicks).toHaveLength(1);
    expect(clicks[0].defaultPrevented).toBe(false);
  });
});

describe('FileUpload (the file input is the control)', () => {
  it('routes aria-labelledby and aria-required to the control, aria-label to the region', () => {
    render({
      'aria-labelledby': 'external-heading',
      'aria-required': 'true',
      'aria-label': 'Invoice attachments'
    });
    const control = fileInput();
    expect(control.getAttribute('aria-labelledby')).toBe('external-heading');
    expect(control.getAttribute('aria-required')).toBe('true');
    const region = screen.getByRole('region', { name: 'Invoice attachments' });
    expect(region.hasAttribute('aria-labelledby')).toBe(false);
    expect(region.hasAttribute('aria-required')).toBe(false);
  });

  it('gives the control the region name as its title, the fallback a label outranks', () => {
    render();
    expect(fileInput().getAttribute('title')).toBe('File upload');
    dispose?.();
    render({ 'aria-label': 'Invoice attachments' });
    expect(fileInput().getAttribute('title')).toBe('Invoice attachments');
  });

  it('describes the control with the dropzone content first, a consumer description last', () => {
    const hint = document.createElement('p');
    hint.id = 'hint';
    hint.textContent = 'Scanned copies are fine';
    document.body.append(hint);
    render({
      title: 'Drop invoices here',
      description: 'PDF only',
      'aria-describedby': 'hint'
    });
    expect(describedByTexts(fileInput())).toEqual([
      'Drop invoices here PDF only',
      'Scanned copies are fine'
    ]);
  });

  it('is the one tab stop before any file is added', () => {
    render({ 'data-testid': 'upload' });
    const tabbable = [
      ...screen.getByTestId('upload').querySelectorAll<HTMLElement>('input, button, [tabindex]')
    ].filter((el) => el.tabIndex >= 0 && !(el as HTMLInputElement).disabled);
    expect(tabbable).toEqual([fileInput()]);
    expect(dropzone()!.hasAttribute('role')).toBe(false);
  });

  // Where focus then scrolls is layout, which jsdom lacks: e2e/file-upload.spec.ts measures it.
  it('makes the root the containing block of the input, under unstyled too', () => {
    render({ 'data-testid': 'upload' });
    expect(screen.getByTestId('upload').classList.contains('relative')).toBe(true);
    dispose?.();
    render({ 'data-testid': 'upload', unstyled: true });
    expect(screen.getByTestId('upload').classList.contains('relative')).toBe(true);
    dispose?.();
    render({ 'data-testid': 'upload', class: 'sticky top-0' });
    const root = screen.getByTestId('upload');
    expect(root.classList.contains('sticky')).toBe(true);
    expect(root.classList.contains('relative')).toBe(false);
  });

  it('relays its focus ring to the dropzone through `peer`', () => {
    render();
    const control = fileInput();
    expect(control.classList.contains('peer')).toBe(true);
    // `peer-*` is the general-sibling combinator: the dropzone must follow the input.
    expect(control.parentElement).toBe(dropzone()!.parentElement);
    expect(control.compareDocumentPosition(dropzone()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(dropzone()!.className).toContain('peer-focus-visible:ring-2');
  });

  it('opens the picker from a dropzone click', () => {
    render();
    const clicks = clicksOn(fileInput());
    dropzone()!.click();
    expect(clicks).toHaveLength(1);
  });

  it('takes a disabled control out of the tab order and opens no picker', () => {
    render({ disabled: true });
    const control = fileInput();
    expect(control.disabled).toBe(true);
    const clicks = clicksOn(control);
    dropzone()!.click();
    expect(clicks).toHaveLength(0);
  });

  it('marks a disabled dropzone inactive, and an enabled one not at all', () => {
    render({ disabled: true });
    expect(dropzone()!.getAttribute('aria-disabled')).toBe('true');
    dispose?.();
    render();
    expect(dropzone()!.hasAttribute('aria-disabled')).toBe(false);
  });

  describe('while a full list hides the dropzone', () => {
    // vitest-setup's DataTransfer stub refuses a transfer with files, because jsdom cannot build
    // the FileList the mirror effect assigns. These tests are about the control, not the mirror,
    // so a permissive stub stands in.
    function renderFull(props: ComponentProps<typeof FileUploadInFormField> = {}) {
      vi.stubGlobal(
        'DataTransfer',
        class {
          readonly items = { add: () => {} };
          get files() {
            return document.createElement('input').files;
          }
        }
      );
      const entry = createIntakeEntry(
        new File(['%PDF'], 'invoice.pdf', { type: 'application/pdf' })
      );
      renderInField({ maxFiles: 1, files: [entry], ...props });
    }

    it('keeps the control as the label target', () => {
      renderFull();
      expect(dropzone()).toBeNull();
      expect(screen.getByLabelText('Document')).toBe(fileInput());
    });

    it('marks the control unavailable and leaves the remove button as the only tab stop', () => {
      renderFull();
      const control = fileInput();
      expect(control.getAttribute('aria-disabled')).toBe('true');
      expect(control.tabIndex).toBe(-1);
      const tabbable = [
        ...document.querySelectorAll<HTMLElement>('input, button, [tabindex]')
      ].filter((el) => el.tabIndex >= 0);
      expect(tabbable.map((el) => el.getAttribute('aria-label'))).toEqual(['Remove invoice.pdf']);
    });

    it('cancels the picker a label click would open', () => {
      renderFull();
      const clicks = clicksOn(fileInput());
      document.querySelector('label')!.click();
      expect(clicks).toHaveLength(1);
      expect(clicks[0].defaultPrevented).toBe(true);
    });

    it('drops the dropzone from the description instead of pointing at a missing id', () => {
      renderFull();
      expect(describedByTexts(fileInput())).toEqual(['PDF, JPG, PNG — max 10 MB']);
    });
  });
});
