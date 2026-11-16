declare module 'virtual:changelog' {
  const content: string;
  export default content;
}

// The view component of the MCP-App walkthrough (`guideFencePlugin` in vite.config.ts).
declare module 'virtual:guide-fence/mcp-app/WALKTHROUGH.md/*' {
  import type { ViewProps, ViewState } from '@urbicon-ui/mcp-app/view';
  import type { Component } from 'svelte';

  const component: Component<ViewProps<ViewState, true>>;
  export default component;
}
