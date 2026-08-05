/**
 * SPIKE m4 counter-probe — a view hoisted to module scope, the pattern the
 * DEV guard warns against. Imported by ViewModuleScopeHarness so the SSR
 * suite can demonstrate the cross-request leak this creates. The warning
 * this import triggers on the server is part of the measurement.
 */
import { createTableView } from '../view.svelte';

export const moduleScopeView = createTableView({ defaults: { pageSize: 10 } });
