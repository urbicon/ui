import { createContext } from 'svelte';
import type { RadioGroupContext } from './index';

const [getRadioGroupContext, setRadioGroupContext] = createContext<RadioGroupContext>();

export { getRadioGroupContext, setRadioGroupContext };
