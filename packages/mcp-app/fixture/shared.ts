/**
 * What the fixture's view and server share. Values only from here — the view
 * bundles this file, so `./server` comes in as `import type` alone.
 */
import type { ViewSpec } from '@urbicon-ui/mcp-app/server';

/** `serverInfo` of the server and `appInfo` of the view — one value, measured by the handshake check. */
export const FIXTURE_INFO = { name: 'mcp-app-fixture', version: '1.0.0' };

export const BASE_PLACEHOLDER = '__FIXTURE_BASE__';
export const BASE_META = 'fixture:base';
export const FONTS_PATH = '/fonts/';

export const VIEWS = {
  note: {
    title: 'Note',
    description: 'One note as a card — ask about it, reload it, open it in the app.',
    prefersBorder: true,
    callsTools: true
  }
} as const satisfies Record<string, ViewSpec>;

export type ViewName = keyof typeof VIEWS;

export interface Note {
  id: string;
  title: string;
  body: string;
}

export const NOTES: readonly Note[] = [
  {
    id: 'n1',
    title: 'A note from the fixture',
    body: 'Set in JetBrains Mono, a font served from the app’s own origin.'
  }
];

/** The line the lazily imported module renders — proof that the dynamic import ran. */
export const GREETING = 'Loaded through a dynamic import.';
