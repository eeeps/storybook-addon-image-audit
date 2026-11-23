import { createElement, useId, useState, useSyncExternalStore } from 'react';
import { AddonPanel, ToggleButton } from 'storybook/internal/components';
import { addons, types, useGlobals } from 'storybook/manager-api';
import { addonId, auditEvent, auditPanelId, densityMetric, densityThresholds, globalKey, isEnabled, metricRatings, resourcePixelMetric, resourcePixelThresholds } from './constants.js';

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

let currentAudit = null;
const auditListeners = new Set();

function subscribeToAudit(listener) {
  auditListeners.add(listener);
  return () => auditListeners.delete(listener);
}

function AuditImage({ audit }) {
  const [failed, setFailed] = useState(false);
  if (failed) return createElement('p', null, 'Image preview unavailable.');

  return createElement('img', {
    src: audit.source,
    alt: audit.name,
    crossOrigin: audit.crossOrigin ?? undefined,
    referrerPolicy: audit.referrerPolicy || undefined,
    onError: () => setFailed(true),
    style: { display: 'block', width: '100%', height: 'auto', margin: '0 0 12px' },
  });
}

function MetricValue({ value, rating, title, suffix, children }) {
  const id = useId();
  const titleId = `${id}-title`;

  return createElement('div', {
    style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' },
    onKeyDown: (event) => {
      if (event.key !== 'Escape') return;
      const popover = event.currentTarget.ownerDocument.getElementById(id);
      if (!popover?.matches(':popover-open')) return;
      event.preventDefault();
      event.stopPropagation();
      popover.hidePopover();
    },
  },
    createElement('span', {
      style: rating ? {
        padding: '2px 6px',
        borderRadius: '4px',
        backgroundColor: rating.color,
        color: '#111',
      } : undefined,
    }, rating ? `${value} · ${rating.label}` : value),
    suffix && createElement('span', null, suffix),
    createElement('button', {
      type: 'button',
      popoverTarget: id,
      'aria-label': `Explain ${title.toLowerCase()}`,
      style: {
        border: '1px solid currentColor',
        borderRadius: '50%',
        background: 'transparent',
        color: 'inherit',
        width: '24px',
        height: '24px',
        padding: 0,
        cursor: 'pointer',
      },
    }, '?'),
    createElement('div', {
      id,
      popover: 'auto',
      role: 'region',
      'aria-labelledby': titleId,
      style: {
        position: 'fixed',
        positionArea: 'bottom span-left',
        positionTryFallbacks: 'flip-block, flip-inline, flip-block flip-inline',
        ...(CSS.supports('position-area', 'bottom span-left') && { marginBlock: '6px' }),
        width: 'min(320px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 32px)',
        boxSizing: 'border-box',
        overflow: 'auto',
        border: '1px solid GrayText',
        borderRadius: '8px',
        background: 'Canvas',
        color: 'CanvasText',
        padding: '12px 16px',
        lineHeight: 1.5,
      },
    },
      createElement('strong', { id: titleId }, title),
      children,
    ),
  );
}

function ResourcePixelValue({ value, rating }) {
  const [goodMax, improvementMax] = resourcePixelThresholds;

  return createElement(MetricValue, { value, rating, title: 'Bits per resource pixel' },
      createElement('p', null,
        'The selected image’s file size in bits divided by its intrinsic width × height. ',
        'Lower values mean fewer bits per source pixel. Visual quality depends on the image.'),
      createElement('ul', { style: { paddingInlineStart: '20px' } },
        createElement('li', null, `Good: ≤ ${goodMax}`),
        createElement('li', null, `Needs Improvement: > ${goodMax} and ≤ ${improvementMax}`),
        createElement('li', null, `Poor: > ${improvementMax}`)),
      createElement('p', { style: { marginBottom: 0 } },
        'These compression heuristics rate JPEGs identified by response MIME type. ',
        'The rating uses the value before rounding. Refetch and proxy sizes may come from a different variant.'),
  );
}

const densityFormat = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });

function DensityValue({ value, rating, dpr }) {
  const { goodMin, goodMax, poorCutoff } = densityThresholds(dpr);
  const showDensity = (number) => `${densityFormat.format(number)}×`;
  return createElement(MetricValue, {
    value,
    rating,
    title: 'Density',
    suffix: `(DPR ${showDensity(dpr)})`,
  },
    createElement('p', null, 'The selected resource’s width in pixels divided by the image’s layout width in CSS pixels. A density below 1× means the image is upscaled.'),
    createElement('p', null, `At DPR ${showDensity(dpr)}, the ranges are:`),
    createElement('ul', { style: { paddingInlineStart: '20px' } },
      createElement('li', null, `Good: ${showDensity(goodMin)} through ${showDensity(goodMax)}`),
      createElement('li', null, goodMin > 1
        ? `Needs Improvement: 1× to below ${showDensity(goodMin)}, or above ${showDensity(goodMax)} through ${showDensity(poorCutoff)}`
        : `Needs Improvement: above ${showDensity(goodMax)} through ${showDensity(poorCutoff)}`),
      createElement('li', null, `Poor: below 1× or above ${showDensity(poorCutoff)}`)),
    createElement('p', { style: { marginBottom: 0 } },
      'The upper Good cutoff allows for ordinary srcset overshoot. Ratings use the unrounded value and use 1× as the minimum DPR for the thresholds.'),
  );
}

function renderAuditValue(label, value, rating, dpr) {
  if (label === densityMetric) {
    return createElement(DensityValue, { value, rating, dpr });
  }
  if (label === resourcePixelMetric) {
    return createElement(ResourcePixelValue, { value, rating });
  }
  return value;
}

function ImageAuditPanel({ active }) {
  const audit = useSyncExternalStore(subscribeToAudit, () => currentAudit);
  const content = audit
    ? createElement('div', { style: { padding: '16px', overflowWrap: 'anywhere' } },
        createElement('strong', null, audit.name),
        audit.source && createElement('p', { style: { margin: '4px 0 12px' } },
          audit.source.startsWith('data:') ? 'Data URL' : audit.source),
        audit.source && createElement(AuditImage, { key: audit.source, audit }),
        createElement('dl', { style: { margin: 0 } },
          audit.rows.map(([label, value, rating]) => createElement('div', {
            key: label,
            style: {
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 2fr)',
              gap: '12px',
              padding: '4px 0',
            },
          },
          createElement('dt', null, label),
          createElement('dd', { style: { margin: 0 } }, renderAuditValue(label, value, metricRatings[rating], audit.dpr)),
          )),
        ))
    : createElement('p', { style: { padding: '16px' } },
        'Turn on Images in the Canvas toolbar and select an image’s rating badge.');

  return createElement(AddonPanel, { active }, content);
}

addons.register(addonId, (api) => {
  addons.getChannel().on(auditEvent, ({ audit, open }) => {
    currentAudit = audit;
    for (const listener of auditListeners) listener();
    if (open) {
      if (api.getIsFullscreen()) api.toggleFullscreen(false);
      api.togglePanel(true);
      api.setSelectedPanel(auditPanelId);
    }
  });
  addons.add(auditPanelId, {
    type: types.PANEL,
    title: 'Image audit',
    match: ({ viewMode }) => viewMode === 'story',
    render: (props) => createElement(ImageAuditPanel, props),
  });

  addons.add(`${addonId}/toggle`, {
    type: types.TOOL,
    match: ({ viewMode }) => viewMode === 'story',
    render: ImageOverlayToggle,
  });
});
