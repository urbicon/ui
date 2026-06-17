/// <reference types="@urbicon-ui/shared-types/globals" />

import '@urbicon-ui/shared-types/globals';

declare module '*.svg?raw' {
  const content: string;
  export default content;
}
