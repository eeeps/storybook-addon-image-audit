import type { Rating } from '../shared/audit';
import { addonId, metricRatings } from '../shared/constants';

export type AnchorPolyfill = typeof import('@oddbird/css-anchor-positioning/fn').default;

interface ImageOverlay {
  image: HTMLImageElement;
  overlay: HTMLDivElement;
  button: HTMLButtonElement;
  remove: () => void;
  style?: HTMLStyleElement;
  rating?: Rating;
}

let nextAnchor = 0;

function setAuditBadgeLabel(button: HTMLButtonElement, image: HTMLImageElement, label: string) {
  button.textContent = label;
  const imageName = image.alt.trim();
  const action = imageName ? `Open Image audit for ${imageName}` : 'Open Image audit';
  const description = `${label} — ${action}`;
  button.setAttribute('aria-label', description);
  button.title = description;
}

export function installBadgeFont(): HTMLStyleElement {
  const badgeFont = document.createElement('style');
  const fontUrl = new URL('./sb-common-assets/nunito-sans-bold.woff2', location.href);
  badgeFont.textContent = `
    @font-face {
      font-family: "Image Audit Nunito Sans";
      src: url(${JSON.stringify(fontUrl.href)}) format("woff2");
      font-weight: 700;
      font-display: swap;
    }
  `;
  document.head.append(badgeFont);
  return badgeFont;
}

export function selectBadge(button: HTMLButtonElement | undefined, selected: boolean): void {
  if (!button) return;
  if (selected) {
    button.setAttribute('aria-current', 'true');
    button.style.setProperty('box-shadow', '0 0 0 2px #fff, 0 0 0 4px #1565c0', 'important');
  } else {
    button.removeAttribute('aria-current');
    button.style.removeProperty('box-shadow');
  }
}

export function paintOverlay(entry: ImageOverlay, worst?: Rating): void {
  if (entry.rating === worst) return;
  entry.rating = worst;
  const rating = worst ? metricRatings[worst] : undefined;
  entry.overlay.style.backgroundColor = `rgb(${rating?.rgb ?? '128 128 128'} / 0.3625)`;
  entry.button.style.setProperty('background-color', rating ? `rgb(${rating.rgb})` : '#222', 'important');
  entry.button.style.setProperty('color', rating ? '#111' : '#fff', 'important');
  setAuditBadgeLabel(entry.button, entry.image, rating?.label ?? 'Unrated');
}

export function createOverlay(
  image: HTMLImageElement,
  onSelect: () => void,
  usePolyfill: boolean,
): ImageOverlay {
  const anchor = `--${addonId}-${++nextAnchor}`;
  const overlay = document.createElement('div');
  overlay.dataset.imgInfoOverlay = anchor;
  overlay.style.cssText = `
    position: fixed;
    position-visibility: anchors-visible;
    background: rgb(128 128 128 / 0.25);
    pointer-events: none;
    z-index: 2147483647;
  `;
  const button = document.createElement('button');
  button.type = 'button';
  setAuditBadgeLabel(button, image, 'Unrated');
  button.style.cssText = `
    position: absolute;
    top: clamp(0px, 100% - 28px, 4px);
    right: clamp(0px, 100% - 32px, 4px);
    display: block;
    box-sizing: border-box;
    width: max-content;
    min-width: 0;
    max-width: calc(100% - clamp(0px, 100% - 32px, 4px));
    min-height: 0;
    max-height: calc(100% - clamp(0px, 100% - 28px, 4px));
    height: 28px;
    margin: 0;
    padding: 0 min(7px, 8%);
    border: 1px solid rgb(255 255 255 / 0.85);
    border-radius: 4px;
    text-transform: none !important;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: normal;
    outline: revert;
    background-color: #222 !important;
    color: #fff !important;
    font: 700 12px/1 "Image Audit Nunito Sans", "Nunito Sans", -apple-system, system-ui, sans-serif !important;
    cursor: pointer;
    pointer-events: auto;
  `;

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect();
  });
  overlay.append(button);

  const position = `
    position-anchor: ${anchor};
    top: anchor(top);
    right: anchor(right);
    bottom: anchor(bottom);
    left: anchor(left);
  `;

  if (usePolyfill) {
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
    const remove = () => {
      overlay.remove();
      style.remove();
      if (originalMarker === null) image.removeAttribute(marker);
      else image.setAttribute(marker, originalMarker);
    };
    return { image, overlay, button, remove, style };
  }

  const originalStyle = image.getAttribute('style');
  const originalName = image.style.getPropertyValue('anchor-name');
  const originalPriority = image.style.getPropertyPriority('anchor-name');
  const computedName = getComputedStyle(image).getPropertyValue('anchor-name');
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
  return { image, overlay, button, remove };
}
