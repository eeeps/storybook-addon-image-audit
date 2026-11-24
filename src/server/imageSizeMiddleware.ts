import type { IncomingMessage, ServerResponse } from 'node:http';

export function imageSizeMiddleware(hosts: ReadonlySet<string>) {
  const maxBytes = 25 * 1024 * 1024;

  return async (request: IncomingMessage, response: ServerResponse) => {
    const send = (status: number, data: { bytes?: number; contentType?: string }) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify(data));
    };

    if (request.method !== 'GET') return send(405, {});
    const target = new URL(request.url ?? '/', 'http://localhost').searchParams.get('url');
    if (!target) return send(400, {});
    let url: URL;
    try {
      url = new URL(target);
    } catch {
      return send(400, {});
    }
    if (url.protocol !== 'https:' || url.port || url.username || url.password ||
        !hosts.has(url.hostname)) return send(403, {});

    try {
      const image = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      const contentType = image.headers.get('content-type');
      if (!image.ok || !image.body || !contentType?.toLowerCase().startsWith('image/')) {
        await image.body?.cancel();
        return send(502, {});
      }

      const reader = image.body.getReader();
      let bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          await reader.cancel();
          return send(413, {});
        }
      }
      return send(200, { bytes, contentType });
    } catch {
      return send(502, {});
    }
  };
}
