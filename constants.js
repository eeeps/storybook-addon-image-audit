export const addonId = 'storybook-addon-img-info';
export const globalKey = 'imgInfo';

export const isEnabled = (value) => value === true || value === 'true';

export const auditPanelId = `${addonId}/audit`;
export const auditEvent = `${auditPanelId}/selection`;

export const densityMetric = 'Density';
export const resourcePixelMetric = 'Bits/resource pixel';

export const metricRatings = {
  good: { label: 'Good', color: '#0CCE6A' },
  needsImprovement: { label: 'Needs Improvement', color: '#FFA400' },
  poor: { label: 'Poor', color: '#FF4E42' },
};

export const resourcePixelThresholds = [1.5, 2.4];

export function densityThresholds(dpr) {
  const scaleDpr = Math.max(1, dpr);
  return {
    goodMin: scaleDpr < 1.5 ? 1 : 1.5,
    goodMax: 1.5 * scaleDpr,
    poorCutoff: 2 * scaleDpr,
  };
}
