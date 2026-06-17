import { createContext } from 'svelte';
import type { TabContext } from './index';

const [getTabContext, setTabContext] = createContext<TabContext>();

export { getTabContext, setTabContext };
