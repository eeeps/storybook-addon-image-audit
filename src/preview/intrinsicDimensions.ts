import type { Dimensions } from './metrics';

export function watchIntrinsicDimensions(onLoad: (url: string) => void) {
  const intrinsicSizes = new Map<string, Dimensions | null>();
  const probes = new Map<string, HTMLImageElement>();

  function read(image: HTMLImageElement): Dimensions | null | undefined {
    const url = image.currentSrc;
    if (image.complete && url && !intrinsicSizes.has(url) && !probes.has(url)) {
      const probe = new Image();
      if (image.crossOrigin !== null) probe.crossOrigin = image.crossOrigin;
      probe.referrerPolicy = image.referrerPolicy;

      function finish() {
        probe.onload = probe.onerror = null;
        probes.delete(url);
        const { naturalWidth: width, naturalHeight: height } = probe;
        intrinsicSizes.set(url, width && height ? { width, height } : null);
        onLoad(url);
      }

      probes.set(url, probe);
      probe.onload = probe.onerror = finish;
      probe.src = url;
    }
    return intrinsicSizes.get(url);
  }

  function disconnect() {
    for (const probe of probes.values()) {
      probe.onload = probe.onerror = null;
      probe.removeAttribute('src');
    }
    probes.clear();
  }

  return { read, isPending: (url: string) => probes.has(url), disconnect };
}
