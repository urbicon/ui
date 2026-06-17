import { createContext } from 'svelte';
import type { StepperContext } from './index';

const [getStepperContext, setStepperContext] = createContext<StepperContext>();

export { getStepperContext, setStepperContext };
