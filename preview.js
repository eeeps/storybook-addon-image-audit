import { useEffect } from 'storybook/preview-api';
import { addonId, globalKey, isEnabled } from './constants.js';

export const initialGlobals = { [globalKey]: false };

let nextAnchor = 0;
const proxyHosts = new Set(
  typeof __IMG_INFO_PROXY_HOSTS__ === 'undefined' ? [] : __IMG_INFO_PROXY_HOSTS__,
);

async function readFallbackSize(url, signal, readSize) {
  try {
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (response.ok) {
      const bytes = await readSize(response);
      if (Number.isSafeInteger(bytes) && bytes > 0) return bytes;
    }
  } catch {
    // An unavailable fallback leaves the next one eligible.
  }
}

function hostedEndpoint(value) {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch {
    // An invalid endpoint leaves the hosted fallback disabled.
  }
}

function showImageOverlays(polyfill, hostedSizeEndpoint) {
  const overlays = new Map();
  const resourceSizes = new Map();
  const intrinsicSizes = new Map();
  const dimensionProbes = new Map();
  const numberFormat = new Intl.NumberFormat();
  const dimensionFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

  function updateDimensions(label, width, height) {
    label.textContent = `${dimensionFormat.format(width)} × ${dimensionFormat.format(height)} CSS px`;
  }

  function updateResourceDimensions(image, label) {
    const url = image.currentSrc;
    if (image.complete && url && !intrinsicSizes.has(url) && !dimensionProbes.has(url)) {
      const probe = new Image();
      if (image.crossOrigin !== null) probe.crossOrigin = image.crossOrigin;
      probe.referrerPolicy = image.referrerPolicy;

      function finish() {
        probe.onload = probe.onerror = null;
        dimensionProbes.delete(url);
        const { naturalWidth: width, naturalHeight: height } = probe;
        intrinsicSizes.set(url, width && height
          ? `Resource: ${dimensionFormat.format(width)} × ${dimensionFormat.format(height)} px`
          : 'Resource dimensions unavailable');

        for (const [target, { resourceDimensions }] of overlays) {
          if (target.currentSrc === url) updateResourceDimensions(target, resourceDimensions);
        }
      }

      dimensionProbes.set(url, probe);
      probe.onload = probe.onerror = finish;
      probe.src = url;
    }

    const text = intrinsicSizes.get(url) ?? (url && dimensionProbes.has(url)
      ? 'Reading resource dimensions…'
      : 'Resource dimensions unavailable');
    if (label.textContent !== text) label.textContent = text;
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const { target, borderBoxSize } of entries) {
      const entry = overlays.get(target);
      if (!entry) continue;

      const box = borderBoxSize?.[0];
      if (!box) {
        updateDimensions(entry.dimensions, target.offsetWidth, target.offsetHeight);
        continue;
      }

      const horizontal = getComputedStyle(target).writingMode === 'horizontal-tb';
      const width = horizontal ? box.inlineSize : box.blockSize;
      const height = horizontal ? box.blockSize : box.inlineSize;
      updateDimensions(entry.dimensions, width, height);
    }
  });
  const fallbackSizes = new Map();
  const fallbackRequests = new AbortController();
  const { signal } = fallbackRequests;
  const hosted = hostedEndpoint(hostedSizeEndpoint);

  async function requestFallbackSize(source) {
    const readImageSize = async (response) => {
      const type = response.headers.get('content-type');
      if (type && !type.toLowerCase().startsWith('image/')) {
        await response.body?.cancel();
        return;
      }
      return (await response.blob()).size;
    };
    let bytes = await readFallbackSize(source, signal, readImageSize);
    let method = 'refetch';
    const endpoints = [];
    if (source.protocol === 'https:' && proxyHosts.has(source.hostname)) {
      endpoints.push(new URL('./__img_info_size', location.href));
    }
    if (hosted && source.protocol === 'https:') endpoints.push(new URL(hosted));

    for (const endpoint of endpoints) {
      if (bytes || signal.aborted) break;
      endpoint.searchParams.set('url', source.href);
      bytes = await readFallbackSize(endpoint, signal, async (response) => {
        const result = await response.json();
        return result?.bytes;
      });
      method = 'proxy';
    }

    if (signal.aborted) return;
    if (bytes) fallbackSizes.set(source.href, { bytes, method });
    for (const [image, { label }] of overlays) {
      if (image.currentSrc === source.href) updateFileSize(image, label);
    }
  }

  function recordSizes(entries) {
    for (const { name, decodedBodySize, initiatorType } of entries) {
      // A separate fetch can receive a different variant of the same URL.
      if (initiatorType !== 'fetch' && initiatorType !== 'xmlhttprequest') {
        resourceSizes.set(name, decodedBodySize);
      }
    }
  }

  function updateFileSize(image, label) {
    const url = image.currentSrc;
    const size = resourceSizes.get(url) ?? resourceSizes.get(url.split('#', 1)[0]);
    let text = 'Size unavailable';
    if (size > 0) {
      text = `${numberFormat.format(size)} B`;
    } else if (image.complete && image.naturalWidth > 0 && url) {
      const source = new URL(url);
      if (['http:', 'https:'].includes(source.protocol) && !source.username && !source.password) {
        if (!fallbackSizes.has(source.href)) {
          fallbackSizes.set(source.href, null);
          void requestFallbackSize(source);
        }
        const fallback = fallbackSizes.get(source.href);
        if (fallback) text = `${numberFormat.format(fallback.bytes)} B (${fallback.method})`;
      }
    }
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
    if (entry) {
      const url = target.currentSrc;
      recordSizes(performance.getEntriesByName(url.split('#', 1)[0], 'resource'));
      updateFileSize(target, entry.label);
      updateResourceDimensions(target, entry.resourceDimensions);
    }
  }


  function syncOverlays() {
    const images = new Set(document.querySelectorAll('img'));
    const newStyles = [];

    for (const [image, { remove }] of overlays) {
      if (images.has(image)) continue;
      resizeObserver.unobserve(image);
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
      const badge = document.createElement('span');
      badge.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        padding: 2px 4px;
        white-space: nowrap;
        color: white !important;
        background: rgb(0 0 0 / 0.8);
        font: 12px/1.2 system-ui, sans-serif;
      `;
      const label = document.createElement('span');
      const resourceDimensions = document.createElement('span');
      const dimensions = document.createElement('span');
      // Story styles can set text color directly on spans.
      label.style.setProperty('color', 'white', 'important');
      resourceDimensions.style.setProperty('color', 'white', 'important');
      resourceDimensions.style.display = 'block';
      dimensions.style.setProperty('color', 'white', 'important');
      dimensions.style.display = 'block';
      updateFileSize(image, label);
      updateResourceDimensions(image, resourceDimensions);
      updateDimensions(dimensions, image.offsetWidth, image.offsetHeight);
      badge.append(label, resourceDimensions, dimensions);
      overlay.append(badge);
      resizeObserver.observe(image, { box: 'border-box' });

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
        overlays.set(image, { label, resourceDimensions, dimensions, remove });
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
      overlays.set(image, { label, resourceDimensions, dimensions, remove });
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
    resizeObserver.disconnect();
    fallbackRequests.abort();
    for (const probe of dimensionProbes.values()) {
      probe.onload = probe.onerror = null;
      probe.removeAttribute('src');
    }
    dimensionProbes.clear();
    document.removeEventListener('load', onImageLoad, true);
    document.removeEventListener('error', onImageLoad, true);
    for (const { remove } of overlays.values()) remove();
  };
}

function reportPolyfillError(error) {
  console.error('Image overlays could not load CSS Anchor Positioning support.', error);
}

export const decorators = [
  (Story, { globals, parameters, viewMode }) => {
    const enabled = viewMode === 'story' && isEnabled(globals[globalKey]);
    const hostedSizeEndpoint = parameters?.[globalKey]?.hostedSizeEndpoint;
    useEffect(() => {
      if (!enabled || typeof document === 'undefined') return;
      if (CSS.supports('top', 'anchor(top)')) return showImageOverlays(undefined, hostedSizeEndpoint);

      let cancelled = false;
      let removeOverlays;
      import('@oddbird/css-anchor-positioning/fn')
        .then(({ default: polyfill }) => {
          if (!cancelled) removeOverlays = showImageOverlays(polyfill, hostedSizeEndpoint);
        })
        .catch(reportPolyfillError);
      return () => {
        cancelled = true;
        removeOverlays?.();
      };
    }, [enabled, hostedSizeEndpoint]);
    return Story();
  },
];
