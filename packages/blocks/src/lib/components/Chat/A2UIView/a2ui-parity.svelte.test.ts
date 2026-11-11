// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import * as attacks from './__fixtures__/hostile/attacks';
import { exButton } from './__fixtures__/spec/ex_button';
import { exChildlist } from './__fixtures__/spec/ex_childlist';
import { exIncremental } from './__fixtures__/spec/ex_incremental';
import { exLogin } from './__fixtures__/spec/ex_login';
import { exSimpleText } from './__fixtures__/spec/ex_simple_text';
import A2UIView from './A2UIView.svelte';
import { A2UI_ISSUE_CODES, type A2uiValidationIssue } from './a2ui.types';
import type { A2uiSurfaceRequirements } from './a2ui-requirements';
import type { A2uiDataSchema } from './a2ui-schema';
import { validateA2uiPayload } from './a2ui-validate';
import { urbiconA2uiCatalog } from './urbicon/a2ui-urbicon-catalog';
import { urbiconA2uiCatalogSpec } from './urbicon/a2ui-urbicon-registry';

// A server validating a tool's arguments and a view rendering them must report
// the same issues, or the agent corrects one thing and the user sees another.
// Population: every payload under __fixtures__/hostile/ and __fixtures__/spec/,
// each mounted settled (`streaming` false) and handed to validateA2uiPayload.

const POPULATION: ReadonlyArray<readonly [string, unknown]> = [
  ...Object.entries(attacks).filter(([, payload]) => Array.isArray(payload)),
  ...Object.entries({ exButton, exChildlist, exIncremental, exLogin, exSimpleText })
];

// Options that make the view's catalogs, schema and requirements take part:
// two catalogs turn an unknown catalogId into a warning, the schema checks the
// fixtures' writes, the requirements check the fixtures' surfaces.
const DATA_SCHEMA: A2uiDataSchema = {
  '/a': { type: 'string' },
  '/notArray': { type: 'array' },
  '/restaurants': { type: 'array' }
};
const REQUIREMENTS: A2uiSurfaceRequirements = {
  dr: [{ component: 'Text' }],
  'gallery-login-form': [{ component: 'CheckBox', path: '/remember' }, { component: 'Checkbox' }],
  'gallery-incremental': [{ component: 'Image' }, { component: 'Teleporter' }]
};

let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function viewIssues(payload: unknown, configured: boolean): A2uiValidationIssue[] {
  let reported: A2uiValidationIssue[] = [];
  const instance = mount(A2UIView, {
    target: document.body,
    props: {
      payload,
      streaming: false,
      onValidationError: (issues) => {
        reported = issues;
      },
      ...(configured
        ? {
            catalogs: [urbiconA2uiCatalog],
            dataSchema: DATA_SCHEMA,
            surfaceRequirements: REQUIREMENTS
          }
        : {})
    }
  });
  dispose = () => unmount(instance);
  flushSync();
  return reported;
}

describe('validateA2uiPayload reports what a settled A2UIView reports', () => {
  it('covers a population that produces issues at all', () => {
    const withIssues = POPULATION.filter(([, payload]) => validateA2uiPayload(payload).length > 0);
    expect(withIssues.length).toBeGreaterThan(POPULATION.length / 2);
  });

  describe('with the default options', () => {
    for (const [name, payload] of POPULATION) {
      it(name, () => {
        expect(viewIssues(payload, false)).toEqual(validateA2uiPayload(payload));
      });
    }
  });

  describe('with the Urbicon catalog, a data schema and surface requirements', () => {
    it('reaches every option: each adds issues the default options cannot', () => {
      const codes = new Set(
        POPULATION.flatMap(([, payload]) =>
          validateA2uiPayload(payload, {
            catalogs: [urbiconA2uiCatalogSpec],
            dataSchema: DATA_SCHEMA,
            surfaceRequirements: REQUIREMENTS
          }).map((issue) => issue.code)
        )
      );
      for (const code of [
        A2UI_ISSUE_CODES.UNKNOWN_CATALOG,
        A2UI_ISSUE_CODES.SCHEMA_TYPE_MISMATCH,
        A2UI_ISSUE_CODES.MISSING_REQUIRED_COMPONENT,
        A2UI_ISSUE_CODES.INVALID_REQUIREMENT
      ]) {
        expect(codes, code).toContain(code);
      }
    });

    for (const [name, payload] of POPULATION) {
      it(name, () => {
        expect(viewIssues(payload, true)).toEqual(
          validateA2uiPayload(payload, {
            catalogs: [urbiconA2uiCatalogSpec],
            dataSchema: DATA_SCHEMA,
            surfaceRequirements: REQUIREMENTS
          })
        );
      });
    }
  });
});
