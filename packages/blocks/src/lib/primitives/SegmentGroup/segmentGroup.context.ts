import { createContext } from 'svelte';
import type { SegmentGroupContext } from './index';

const [getSegmentGroupContext, setSegmentGroupContext] = createContext<SegmentGroupContext>();

export { getSegmentGroupContext, setSegmentGroupContext };
