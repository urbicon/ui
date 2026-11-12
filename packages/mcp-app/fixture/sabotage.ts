/**
 * The control runs: each breaks the fixture in one way a real app could be
 * broken, and names the checks that must fail — exactly those, no more and no
 * fewer. A control whose breakage did not apply fails as such: a sabotage that
 * changed nothing would look like a host that sees nothing.
 */
import type { Plugin } from 'vite';

export interface Sabotage {
  name: string;
  what: string;
  /** The ids of the checks that must fail in the run. */
  expect: readonly string[];
  /** Vite plugins of the build — a sabotaged build gets its own `outDir`. */
  plugins?(): Plugin[];
  /** Read by the view as `__FIXTURE_SABOTAGE__`. */
  view?: boolean;
  /** For the fixture's server. */
  server?: { stripVisibility?: string };
}

/** The bridge regresses to the spec text's form: `ui/message` with `content` as an object. */
function messageAsObject(): Plugin {
  const ARRAY_FORM = "content: [{ type: 'text', text }]";
  let applied = false;
  return {
    name: 'fixture:sabotage-message-object',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/dist/view/bridge.js')) return undefined;
      if (code.split(ARRAY_FORM).length !== 2) {
        this.error(
          `${id}: the array form of ui/message is not there once — the sabotage cannot apply.`
        );
      }
      applied = true;
      return code.replace(ARRAY_FORM, "content: { type: 'text', text }");
    },
    buildEnd(error) {
      if (!error && !applied) this.error('The view did not bundle dist/view/bridge.js.');
    }
  };
}

/** The view's CSS target below `light-dark()` — Lightning CSS rewrites it into variables. */
function lowCssTarget(): Plugin {
  let applied = false;
  return {
    name: 'fixture:sabotage-css-target',
    config(config) {
      if (!config.build) return;
      config.build.cssTarget = ['chrome111', 'firefox114', 'safari16.4'];
      applied = true;
    },
    buildEnd(error) {
      if (!error && !applied) this.error('The CSS target was not lowered.');
    }
  };
}

export const SABOTAGES: readonly Sabotage[] = [
  {
    name: 'message-object',
    what: 'the bridge sends ui/message with content as an object',
    expect: ['fixture:ask', 'wire'],
    plugins: () => [messageAsObject()]
  },
  {
    name: 'no-visibility',
    what: 'remove_note carries no _meta.ui.visibility',
    expect: ['visibility'],
    server: { stripVisibility: 'remove_note' }
  },
  {
    name: 'image-outside-csp',
    what: 'the view loads an image from an origin outside its CSP',
    expect: ['console', 'csp-reports'],
    view: true
  },
  {
    name: 'view-throws',
    what: 'the view throws after the result',
    expect: ['page-errors'],
    view: true
  },
  {
    name: 'low-css-target',
    what: 'the view is built below the CSS target of light-dark()',
    expect: ['theme'],
    plugins: () => [lowCssTarget()]
  },
  {
    name: 'model-only-from-view',
    what: 'the view calls remove_note (visibility ["model"]) and swallows the refusal',
    // fixture:reload expects get_note as the view's only tools/call.
    expect: ['fixture:reload', 'refused-calls'],
    view: true
  },
  {
    name: 'log-error',
    what: 'the view reports an error to the host alone (notifications/message, level error)',
    expect: ['log-errors'],
    view: true
  }
];
