import { fileURLToPath } from 'node:url';

export const managerEntries = (entries = []) => [
  ...entries,
  fileURLToPath(new URL('./manager.js', import.meta.url)),
];

export const previewAnnotations = (entries = []) => [
  ...entries,
  fileURLToPath(new URL('./preview.js', import.meta.url)),
];

export function viteFinal(config, { imageSizeProxyHosts = [] } = {}) {
  if (imageSizeProxyHosts.length === 0) return config;
  const hosts = imageSizeProxyHosts.map((host) => host.toLowerCase());

  return {
    ...config,
    plugins: [...(config.plugins ?? []), {
      name: 'storybook-addon-img-info-size-proxy',
      apply: 'serve',
      config: () => ({
        define: { __IMG_INFO_PROXY_HOSTS__: JSON.stringify(hosts) },
      }),
      configureServer(server) {
        server.middlewares.use(
          `${server.config.base}__img_info_size`,
          imageSizeMiddleware(new Set(hosts)),
        );
      },
    }],
  };
}

function imageSizeMiddleware(hosts) {
  const maxBytes = 25 * 1024 * 1024;

  return async (request, response) => {
    const send = (status, data) => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify(data));
    };

    if (request.method !== 'GET') return send(405, {});
    const target = new URL(request.url, 'http://localhost').searchParams.get('url');
    let url;
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
      if (!image.ok || !image.body ||
          !image.headers.get('content-type')?.toLowerCase().startsWith('image/')) {
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
      return send(200, { bytes });
    } catch {
      return send(502, {});
    }
  };
}
