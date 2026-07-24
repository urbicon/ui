/**
 * The Urbicon-native A2UI catalog, fully wired: the pure `urbiconA2uiCatalogSpec`
 * (from the registry module) plus its Svelte half — the `UrbiconA2UINode`
 * dispatcher and the `createIcons` factory (Basic's 16 icons + 10 curated domain
 * glyphs). Imports `.svelte`, so — unlike the registry/spec — this module is NOT
 * server-importable; keep the Svelte-free spec in `a2ui-urbicon-registry.ts`.
 *
 * This module lives under `urbicon/` and is only reached when a consumer opts
 * into the Urbicon catalog (`catalogs={[urbiconA2uiCatalog]}`), so its value code
 * — dispatcher + every mapped Urbicon primitive — never enters the Basic bundle.
 */

import { type IconComponent, resolveIcon } from '$lib/icons';
import ArrowLeftIconDefault from '$lib/icons/ArrowLeftIcon.svelte';
import CalendarIconDefault from '$lib/icons/CalendarIcon.svelte';
import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
import ChevronRightIconDefault from '$lib/icons/ChevronRightIcon.svelte';
import CircleHelpIconDefault from '$lib/icons/CircleHelpIcon.svelte';
import ClockIconDefault from '$lib/icons/ClockIcon.svelte';
import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
import DangerCircleIconDefault from '$lib/icons/DangerCircleIcon.svelte';
import EditIconDefault from '$lib/icons/EditIcon.svelte';
import EuroIconDefault from '$lib/icons/EuroIcon.svelte';
import HomeIconDefault from '$lib/icons/HomeIcon.svelte';
import InfoCircleIconDefault from '$lib/icons/InfoCircleIcon.svelte';
import LinkIconDefault from '$lib/icons/LinkIcon.svelte';
import ListFilterIconDefault from '$lib/icons/ListFilterIcon.svelte';
import MailIconDefault from '$lib/icons/MailIcon.svelte';
import MapPinIconDefault from '$lib/icons/MapPinIcon.svelte';
import MenuIconDefault from '$lib/icons/MenuIcon.svelte';
import PhoneIconDefault from '$lib/icons/PhoneIcon.svelte';
import PlusIconDefault from '$lib/icons/PlusIcon.svelte';
import RefreshIconDefault from '$lib/icons/RefreshIcon.svelte';
import SearchIconDefault from '$lib/icons/SearchIcon.svelte';
import SendIconDefault from '$lib/icons/SendIcon.svelte';
import SettingsIconDefault from '$lib/icons/SettingsIcon.svelte';
import StarIconDefault from '$lib/icons/StarIcon.svelte';
import TrashIconDefault from '$lib/icons/TrashIcon.svelte';
import UserIconDefault from '$lib/icons/UserIcon.svelte';
import WarningTriangleIconDefault from '$lib/icons/WarningTriangleIcon.svelte';
import type { A2uiCatalog } from '../a2ui-catalog';
import { urbiconA2uiCatalogSpec } from './a2ui-urbicon-registry';
import UrbiconA2UINode from './UrbiconA2UINode.svelte';

/**
 * Build the Urbicon catalog's A2UI icon-enum name → resolved Urbicon icon map.
 * Direct imports (tree-shakeable — never `getIcon()`); IconProvider overrides
 * still win. Must run during component init (`resolveIcon` reads context).
 */
function createUrbiconIcons(): {
  icons: Readonly<Record<string, IconComponent>>;
  fallbackIcon: IconComponent;
} {
  return {
    icons: {
      // Basic 16
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
      warning: resolveIcon('warning', WarningTriangleIconDefault),
      // Curated 10
      calendar: resolveIcon('calendar', CalendarIconDefault),
      clock: resolveIcon('clock', ClockIconDefault),
      user: resolveIcon('user', UserIconDefault),
      phone: resolveIcon('phone', PhoneIconDefault),
      mapPin: resolveIcon('mapPin', MapPinIconDefault),
      euro: resolveIcon('euro', EuroIconDefault),
      filter: resolveIcon('listFilter', ListFilterIconDefault),
      refresh: resolveIcon('refresh', RefreshIconDefault),
      chevronRight: resolveIcon('chevronRight', ChevronRightIconDefault),
      link: resolveIcon('link', LinkIconDefault)
    },
    fallbackIcon: resolveIcon('circleHelp', CircleHelpIconDefault)
  };
}

/** The renderable Urbicon catalog: spec + `UrbiconA2UINode` dispatcher + icon factory. */
export const urbiconA2uiCatalog: A2uiCatalog = {
  ...urbiconA2uiCatalogSpec,
  Node: UrbiconA2UINode,
  createIcons: createUrbiconIcons
};
