import * as React from 'react';
import { addons, types } from 'storybook/manager-api';
import { ImageAuditPanel, setCurrentAudit } from './manager/ImageAuditPanel';
import { ImageOverlayToggle } from './manager/ImageOverlayToggle';
import type { AuditSelection } from './shared/audit';
import { addonId, auditEvent, auditPanelId } from './shared/constants';

addons.register(addonId, (api) => {
  addons.getChannel().on(auditEvent, ({ audit, open }: AuditSelection) => {
    setCurrentAudit(audit);
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
    render: ({ active }) => <ImageAuditPanel active={Boolean(active)} />,
  });

  addons.add(`${addonId}/toggle`, {
    type: types.TOOL,
    title: 'Images',
    match: ({ viewMode }) => viewMode === 'story',
    render: ImageOverlayToggle,
  });
});
