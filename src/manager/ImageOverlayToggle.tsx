import * as React from 'react';
import { ToggleButton } from 'storybook/internal/components';
import { useGlobals } from 'storybook/manager-api';
import { globalKey, isEnabled } from '../shared/constants';

export function ImageOverlayToggle() {
  const [globals, updateGlobals] = useGlobals();
  const pressed = isEnabled(globals[globalKey]);

  return (
    <ToggleButton
      ariaLabel="Toggle image overlays"
      tooltip="Toggle image overlays"
      variant="ghost"
      padding="small"
      pressed={pressed}
      onClick={() => updateGlobals({ [globalKey]: !pressed })}
    >
      Images
    </ToggleButton>
  );
}
