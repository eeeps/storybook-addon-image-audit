import type { DecoratorFunction } from 'storybook/internal/types';
import { useEffect } from 'storybook/preview-api';
import type { ImageAuditParameters } from './shared/audit';
import { globalKey, isEnabled } from './shared/constants';
import { reportPolyfillError, showImageOverlays } from './preview/showImageOverlays';

export type { ImageAuditParameters } from './shared/audit';

export const initialGlobals = { [globalKey]: false };

const withImageAudit: DecoratorFunction = (Story, { globals, id, parameters, viewMode }) => {
  const enabled = viewMode === 'story' && isEnabled(globals[globalKey]);
  const config: ImageAuditParameters | undefined = parameters[globalKey];
  const hostedSizeEndpoint = config?.hostedSizeEndpoint;

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    if (CSS.supports('top', 'anchor(top)')) return showImageOverlays(undefined, hostedSizeEndpoint);

    let cancelled = false;
    let removeOverlays: (() => void) | undefined;
    import('@oddbird/css-anchor-positioning/fn')
      .then(({ default: polyfill }) => {
        if (!cancelled) removeOverlays = showImageOverlays(polyfill, hostedSizeEndpoint);
      })
      .catch(reportPolyfillError);
    return () => {
      cancelled = true;
      removeOverlays?.();
    };
  }, [enabled, hostedSizeEndpoint, id]);

  return Story();
};

export const decorators = [withImageAudit];
