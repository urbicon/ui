/**
 * Global type augmentations used across all packages
 * Extends standard HTML attributes with custom properties
 */

declare global {
  // Svelte's type system requires the `svelteHTML` namespace for template-
  // attribute augmentation; module syntax is not a valid alternative here.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace svelteHTML {
    interface HTMLAttributes<T> {
      onoutclick?: (event: CustomEvent) => void;
    }
  }
}

export {}; // Make this a module
