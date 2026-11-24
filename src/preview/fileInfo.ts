import type { Qualifier } from '../shared/audit';
import { formatFilesize } from './formatMeasurements';
import { formatFromContentType, formatFromUrl } from './imageFormat';

declare const __IMG_INFO_PROXY_HOSTS__: string[] | undefined;
const proxyHosts = new Set(
  typeof __IMG_INFO_PROXY_HOSTS__ === 'undefined' ? [] : __IMG_INFO_PROXY_HOSTS__,
);

type FallbackMethod = Exclude<Qualifier, 'URL hint'>;

interface FileInfo {
  bytes: number;
  contentType?: unknown;
}

interface TimingInfo {
  bytes?: number;
  contentType?: string;
}

export interface FileMeasurement {
  bytes?: number;
  format: string;
  formatQualifier?: Qualifier;
  filesize: string;
  filesizeQualifier?: FallbackMethod;
}

async function readFallbackInfo(url: URL, signal: AbortSignal, readInfo: (response: Response) => Promise<unknown>): Promise<FileInfo | undefined> {
  try {
    const response = await fetch(url, { signal, credentials: 'omit' });
    if (response.ok) {
      const info = await readInfo(response) as Partial<FileInfo> | null | undefined;
      if (typeof info?.bytes === 'number' && Number.isSafeInteger(info.bytes) && info.bytes > 0) {
        return { bytes: info.bytes, contentType: info.contentType };
      }
    }
  } catch {
    // An unavailable fallback leaves the next one eligible.
  }
}

function hostedEndpoint(value: unknown) {
  if (typeof value !== 'string') return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url;
  } catch {
    // An invalid endpoint leaves the hosted fallback disabled.
  }
}

export function watchFileInfo(hostedSizeEndpoint: unknown, onChange: (url?: string) => void) {
  const resourceInfo = new Map<string, TimingInfo>();
  const fallbackInfo = new Map<string, (FileInfo & { method: FallbackMethod }) | null>();
  const fallbackRequests = new AbortController();
  const { signal } = fallbackRequests;
  const hosted = hostedEndpoint(hostedSizeEndpoint);

  async function requestFallbackSize(source: URL) {
    const readImageInfo = async (response: Response) => {
      const type = response.headers.get('content-type');
      if (type && !type.toLowerCase().startsWith('image/')) {
        await response.body?.cancel();
        return;
      }
      return { bytes: (await response.blob()).size, contentType: type };
    };
    let info = await readFallbackInfo(source, signal, readImageInfo);
    let method: FallbackMethod = 'refetch';
    const endpoints = [];
    if (source.protocol === 'https:' && proxyHosts.has(source.hostname)) {
      endpoints.push(new URL('./__img_info_size', location.href));
    }
    if (hosted && source.protocol === 'https:') endpoints.push(new URL(hosted));

    for (const endpoint of endpoints) {
      if (info || signal.aborted) break;
      endpoint.searchParams.set('url', source.href);
      info = await readFallbackInfo(endpoint, signal, (response) => response.json());
      method = 'proxy';
    }

    if (signal.aborted) return;
    if (info) fallbackInfo.set(source.href, { ...info, method });
    onChange(source.href);
  }

  function recordResourceInfo(entries: PerformanceEntry[]) {
    for (const entry of entries) {
      if (entry.entryType !== 'resource') continue;
      const { name, decodedBodySize, contentType, initiatorType } =
        entry as PerformanceResourceTiming & { contentType?: string };
      // A separate fetch can receive a different variant of the same URL.
      if (initiatorType !== 'fetch' && initiatorType !== 'xmlhttprequest') {
        const previous = resourceInfo.get(name);
        resourceInfo.set(name, {
          bytes: decodedBodySize || previous?.bytes,
          contentType: formatFromContentType(contentType) ? contentType : previous?.contentType,
        });
      }
    }
  }

  function read(image: HTMLImageElement): FileMeasurement {
    const url = image.currentSrc;
    const timing = resourceInfo.get(url) ?? resourceInfo.get(url.split('#', 1)[0]);
    const size = timing?.bytes;
    const source = url ? new URL(url) : undefined;
    let fallback: (FileInfo & { method: FallbackMethod }) | null | undefined;
    let bytes: number | undefined;
    let text = 'Unavailable';
    if (size && size > 0) {
      bytes = size;
      text = formatFilesize(size);
    } else if (image.complete && image.naturalWidth > 0 && source) {
      if (['http:', 'https:'].includes(source.protocol) && !source.username && !source.password) {
        if (!fallbackInfo.has(source.href)) {
          fallbackInfo.set(source.href, null);
          void requestFallbackSize(source);
        }
        fallback = fallbackInfo.get(source.href);
        if (fallback) {
          bytes = fallback.bytes;
          text = formatFilesize(fallback.bytes);
        }
      }
    }
    const responseFormat = formatFromContentType(timing?.contentType);
    const fallbackFormat = formatFromContentType(fallback?.contentType);
    const urlFormat = source && formatFromUrl(source);
    return {
      bytes,
      format: responseFormat ?? fallbackFormat ?? urlFormat ?? 'Unknown',
      formatQualifier: responseFormat ? undefined : fallbackFormat ? fallback?.method : urlFormat ? 'URL hint' : undefined,
      filesize: text,
      filesizeQualifier: fallback?.method,
    };
  }

  recordResourceInfo(performance.getEntriesByType('resource'));
  let timingObserver: PerformanceObserver | undefined;
  if (globalThis.PerformanceObserver?.supportedEntryTypes?.includes('resource')) {
    timingObserver = new PerformanceObserver((list) => {
      recordResourceInfo(list.getEntries());
      onChange();
    });
    timingObserver.observe({ type: 'resource', buffered: true });
  }

  return {
    read,
    record(image: HTMLImageElement) {
      recordResourceInfo(performance.getEntriesByName(image.currentSrc.split('#', 1)[0], 'resource'));
    },
    disconnect() {
      timingObserver?.disconnect();
      fallbackRequests.abort();
    },
  };
}
