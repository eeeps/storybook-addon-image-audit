import { addons } from 'storybook/preview-api';
import type { AuditRow, AuditSelection } from '../shared/audit';
import { auditEvent } from '../shared/constants';
import { watchFileInfo, type FileMeasurement } from './fileInfo';
import { formatLayout, formatRatio } from './formatMeasurements';
import { watchIntrinsicDimensions } from './intrinsicDimensions';
import { measureRatings, type Dimensions } from './metrics';
import { createOverlay, installBadgeFont, paintOverlay, selectBadge, type AnchorPolyfill } from './overlay';

interface OverlayEntry extends ReturnType<typeof createOverlay>, FileMeasurement {
  width: number;
  dimensions: string;
  resource?: Dimensions | null;
  resourceDimensions: string;
  dpr: number;
  metrics: AuditRow[];
}

export function reportPolyfillError(error: unknown): void {
  console.error('Image overlays could not load CSS Anchor Positioning support.', error);
}

export function showImageOverlays(polyfill?: AnchorPolyfill, hostedSizeEndpoint?: string): () => void {
  const overlays = new Map<HTMLImageElement, OverlayEntry>();
  const channel = addons.getChannel();
  const badgeFont = installBadgeFont();
  let selectedImage: HTMLImageElement | undefined;
  let lastAudit: string | undefined;

  function publishAudit(open = false): void {
    const entry = selectedImage && overlays.get(selectedImage);
    const audit: AuditSelection['audit'] = entry ? {
      name: entry.image.alt.trim() || 'Selected image',
      source: entry.image.currentSrc,
      crossOrigin: entry.image.crossOrigin,
      referrerPolicy: entry.image.referrerPolicy as ReferrerPolicy,
      dpr: entry.dpr,
      rows: [
        ['Format', entry.format, { qualifier: entry.formatQualifier }],
        ['Filesize', entry.filesize, { qualifier: entry.filesizeQualifier }],
        ['Resource dimensions', entry.resourceDimensions],
        ['Layout dimensions', entry.dimensions],
        ...entry.metrics,
      ],
    } : null;
    const snapshot = JSON.stringify(audit);
    if (open || snapshot !== lastAudit) {
      lastAudit = snapshot;
      channel.emit(auditEvent, { audit, open } satisfies AuditSelection);
    }
  }

  function updateMetrics(entry: OverlayEntry): void {
    const isSvg = entry.format === 'SVG';
    if (entry.overlay.hidden !== isSvg) entry.overlay.hidden = isSvg;
    if (isSvg && selectedImage === entry.image) {
      selectedImage = undefined;
      selectBadge(entry.button, false);
      publishAudit();
    }

    entry.dpr = window.devicePixelRatio;
    const { rows, worst } = measureRatings(entry.format, entry.bytes, entry.resource, entry.width, entry.dpr);
    entry.metrics = rows;
    paintOverlay(entry, worst);
    if (selectedImage === entry.image) publishAudit();
  }

  const fileInfo = watchFileInfo(hostedSizeEndpoint, (url) => {
    for (const entry of overlays.values()) {
      if (url && entry.image.currentSrc !== url) continue;
      Object.assign(entry, fileInfo.read(entry.image));
      updateMetrics(entry);
    }
  });

  function updateResourceDimensions(entry: OverlayEntry): void {
    const resource = intrinsic.read(entry.image);
    entry.resource = resource;
    entry.resourceDimensions = resource
      ? `${formatRatio(resource.width)} × ${formatRatio(resource.height)} pixels`
      : intrinsic.isPending(entry.image.currentSrc) ? 'Reading resource dimensions…' : 'Resource dimensions unavailable';
    updateMetrics(entry);
  }

  const intrinsic = watchIntrinsicDimensions((url) => {
    for (const entry of overlays.values()) {
      if (entry.image.currentSrc === url) updateResourceDimensions(entry);
    }
  });

  const resizeObserver = new ResizeObserver((entries) => {
    for (const { target, borderBoxSize } of entries) {
      if (!(target instanceof HTMLImageElement)) continue;
      const entry = overlays.get(target);
      if (!entry) continue;

      const box = borderBoxSize?.[0];
      const horizontal = getComputedStyle(target).writingMode === 'horizontal-tb';
      const width = box ? (horizontal ? box.inlineSize : box.blockSize) : target.offsetWidth;
      const height = box ? (horizontal ? box.blockSize : box.inlineSize) : target.offsetHeight;
      entry.width = width;
      entry.dimensions = formatLayout(width, height);
      updateMetrics(entry);
    }
  });

  let resolution: MediaQueryList | undefined;
  function onResolutionChange(): void {
    resolution?.removeEventListener('change', onResolutionChange);
    resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    resolution.addEventListener('change', onResolutionChange);
    for (const entry of overlays.values()) updateMetrics(entry);
  }

  function onImageLoad({ target }: Event): void {
    if (!(target instanceof HTMLImageElement)) return;
    const entry = overlays.get(target);
    if (!entry) return;
    fileInfo.record(target);
    Object.assign(entry, fileInfo.read(target));
    updateResourceDimensions(entry);
  }

  function syncOverlays(): void {
    const images = new Set(document.querySelectorAll('img'));
    const newStyles: HTMLStyleElement[] = [];

    for (const [image, entry] of overlays) {
      if (images.has(image)) continue;
      resizeObserver.unobserve(image);
      entry.remove();
      overlays.delete(image);
      if (selectedImage === image) {
        selectedImage = undefined;
        publishAudit();
      }
    }

    for (const image of images) {
      if (overlays.has(image)) continue;
      const overlay = createOverlay(image, () => {
        selectBadge(selectedImage && overlays.get(selectedImage)?.button, false);
        selectedImage = image;
        selectBadge(overlay.button, true);
        publishAudit(true);
      }, Boolean(polyfill));
      const entry: OverlayEntry = {
        ...overlay,
        ...fileInfo.read(image),
        width: image.offsetWidth,
        dimensions: formatLayout(image.offsetWidth, image.offsetHeight),
        resourceDimensions: 'Resource dimensions unavailable',
        dpr: window.devicePixelRatio,
        metrics: [],
      };
      overlays.set(image, entry);
      updateResourceDimensions(entry);
      resizeObserver.observe(image, { box: 'border-box' });
      if (overlay.style) newStyles.push(overlay.style);
    }

    if (polyfill && newStyles.length) {
      polyfill({ elements: newStyles, excludeInlineStyles: true }).catch(reportPolyfillError);
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
    badgeFont.remove();
    fileInfo.disconnect();
    resizeObserver.disconnect();
    resolution?.removeEventListener('change', onResolutionChange);
    intrinsic.disconnect();
    document.removeEventListener('load', onImageLoad, true);
    document.removeEventListener('error', onImageLoad, true);
    for (const { remove } of overlays.values()) remove();
  };
}
