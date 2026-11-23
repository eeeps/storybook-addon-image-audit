import { createElement, useState, useSyncExternalStore } from 'react';
import { AddonPanel, ToggleButton } from 'storybook/internal/components';
import { addons, types, useGlobals } from 'storybook/manager-api';
import { addonId, auditEvent, auditPanelId, globalKey, isEnabled } from './constants.js';

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

function ImageAuditPanel({ active }) {
  const audit = useSyncExternalStore(subscribeToAudit, () => currentAudit);
  const content = audit
    ? createElement('div', { style: { padding: '16px', overflowWrap: 'anywhere' } },
        createElement('strong', null, audit.name),
        audit.source && createElement('p', { style: { margin: '4px 0 12px' } },
          audit.source.startsWith('data:') ? 'Data URL' : audit.source),
        audit.source && createElement(AuditImage, { key: audit.source, audit }),
        createElement('dl', { style: { margin: 0 } },
          audit.rows.map(([label, value]) => createElement('div', {
            key: label,
            style: {
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 2fr)',
              gap: '12px',
              padding: '4px 0',
            },
          },
          createElement('dt', null, label),
          createElement('dd', { style: { margin: 0 } }, value),
          )),
        ))
    : createElement('p', { style: { padding: '16px' } },
        'Turn on Images in the Canvas toolbar and select an image’s info button.');

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
