import { createContext } from 'svelte';
import type { AccordionContext } from './index';

const [getAccordionContext, setAccordionContext] = createContext<AccordionContext>();

export { getAccordionContext, setAccordionContext };
