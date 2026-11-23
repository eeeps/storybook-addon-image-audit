import { createElement } from 'react';
import { ToggleButton } from 'storybook/internal/components';
import { addons, types, useGlobals } from 'storybook/manager-api';
import { addonId, globalKey, isEnabled } from './constants.js';

function ImageOverlayToggle() {
  const [globals, updateGlobals] = useGlobals();
  const pressed = isEnabled(globals[globalKey]);

  return createElement(ToggleButton, {
    ariaLabel: 'Toggle image overlays',
    tooltip: 'Toggle image overlays',
    variant: 'ghost',
    padding: 'small',
    pressed,
    onClick: () => updateGlobals({ [globalKey]: !pressed }),
  }, 'Images');
}

addons.register(addonId, () => {
  addons.add(`${addonId}/toggle`, {
    type: types.TOOL,
    match: ({ viewMode }) => viewMode === 'story',
    render: ImageOverlayToggle,
  });
});
