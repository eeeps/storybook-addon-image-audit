import type { metricRatings } from './constants';

export type Rating = keyof typeof metricRatings;
export type Qualifier = 'refetch' | 'proxy' | 'URL hint';
export type AuditRow = [label: string, value: string, details?: {
  rating?: Rating;
  qualifier?: Qualifier;
}];

export interface ImageAudit {
  name: string;
  source: string;
  crossOrigin: string | null;
  referrerPolicy: ReferrerPolicy;
  dpr: number;
  rows: AuditRow[];
}

export interface AuditSelection {
  audit: ImageAudit | null;
  open: boolean;
}

export interface ImageAuditParameters {
  hostedSizeEndpoint?: string;
}
