// What makes this directory server-only in a consumer's app: SvelteKit fails
// the build when `$app/server` ends up in a browser bundle, and for a package
// in node_modules the import is the only signal it reads — the directory name
// counts for the app's own files alone. `svelte-package` checks that every
// file under `server/` reaches this import; one that imports no other module
// of the directory imports this one itself.
import '$app/server';
