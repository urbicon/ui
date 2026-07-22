## Structuring a release checklist

Break the work into phases, and let each phase carry its own ordered steps so
nothing gets skipped under pressure.

- Pre-flight
  1. Freeze the `main` branch and announce the window.
  2. Run the full test matrix:
     - unit suites on every package
     - integration suite against a staging database
     - a smoke run of the docs site
  3. Tag the release candidate.
- Ship
  1. Publish packages in dependency order.
  2. Promote the build artifact to production.
  3. Verify health checks are green.
- After
  1. Watch error rates for thirty minutes.
  2. Post the changelog and thank contributors.

The nesting matters here: the top level is unordered (phases have no inherent
order once you are mid-release), while each phase's steps are ordered because
they genuinely must run in sequence.
