import { describe, expect, it } from 'vitest';
import { createServer } from './server.js';

/**
 * Smoke tests for the MCP server assembly. The SDK's `McpServer` keeps its
 * tool/resource maps on private fields (`_registeredTools`, `_registeredResources`,
 * `_registeredResourceTemplates`). We deliberately reach into those here because
 * the point of this test is to guard the wiring in `server.ts` — if a tool
 * registration goes missing or is renamed, this file should tell us about it.
 */
interface McpServerInternals {
  _registeredTools: Record<string, unknown>;
  _registeredResources: Record<string, unknown>;
  _registeredResourceTemplates: Record<string, unknown>;
  _registeredPrompts: Record<string, unknown>;
}

const EXPECTED_TOOLS = [
  'find_components',
  'get_component',
  'get_recipe',
  'suggest_implementation',
  'get_implementation_checklist',
  'get_css_reference',
  'find_icons',
  'get_design_principles',
  'get_pattern',
  'validate_design'
] as const;

describe('createServer', () => {
  it('boots without throwing', () => {
    expect(() => createServer()).not.toThrow();
  });

  it('returns an object', () => {
    const server = createServer();
    expect(server).toBeTypeOf('object');
    expect(server).not.toBeNull();
  });

  it('registers exactly the expected set of tools', () => {
    const server = createServer() as unknown as McpServerInternals;
    const toolNames = Object.keys(server._registeredTools);

    for (const expected of EXPECTED_TOOLS) {
      expect(toolNames, `missing tool: ${expected}`).toContain(expected);
    }
    expect(toolNames).toHaveLength(EXPECTED_TOOLS.length);
  });

  it('registers at least one catalog resource', () => {
    const server = createServer() as unknown as McpServerInternals;
    const resourceCount =
      Object.keys(server._registeredResources).length +
      Object.keys(server._registeredResourceTemplates).length;
    expect(resourceCount).toBeGreaterThan(0);
  });

  it('registers the design-process prompts', () => {
    const server = createServer() as unknown as McpServerInternals;
    const promptNames = Object.keys(server._registeredPrompts);
    expect(promptNames).toContain('design-page');
    expect(promptNames).toContain('redesign');
  });
});
