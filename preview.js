import { addons, useEffect } from 'storybook/preview-api';
import { addonId, auditEvent, globalKey, isEnabled } from './constants.js';

export const initialGlobals = { [globalKey]: false };

let nextAnchor = 0;
const proxyHosts = new Set(
  typeof __IMG_INFO_PROXY_HOSTS__ === 'undefined' ? [] : __IMG_INFO_PROXY_HOSTS__,
);

const formatByExtension = new Map([
  ['jpg', 'JPEG'], ['jpeg', 'JPEG'], ['jfif', 'JPEG'], ['png', 'PNG'],
  ['apng', 'APNG'], ['gif', 'GIF'], ['svg', 'SVG'], ['svgz', 'SVG'],
  ['webp', 'WebP'], ['avif', 'AVIF'], ['jxl', 'JPEG XL'], ['bmp', 'BMP'],
  ['ico', 'ICO'], ['tiff', 'TIFF'], ['tif', 'TIFF'], ['heic', 'HEIC'], ['heif', 'HEIF'],
]);

function formatFromContentType(value) {
  if (typeof value !== 'string') return;
  const type = value.split(';', 1)[0].trim().toLowerCase();
  if (!/^image\/[a-z0-9][a-z0-9.+-]*$/.test(type)) return;
  const subtype = type.slice('image/'.length);
  if (subtype === 'svg+xml') return 'SVG';
  if (subtype === 'pjpeg') return 'JPEG';
  if (subtype === 'vnd.microsoft.icon') return 'ICO';
  return formatByExtension.get(subtype.replace(/^x-/, '')) ?? type;
}

function formatFromUrl(url) {
  if (url.protocol === 'data:') {
    return formatFromContentType(/^data:([^;,]*)/i.exec(url.href)?.[1]);
  }
  if (url.protocol === 'blob:') return;
  const extension = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1];
  return formatByExtension.get(extension?.toLowerCase());
}

async function readFallbackInfo(url, signal, readInfo) {
  try {
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (response.ok) {
      const info = await readInfo(response);
      if (Number.isSafeInteger(info?.bytes) && info.bytes > 0) return info;
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
  const channel = addons.getChannel();
  let selectedImage;
  let lastAudit;

  function publishAudit(open = false) {
    const entry = overlays.get(selectedImage);
    const audit = entry ? {
      name: selectedImage.alt.trim() || 'Selected image',
      source: selectedImage.currentSrc,
      crossOrigin: selectedImage.crossOrigin,
      referrerPolicy: selectedImage.referrerPolicy,
      rows: [
        ['Format', entry.format],
        ['Filesize', entry.filesize],
        ['Resource', entry.resourceDimensions],
        ['Layout', entry.dimensions],
        ...entry.metrics,
      ],
    } : null;
    const snapshot = JSON.stringify(audit);
    if (open || snapshot !== lastAudit) {
      lastAudit = snapshot;
      channel.emit(auditEvent, { audit, open });
    }
  }
  const resourceInfo = new Map();
  const intrinsicSizes = new Map();
  const dimensionProbes = new Map();
  const dimensionFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

  const dprFormat = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });

  function formatFilesize(bytes) {
    if (bytes >= 1e9) return `${dimensionFormat.format(bytes / 1e9)} GB`;
    if (bytes >= 1e6) return `${dimensionFormat.format(bytes / 1e6)} MB`;
    if (bytes >= 1e3) return `${dimensionFormat.format(bytes / 1e3)} kB`;
    return `${dimensionFormat.format(bytes)} B`;
  }

  function updateMetrics(entry) {
    const { bytes, resource, width, height } = entry;
    const density = resource && width > 0 ? resource.width / width : NaN;
    const resourceRate = bytes && resource ? bytes * 8 / (resource.width * resource.height) : NaN;
    const dpr = window.devicePixelRatio;
    const displayDensity = Number.isFinite(density)
      ? `${dimensionFormat.format(density)}×`
      : 'Unavailable';
    const deviceRate = bytes && width > 0 && height > 0 && dpr > 0
      ? bytes * 8 / (width * height * dpr ** 2)
      : NaN;
    const format = (value) => Number.isFinite(value)
      ? dimensionFormat.format(value)
      : 'Unavailable';

    entry.metrics = [
      ['Density', `${displayDensity} (DPR ${dprFormat.format(dpr)}×)`],
      ['Bits/resource pixel', format(resourceRate)],
      ['Bits/device pixel', format(deviceRate)],
    ];
    if (selectedImage && overlays.get(selectedImage) === entry) publishAudit();
  }

  let resolution;
  function onResolutionChange() {
    resolution?.removeEventListener('change', onResolutionChange);
    resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    resolution.addEventListener('change', onResolutionChange);
    for (const entry of overlays.values()) updateMetrics(entry);
  }

  function updateDimensions(entry, width, height) {
    entry.width = width;
    entry.height = height;
    entry.dimensions = `${dimensionFormat.format(width)} × ${dimensionFormat.format(height)} CSS px`;
    updateMetrics(entry);
  }

  function updateResourceDimensions(image, entry) {
    const url = image.currentSrc;
    if (image.complete && url && !intrinsicSizes.has(url) && !dimensionProbes.has(url)) {
      const probe = new Image();
      if (image.crossOrigin !== null) probe.crossOrigin = image.crossOrigin;
      probe.referrerPolicy = image.referrerPolicy;

      function finish() {
        probe.onload = probe.onerror = null;
        dimensionProbes.delete(url);
        const { naturalWidth: width, naturalHeight: height } = probe;
        intrinsicSizes.set(url, width && height ? { width, height } : null);

        for (const [target, overlayEntry] of overlays) {
          if (target.currentSrc === url) updateResourceDimensions(target, overlayEntry);
        }
      }

      dimensionProbes.set(url, probe);
      probe.onload = probe.onerror = finish;
      probe.src = url;
    }

    const resource = intrinsicSizes.get(url);
    entry.resource = resource;
    let text = 'Resource dimensions unavailable';
    if (resource) {
      text = `${dimensionFormat.format(resource.width)} × ${dimensionFormat.format(resource.height)} pixels`;
    } else if (dimensionProbes.has(url)) {
      text = 'Reading resource dimensions…';
    }
    entry.resourceDimensions = text;
    updateMetrics(entry);
  }

  const resizeObserver = new ResizeObserver((entries) => {
    for (const { target, borderBoxSize } of entries) {
      const entry = overlays.get(target);
      if (!entry) continue;

      const box = borderBoxSize?.[0];
      if (!box) {
        updateDimensions(entry, target.offsetWidth, target.offsetHeight);
        continue;
      }

      const horizontal = getComputedStyle(target).writingMode === 'horizontal-tb';
      const width = horizontal ? box.inlineSize : box.blockSize;
      const height = horizontal ? box.blockSize : box.inlineSize;
      updateDimensions(entry, width, height);
    }
  });
  const fallbackInfo = new Map();
  const fallbackRequests = new AbortController();
  const { signal } = fallbackRequests;
  const hosted = hostedEndpoint(hostedSizeEndpoint);

  async function requestFallbackSize(source) {
    const readImageInfo = async (response) => {
      const type = response.headers.get('content-type');
      if (type && !type.toLowerCase().startsWith('image/')) {
        await response.body?.cancel();
        return;
      }
      return { bytes: (await response.blob()).size, contentType: type };
    };
    let info = await readFallbackInfo(source, signal, readImageInfo);
    let method = 'refetch';
    const endpoints = [];
    if (source.protocol === 'https:' && proxyHosts.has(source.hostname)) {
      endpoints.push(new URL('./__img_info_size', location.href));
    }
    if (hosted && source.protocol === 'https:') endpoints.push(new URL(hosted));

    for (const endpoint of endpoints) {
      if (info || signal.aborted) break;
      endpoint.searchParams.set('url', source.href);
      info = await readFallbackInfo(endpoint, signal, (response) => response.json());
      method = 'proxy';
    }

    if (signal.aborted) return;
    if (info) fallbackInfo.set(source.href, { ...info, method });
    for (const [image, entry] of overlays) {
      if (image.currentSrc === source.href) updateFileInfo(image, entry);
    }
  }

  function recordResourceInfo(entries) {
    for (const { name, decodedBodySize, contentType, initiatorType } of entries) {
      // A separate fetch can receive a different variant of the same URL.
      if (initiatorType !== 'fetch' && initiatorType !== 'xmlhttprequest') {
        const previous = resourceInfo.get(name);
        resourceInfo.set(name, {
          bytes: decodedBodySize || previous?.bytes,
          contentType: formatFromContentType(contentType) ? contentType : previous?.contentType,
        });
      }
    }
  }

  function updateFileInfo(image, entry) {
    const url = image.currentSrc;
    const timing = resourceInfo.get(url) ?? resourceInfo.get(url.split('#', 1)[0]);
    const size = timing?.bytes;
    const source = url ? new URL(url) : undefined;
    let fallback;
    entry.bytes = undefined;
    let text = 'Unavailable';
    if (size > 0) {
      entry.bytes = size;
      text = formatFilesize(size);
    } else if (image.complete && image.naturalWidth > 0 && source) {
      if (['http:', 'https:'].includes(source.protocol) && !source.username && !source.password) {
        if (!fallbackInfo.has(source.href)) {
          fallbackInfo.set(source.href, null);
          void requestFallbackSize(source);
        }
        fallback = fallbackInfo.get(source.href);
        if (fallback) {
          entry.bytes = fallback.bytes;
          text = `${formatFilesize(fallback.bytes)} (${fallback.method})`;
        }
      }
    }
    const responseFormat = formatFromContentType(timing?.contentType);
    const fallbackFormat = formatFromContentType(fallback?.contentType);
    const urlFormat = source && formatFromUrl(source);
    let format = 'Unknown';
    if (responseFormat) format = responseFormat;
    else if (fallbackFormat) format = `${fallbackFormat} (${fallback.method})`;
    else if (urlFormat) format = `${urlFormat} (URL hint)`;

    entry.format = format;
    entry.filesize = text;
    updateMetrics(entry);
  }

  recordResourceInfo(performance.getEntriesByType('resource'));
  let timingObserver;
  if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes('resource')) {
    timingObserver = new PerformanceObserver((list) => {
      recordResourceInfo(list.getEntries());
      for (const [image, entry] of overlays) updateFileInfo(image, entry);
    });
    timingObserver.observe({ type: 'resource', buffered: true });
  }

  function onImageLoad({ target }) {
    const entry = overlays.get(target);
    if (entry) {
      const url = target.currentSrc;
      recordResourceInfo(performance.getEntriesByName(url.split('#', 1)[0], 'resource'));
      updateFileInfo(target, entry);
      updateResourceDimensions(target, entry);
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
      if (selectedImage === image) {
        selectedImage = undefined;
        publishAudit();
      }
    }

    for (const image of images) {
      if (overlays.has(image)) continue;

      const anchor = `--${addonId}-${++nextAnchor}`;
      const overlay = document.createElement('div');
      overlay.dataset.imgInfoOverlay = anchor;
      overlay.style.cssText = `
        position: fixed;
        position-visibility: anchors-visible;
        background: rgb(100% 0% 0% / 0.25);
        pointer-events: none;
        z-index: 2147483647;
      `;
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'ⓘ';
      button.title = 'Open Image audit';
      button.setAttribute('aria-label', image.alt.trim()
        ? `Open Image audit for ${image.alt.trim()}`
        : 'Open Image audit');
      button.style.cssText = `
        position: absolute;
        top: 4px;
        right: 4px;
        display: grid;
        place-items: center;
        box-sizing: border-box;
        width: 24px;
        height: 24px;
        min-width: 0;
        min-height: 0;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 50%;
        outline: revert;
        background: #222 !important;
        color: #fff !important;
        font: 16px/1 system-ui, sans-serif;
        cursor: pointer;
        pointer-events: auto;
      `;
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const previousButton = overlays.get(selectedImage)?.button;
        previousButton?.removeAttribute('aria-current');
        previousButton?.style.removeProperty('box-shadow');
        selectedImage = image;
        button.setAttribute('aria-current', 'true');
        button.style.setProperty('box-shadow', '0 0 0 2px #fff, 0 0 0 4px #1565c0', 'important');
        publishAudit(true);
      });

      const entry = { button };
      updateFileInfo(image, entry);
      updateResourceDimensions(image, entry);
      updateDimensions(entry, image.offsetWidth, image.offsetHeight);
      overlay.append(button);
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
        entry.remove = remove;
        overlays.set(image, entry);
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
      entry.remove = remove;
      overlays.set(image, entry);
    }

    if (newStyles.length) {
      polyfill({ elements: newStyles, excludeInlineStyles: true })
        .catch(reportPolyfillError);
    }
  }

  syncOverlays();
  onResolutionChange();
  document.addEventListener('load', onImageLoad, true);
  document.addEventListener('error', onImageLoad, true);
  const observer = new MutationObserver(syncOverlays);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    if (selectedImage) {
      selectedImage = undefined;
      publishAudit();
    }
    observer.disconnect();
    timingObserver?.disconnect();
    resizeObserver.disconnect();
    resolution.removeEventListener('change', onResolutionChange);
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
  (Story, { globals, id, parameters, viewMode }) => {
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
    }, [enabled, hostedSizeEndpoint, id]);
    return Story();
  },
];
