export const addonId = 'storybook-addon-img-info';
export const globalKey = 'imgInfo';

export const isEnabled = (value) => value === true || value === 'true';

export const auditPanelId = `${addonId}/audit`;
export const auditEvent = `${auditPanelId}/selection`;

export const densityMetric = 'Layout density';
export const resourcePixelMetric = 'Bits/resource pixel';

export const metricRatings = {
  good: { label: 'Good', rgb: '12 206 106' },
  needsImprovement: { label: 'Needs Improvement', rgb: '255 164 0' },
  poor: { label: 'Poor', rgb: '255 78 66' },
};

export const resourcePixelThresholds = [1.5, 2.5];

export function densityThresholds(dpr) {
  const scaleDpr = Math.max(1, dpr);
  return {
    goodMin: scaleDpr < 1.5 ? 1 : 1.5,
    goodMax: 1.5 * scaleDpr,
    poorCutoff: 2 * scaleDpr,
  };
}
