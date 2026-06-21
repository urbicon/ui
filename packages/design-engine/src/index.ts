/**
 * `@urbicon-ui/design-engine` — the deterministic core of the Urbicon UI design loop.
 *
 * Zero runtime dependencies. Three independent modules, each also available as a
 * subpath export (`@urbicon-ui/design-engine/{linter,manifest,rubric}`):
 *
 * - **linter**   — the engine behind `validate_design`: deterministic rules + the
 *                  token whitelist + distribution heuristics ("is it correct?").
 * - **manifest** — the persistent design-intent layer: parse/edit `design.manifest.md`
 *                  and scan `data-design-pattern` markers ("what has this project decided?").
 * - **rubric**   — the eight-criterion design-quality rubric ("is it good?", judged).
 *
 * Extracted from `@urbicon-ui/mcp-server` so the same engine can back the MCP server,
 * a CLI, and editor hooks. See docs/internal/DESIGN-MCP-V2.md.
 */

export * from './linter/index.js';
export * from './manifest/index.js';
export * from './rubric/index.js';
