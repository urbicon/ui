import { describe, expect, it } from 'vitest';
import { toSlug } from '../src/utils/slug';

/**
 * `toSlug` keys every artifact of a component: the doc-route directory, the
 * per-component `api.ts`, the `_catalog.json` entry, the `llm.txt` asset path
 * and the MCP catalog entry. A change here reslugs URLs, so these cases are
 * the contract, not incidental coverage.
 */
describe('toSlug', () => {
  it('lowercases a single-word name', () => {
    expect(toSlug('Button')).toBe('button');
    expect(toSlug('Tab')).toBe('tab');
  });

  it('splits the classic lowercase → capital boundary', () => {
    expect(toSlug('DatePicker')).toBe('date-picker');
    expect(toSlug('PinInput')).toBe('pin-input');
    expect(toSlug('SidebarLayout')).toBe('sidebar-layout');
    expect(toSlug('CommandPalette')).toBe('command-palette');
  });

  it('splits a leading acronym run from the word that follows', () => {
    // The regression this rule exists for: without the acronym pass the run has
    // no lower→upper boundary and QRCode collapses to `qrcode`.
    expect(toSlug('QRCode')).toBe('qr-code');
    expect(toSlug('IOStream')).toBe('io-stream');
    expect(toSlug('HTTPSProxy')).toBe('https-proxy');
    expect(toSlug('OTPInput')).toBe('otp-input');
    expect(toSlug('APIKey')).toBe('api-key');
    expect(toSlug('PDFViewer')).toBe('pdf-viewer');
  });

  it('splits an acronym run in the middle of a name', () => {
    expect(toSlug('LegacyXMLParser')).toBe('legacy-xml-parser');
    expect(toSlug('ChartSVGLayer')).toBe('chart-svg-layer');
  });

  it('keeps a trailing acronym whole — no following lowercase to split at', () => {
    expect(toSlug('ChartAPI')).toBe('chart-api');
    expect(toSlug('ExportPDF')).toBe('export-pdf');
  });

  it('treats a two-letter acronym like any other run', () => {
    expect(toSlug('UIView')).toBe('ui-view');
    expect(toSlug('A2UIView')).toBe('a2-ui-view');
  });

  it('splits at a digit → capital boundary', () => {
    expect(toSlug('Chart2D')).toBe('chart2-d');
    expect(toSlug('Grid12Column')).toBe('grid12-column');
  });

  it('leaves an already-kebab name untouched', () => {
    expect(toSlug('date-picker')).toBe('date-picker');
    expect(toSlug('qr-code')).toBe('qr-code');
  });

  it('collapses whitespace and underscores to a single hyphen', () => {
    expect(toSlug('Date  Picker')).toBe('date-picker');
    expect(toSlug('Date__Picker')).toBe('date-picker');
    expect(toSlug('Date _ Picker')).toBe('date-picker');
  });

  it('returns the empty string unchanged', () => {
    expect(toSlug('')).toBe('');
  });

  it('is idempotent — slugging a slug is a no-op', () => {
    for (const name of ['Button', 'DatePicker', 'QRCode', 'A2UIView', 'HTTPSProxy', 'ChartAPI']) {
      const slug = toSlug(name);
      expect(toSlug(slug)).toBe(slug);
    }
  });
});
