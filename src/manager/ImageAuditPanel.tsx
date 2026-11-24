import * as React from 'react';
import { AddonPanel } from 'storybook/internal/components';
import type { ImageAudit } from '../shared/audit';
import { renderAuditValue } from './auditValues';

let currentAudit: ImageAudit | null = null;
const auditListeners = new Set<() => void>();

export function setCurrentAudit(audit: ImageAudit | null): void {
  currentAudit = audit;
  for (const listener of auditListeners) listener();
}

function subscribeToAudit(listener: () => void): () => void {
  auditListeners.add(listener);
  return () => { auditListeners.delete(listener); };
}

function AuditImage({ audit }: { audit: ImageAudit }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return <p>Image preview unavailable.</p>;

  return (
    <img
      src={audit.source}
      alt={audit.name}
      crossOrigin={(audit.crossOrigin ?? undefined) as 'anonymous' | 'use-credentials' | '' | undefined}
      referrerPolicy={audit.referrerPolicy || undefined}
      onError={() => setFailed(true)}
      style={{ display: 'block', width: '100%', height: 'auto', margin: '0 0 12px' }}
    />
  );
}

export function ImageAuditPanel({ active }: { active: boolean }) {
  const audit = React.useSyncExternalStore(subscribeToAudit, () => currentAudit);
  return (
    <AddonPanel active={active}>
      {audit ? (
        <div style={{ padding: '16px', overflowWrap: 'anywhere' }}>
          <strong>{audit.name}</strong>
          {audit.source && (
            <>
              <p style={{ margin: '4px 0 12px' }}>{audit.source.startsWith('data:') ? 'Data URL' : audit.source}</p>
              <AuditImage key={audit.source} audit={audit} />
            </>
          )}
          <dl style={{ margin: 0 }}>
            {audit.rows.map((row) => (
              <div key={row[0]} style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(120px, 1fr) minmax(0, 2fr)',
                gap: '12px',
                padding: '4px 0',
              }}>
                <dt>{row[0]}</dt>
                <dd style={{ margin: 0 }}>{renderAuditValue(row, audit.dpr)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p style={{ padding: '16px' }}>Turn on Images in the Canvas toolbar and select an image’s rating badge.</p>
      )}
    </AddonPanel>
  );
}
