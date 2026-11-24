import type { AuditRow, Rating } from '../shared/audit';
import { densityMetric, densityThresholds, resourcePixelMetric, resourcePixelThresholds } from '../shared/constants';
import { formatRatio } from './formatMeasurements';

export interface Dimensions {
  width: number;
  height: number;
}

export function measureRatings(
  format: string,
  bytes: number | undefined,
  resource: Dimensions | null | undefined,
  layoutWidth: number,
  dpr: number,
): { rows: AuditRow[]; worst: Rating | undefined } {
  const density = resource && layoutWidth > 0 ? resource.width / layoutWidth : NaN;
  const resourceRate = bytes && resource ? bytes * 8 / (resource.width * resource.height) : NaN;
  const { goodMin, goodMax, poorCutoff } = densityThresholds(dpr);
  let densityRating: Rating | undefined;
  if (format !== 'SVG' && Number.isFinite(density)) {
    if (density < 1 || density > poorCutoff) densityRating = 'poor';
    else if (density >= goodMin && density <= goodMax) densityRating = 'good';
    else densityRating = 'needsImprovement';
  }

  const [goodLimit, improvementLimit] = resourcePixelThresholds;
  let compressionRating: Rating | undefined;
  if (format !== 'SVG' && Number.isFinite(resourceRate)) {
    if (resourceRate <= goodLimit) compressionRating = 'good';
    else if (resourceRate <= improvementLimit) compressionRating = 'needsImprovement';
    else compressionRating = 'poor';
  }

  const ratings: Rating[] = ['poor', 'needsImprovement', 'good'];
  return {
    rows: [
      [densityMetric, Number.isFinite(density) ? `${formatRatio(density)}×` : 'Unavailable', { rating: densityRating }],
      [resourcePixelMetric, Number.isFinite(resourceRate) ? formatRatio(resourceRate) : 'Unavailable', { rating: compressionRating }],
    ],
    worst: ratings.find((rating) => rating === densityRating || rating === compressionRating),
  };
}
