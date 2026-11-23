import { useEffect } from 'storybook/preview-api';
import { addonId, globalKey, isEnabled } from './constants.js';

export const initialGlobals = { [globalKey]: false };

let nextAnchor = 0;

function showImageOverlays(polyfill) {
  const overlays = new Map();
  const resourceSizes = new Map();
  const numberFormat = new Intl.NumberFormat();

  function recordSizes(entries) {
    for (const { name, decodedBodySize } of entries) {
      resourceSizes.set(name, decodedBodySize);
    }
  }

  function updateFileSize(image, label) {
    const url = image.currentSrc;
    const size = resourceSizes.get(url) ?? resourceSizes.get(url.split('#', 1)[0]);
    const text = size > 0 ? `${numberFormat.format(size)} B` : 'Size unavailable';
    if (label.textContent !== text) label.textContent = text;
  }

  recordSizes(performance.getEntriesByType('resource'));
  let timingObserver;
  if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes('resource')) {
    timingObserver = new PerformanceObserver((list) => {
      recordSizes(list.getEntries());
      for (const [image, { label }] of overlays) updateFileSize(image, label);
    });
    timingObserver.observe({ type: 'resource', buffered: true });
  }

  function onImageLoad({ target }) {
    const entry = overlays.get(target);
    if (entry) updateFileSize(target, entry.label);
  }


  function syncOverlays() {
    const images = new Set(document.querySelectorAll('img'));
    const newStyles = [];

    for (const [image, { remove }] of overlays) {
      if (images.has(image)) continue;
      remove();
      overlays.delete(image);
    }

    for (const image of images) {
      if (overlays.has(image)) continue;

      const anchor = `--${addonId}-${++nextAnchor}`;
      const overlay = document.createElement('div');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.dataset.imgInfoOverlay = anchor;
      overlay.style.cssText = `
        position: fixed;
        position-visibility: anchors-visible;
        background: rgb(100% 0% 0% / 0.25);
        pointer-events: none;
        z-index: 2147483647;
      `;
      const label = document.createElement('span');
      label.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        padding: 2px 4px;
        white-space: nowrap;
        color: white;
        background: rgb(0 0 0 / 0.8);
        font: 12px/1.2 system-ui, sans-serif;
      `;
      updateFileSize(image, label);
      overlay.append(label);

      const position = `
        position-anchor: ${anchor};
        top: anchor(top);
        right: anchor(right);
        bottom: anchor(bottom);
        left: anchor(left);
      `;

      if (polyfill) {
        const marker = 'data-img-info-anchor';
        const originalMarker = image.getAttribute(marker);
        image.setAttribute(marker, anchor);
        // Unsupported declarations must reach the polyfill as raw CSS.
        const style = document.createElement('style');
        style.textContent = `
          img[${marker}="${anchor}"] { anchor-name: ${anchor}; }
          [data-img-info-overlay="${anchor}"] { ${position} }
        `;
        document.head.append(style);
        document.body.append(overlay);
        newStyles.push(style);
        const remove = () => {
          overlay.remove();
          style.remove();
          if (originalMarker === null) image.removeAttribute(marker);
          else image.setAttribute(marker, originalMarker);
        };
        overlays.set(image, { label, remove });
        continue;
      }

      const originalStyle = image.getAttribute('style');
      const originalName = image.style.getPropertyValue('anchor-name');
      const originalPriority = image.style.getPropertyPriority('anchor-name');
      const computedName = getComputedStyle(image).anchorName;
      const anchorNames = computedName && computedName !== 'none'
        ? `${computedName}, ${anchor}`
        : anchor;
      image.style.setProperty('anchor-name', anchorNames, 'important');

      const anchoredStyle = image.getAttribute('style');

      overlay.style.cssText += position;
      document.body.append(overlay);

      const remove = () => {
        overlay.remove();
        if (image.getAttribute('style') === anchoredStyle) {
          if (originalStyle === null) image.removeAttribute('style');
          else image.setAttribute('style', originalStyle);
          return;
        }
        if (image.style.getPropertyValue('anchor-name') !== anchorNames) return;
        image.style.setProperty('anchor-name', originalName, originalPriority);
        if (originalStyle === null && image.style.length === 0) {
          image.removeAttribute('style');
        }
      };
      overlays.set(image, { label, remove });
    }

    if (newStyles.length) {
      polyfill({ elements: newStyles, excludeInlineStyles: true })
        .catch(reportPolyfillError);
    }
  }

  syncOverlays();
  document.addEventListener('load', onImageLoad, true);
  document.addEventListener('error', onImageLoad, true);
  const observer = new MutationObserver(syncOverlays);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    timingObserver?.disconnect();
    document.removeEventListener('load', onImageLoad, true);
    document.removeEventListener('error', onImageLoad, true);
    for (const { remove } of overlays.values()) remove();
  };
}

function reportPolyfillError(error) {
  console.error('Image overlays could not load CSS Anchor Positioning support.', error);
}

export const decorators = [
  (Story, { globals, viewMode }) => {
    const enabled = viewMode === 'story' && isEnabled(globals[globalKey]);
    useEffect(() => {
      if (!enabled || typeof document === 'undefined') return;
      if (CSS.supports('top', 'anchor(top)')) return showImageOverlays();

      let cancelled = false;
      let removeOverlays;
      import('@oddbird/css-anchor-positioning/fn')
        .then(({ default: polyfill }) => {
          if (!cancelled) removeOverlays = showImageOverlays(polyfill);
        })
        .catch(reportPolyfillError);
      return () => {
        cancelled = true;
        removeOverlays?.();
      };
    }, [enabled]);
    return Story();
  },
];
