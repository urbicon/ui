import { createOptionalContext } from '$lib/utils/optional-context';
import type { ButtonGroupContext } from './index';

// Button reads this optionally — it works both inside and outside a ButtonGroup.
const [getButtonGroupContext, setButtonGroupContext] = createOptionalContext<ButtonGroupContext>();

export { getButtonGroupContext, setButtonGroupContext };
