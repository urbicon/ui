import { describe, expect, it } from 'vitest';
import { fileUploadVariants } from './fileUpload.variants';

const SLOTS = [
  'root',
  'dropzone',
  'dropzoneIcon',
  'dropzoneTitle',
  'dropzoneDescription',
  'fileList',
  'fileItem',
  'fileItemPreview',
  'fileItemInfo',
  'fileItemName',
  'fileItemSize',
  'fileItemProgress',
  'fileItemRemoveButton',
  'fileItemError',
  'fileItemStatusIcon'
] as const;

describe('fileUploadVariants', () => {
  it('provides all slot functions', () => {
    const styles = fileUploadVariants();
    for (const slot of SLOTS) {
      expect(typeof styles[slot]).toBe('function');
    }
  });

  it('scales the dropzone padding + preview thumbnail with size', () => {
    expect(fileUploadVariants({ size: 'sm' }).fileItemPreview()).toContain('size-8');
    expect(fileUploadVariants({ size: 'md' }).fileItemPreview()).toContain('size-10');
    expect(fileUploadVariants({ size: 'lg' }).fileItemPreview()).toContain('size-12');
    expect(fileUploadVariants({ size: 'sm' }).dropzone()).toContain('py-6');
    expect(fileUploadVariants({ size: 'lg' }).dropzone()).toContain('py-14');
  });

  it('gives each intent its own hover affordance', () => {
    expect(fileUploadVariants({ intent: 'primary' }).dropzone()).toContain('hover:border-primary');
    expect(fileUploadVariants({ intent: 'neutral' }).dropzone()).toContain(
      'hover:border-border-emphasis'
    );
  });

  it('paints the invalid state danger + locks interaction when disabled', () => {
    const invalid = fileUploadVariants({ invalid: true });
    expect(invalid.dropzone()).toContain('border-danger');
    expect(invalid.dropzoneIcon()).toContain('text-danger');

    const disabled = fileUploadVariants({ disabled: true });
    expect(disabled.root()).toContain('opacity-50');
    expect(disabled.root()).toContain('pointer-events-none');
    expect(disabled.dropzone()).toContain('cursor-not-allowed');
  });

  it('lifts the dropzone on active drag via the intent x dragging compounds', () => {
    // `dragging` is a compound-only axis (its true/false branches are empty) — the drag visuals
    // live in the intent x dragging x invalid compounds, so they only appear when all three match.
    const primaryDrag = fileUploadVariants({ intent: 'primary', dragging: true, invalid: false });
    expect(primaryDrag.dropzone()).toContain('border-primary');
    expect(primaryDrag.dropzone()).toContain('scale-[1.01]');
    expect(primaryDrag.dropzoneIcon()).toContain('scale-110');

    const neutralDrag = fileUploadVariants({ intent: 'neutral', dragging: true, invalid: false });
    expect(neutralDrag.dropzone()).toContain('border-border-emphasis');

    // No drag, no invalid → resting dropzone keeps neither the scale lift nor the danger border.
    const resting = fileUploadVariants({ intent: 'primary', dragging: false, invalid: false });
    expect(resting.dropzone()).not.toContain('scale-[1.01]');
  });

  it('never emits dark: overrides', () => {
    const styles = fileUploadVariants();
    for (const slot of SLOTS) {
      expect(styles[slot]()).not.toMatch(/\bdark:/);
    }
  });
});
