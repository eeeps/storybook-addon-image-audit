import { Fragment, createElement, type ReactNode } from 'react';
import type { AuditRow, Rating } from '../shared/audit';
import { densityMetric, densityThresholds, metricRatings, resourcePixelMetric, resourcePixelThresholds } from '../shared/constants';
import { AuditPopover } from './AuditPopover';

type RatingStyle = (typeof metricRatings)[Rating];

interface MetricValueProps {
  value: string;
  rating?: RatingStyle;
  title: string;
  suffix?: string;
  children?: ReactNode;
}

function MetricValue({ value, rating, title, suffix, children }: MetricValueProps) {
  return createElement('div', {
    style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' },
  },
    createElement('span', {
      style: rating ? {
        padding: '2px 6px',
        borderRadius: '4px',
        backgroundColor: `rgb(${rating.rgb})`,
        color: '#111',
      } : undefined,
    }, rating ? `${value} · ${rating.label}` : value),
    suffix && createElement('span', null, suffix),
    createElement(AuditPopover, { title }, children),
  );
}

const qualifierHelp = {
  refetch: 'Web security features prevented the image audit from seeing the initial request. This information was derived from a separate request, made for the same URL. These values may be wrong if the server performed content negotiation.',
  proxy: 'Web security features prevented the image audit from seeing the initial request. This information was derived from a separate request, made for the same URL. These values may be wrong if the server performed content negotiation.',
  'URL hint': 'Web security features prevented the image audit from seeing the Content-Type response header. The reported format was inferred from the URL; the actual response may be a different format.',
};

function ResourcePixelValue({ value, rating }: Pick<MetricValueProps, 'value' | 'rating'>) {
  const [goodMax, improvementMax] = resourcePixelThresholds;

  return createElement(MetricValue, { value, rating, title: 'Bits per resource pixel' },
      createElement('p', null,
        'The selected image’s file size in bits divided by its total pixel count (resource width × height). ',
        'Lower values signify an image has been “more compressed” (risking visual artifacts); higher values signify an image has been “less compressed” (risking overly-large files).'),
      createElement('p', null, `Without evaluating image quality, we can only check for images that have been obviously “under-compressed“, and could likely be significantly smaller with minimal quality loss if they were encoded using modern formats (like AVIF or JPEG-XL) and/or lower quality settings. The qualitative thresholds thresholds are:`),
      createElement('ul', { style: { paddingInlineStart: '20px' } },
        createElement('li', null, `Good: ≤ ${goodMax}`),
        createElement('li', null, `Needs Improvement: > ${goodMax} and ≤ ${improvementMax}`),
        createElement('li', null, `Poor: > ${improvementMax}`)
      )
  );
}

const densityFormat = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });

function DensityValue({ value, rating, dpr }: Pick<MetricValueProps, 'value' | 'rating'> & { dpr: number }) {
  const { goodMin, goodMax, poorCutoff } = densityThresholds(dpr);
  const showDensity = (number: number) => `${densityFormat.format(number)}×`;
  return createElement(MetricValue, {
    value,
    rating,
    title: densityMetric,
    suffix: `(DPR ${showDensity(dpr)})`,
  },
    createElement('p', null, 'The selected resource’s width in pixels divided by the image’s layout width in CSS pixels. A density below the current window.devicePixelRatio (DPR) means the image is being upscaled, and may look blurry. A density above the current DPR means the image is being downscaled, wasting bytes.'),
    createElement('p', null, `When image width is fluid, layout density will almost never exactly match DPR. At DPR ${showDensity(dpr)}, the qualitative thresholds are:`),
    createElement('ul', { style: { paddingInlineStart: '20px' } },
      createElement('li', null, `Good: ${showDensity(goodMin)} through ${showDensity(goodMax)}`),
      createElement('li', null, goodMin > 1
        ? `Needs Improvement: 1× to below ${showDensity(goodMin)}, or above ${showDensity(goodMax)} through ${showDensity(poorCutoff)}`
        : `Needs Improvement: above ${showDensity(goodMax)} through ${showDensity(poorCutoff)}`),
      createElement('li', null, `Poor: below 1× or above ${showDensity(poorCutoff)}`))
  );
}

export function renderAuditValue([label, value, { rating, qualifier } = {}]: AuditRow, dpr: number) {
  if (label === densityMetric) {
    return createElement(DensityValue, { value, rating: rating ? metricRatings[rating] : undefined, dpr });
  }
  if (label === resourcePixelMetric) {
    return createElement(ResourcePixelValue, { value, rating: rating ? metricRatings[rating] : undefined });
  }
  if (qualifier && Object.hasOwn(qualifierHelp, qualifier)) {
    const trigger = `(${qualifier})`;
    return createElement(Fragment, null, value, ' ',
      createElement(AuditPopover, {
        title: `${label} ${trigger}`,
        trigger,
        label: `Explain ${trigger} for ${label}`,
      }, createElement('p', { style: { marginBottom: 0 } }, qualifierHelp[qualifier])),
    );
  }
  return value;
}

