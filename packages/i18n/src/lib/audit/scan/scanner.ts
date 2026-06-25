/**
 * Source-scanner entry: dispatch by extension to the Svelte or TypeScript walker,
 * and a multi-file helper that merges per-file scans while surfacing (never
 * swallowing) files that failed to parse.
 */

import { mergeScans } from './recognize';
import { scanSvelte } from './svelte-walker';
import { scanTs } from './ts-walker';
import type { ScanOptions, UsageScan } from './types';

/** Scan one source's text for translation-key usage. */
export function scanSource(
  code: string,
  file: string,
  options: ScanOptions = {}
): Promise<UsageScan> {
  return file.endsWith('.svelte') ? scanSvelte(code, file, options) : scanTs(code, file, options);
}

export interface ScanSourcesResult {
  scan: UsageScan;
  /** Files that could not be parsed — reported, not silently dropped. */
  errors: Array<{ file: string; message: string }>;
}

/** Scan many sources concurrently and merge them; parse failures become `errors`. */
export async function scanSources(
  files: Array<{ file: string; code: string }>,
  options: ScanOptions = {}
): Promise<ScanSourcesResult> {
  const errors: Array<{ file: string; message: string }> = [];
  const scans: UsageScan[] = [];
  await Promise.all(
    files.map(async ({ file, code }) => {
      try {
        scans.push(await scanSource(code, file, options));
      } catch (error) {
        errors.push({ file, message: error instanceof Error ? error.message : String(error) });
      }
    })
  );
  return { scan: mergeScans(scans), errors };
}
