/**
 * The v0.9.1 `basic`-subset catalog, fully wired: the pure `basicA2uiCatalogSpec`
 * plus its Svelte half — the `A2UINode` dispatcher and the `createIcons` factory.
 *
 * The icon map lives here (not at A2UIView module scope) so it is built ONCE per
 * catalog and threaded through the render context, and so a custom catalog can
 * ship its own icon set from its own module without dragging Basic's icons into
 * every bundle. `createIcons` is a FACTORY, not a constant: `resolveIcon` reads
 * the IconProvider context, so it must run during component initialisation —
 * A2UIView calls `catalog.createIcons()` from its script top level.
 *
 * This module imports `.svelte` components, so — unlike `a2ui-catalog.ts` — it is
 * NOT server-importable. Keep the Svelte-free spec in `a2ui-catalog.ts`.
 */

import { type IconComponent, resolveIcon } from '$lib/icons';
import ArrowLeftIconDefault from '$lib/icons/ArrowLeftIcon.svelte';
import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
import CircleHelpIconDefault from '$lib/icons/CircleHelpIcon.svelte';
import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
import DangerCircleIconDefault from '$lib/icons/DangerCircleIcon.svelte';
import EditIconDefault from '$lib/icons/EditIcon.svelte';
import HomeIconDefault from '$lib/icons/HomeIcon.svelte';
import InfoCircleIconDefault from '$lib/icons/InfoCircleIcon.svelte';
import MailIconDefault from '$lib/icons/MailIcon.svelte';
import MenuIconDefault from '$lib/icons/MenuIcon.svelte';
import PlusIconDefault from '$lib/icons/PlusIcon.svelte';
import SearchIconDefault from '$lib/icons/SearchIcon.svelte';
import SendIconDefault from '$lib/icons/SendIcon.svelte';
import SettingsIconDefault from '$lib/icons/SettingsIcon.svelte';
import StarIconDefault from '$lib/icons/StarIcon.svelte';
import TrashIconDefault from '$lib/icons/TrashIcon.svelte';
import WarningTriangleIconDefault from '$lib/icons/WarningTriangleIcon.svelte';
import A2UINode from './A2UINode.svelte';
import { type A2uiCatalog, basicA2uiCatalogSpec } from './a2ui-catalog';

/**
 * Build the Basic catalog's A2UI icon-enum name → resolved Urbicon icon map.
 * Resolved via DIRECT imports (tree-shakeable — never `getIcon()`); an
 * IconProvider override still wins, the direct import is the fallback. Must run
 * during component init (`resolveIcon` reads context).
 */
function createBasicIcons(): {
  icons: Readonly<Record<string, IconComponent>>;
  fallbackIcon: IconComponent;
} {
  return {
    icons: {
      add: resolveIcon('plus', PlusIconDefault),
      arrowBack: resolveIcon('arrowLeft', ArrowLeftIconDefault),
      check: resolveIcon('check', CheckIconDefault),
      close: resolveIcon('close', CloseIconDefault),
      delete: resolveIcon('trash', TrashIconDefault),
      edit: resolveIcon('edit', EditIconDefault),
      error: resolveIcon('danger', DangerCircleIconDefault),
      home: resolveIcon('home', HomeIconDefault),
      info: resolveIcon('info', InfoCircleIconDefault),
      mail: resolveIcon('mail', MailIconDefault),
      menu: resolveIcon('menu', MenuIconDefault),
      search: resolveIcon('search', SearchIconDefault),
      send: resolveIcon('send', SendIconDefault),
      settings: resolveIcon('settings', SettingsIconDefault),
      star: resolveIcon('star', StarIconDefault),
      warning: resolveIcon('warning', WarningTriangleIconDefault)
    },
    fallbackIcon: resolveIcon('circleHelp', CircleHelpIconDefault)
  };
}

/** The renderable Basic catalog: spec + `A2UINode` dispatcher + icon factory. */
export const basicA2uiCatalog: A2uiCatalog = {
  ...basicA2uiCatalogSpec,
  Node: A2UINode,
  createIcons: createBasicIcons
};
