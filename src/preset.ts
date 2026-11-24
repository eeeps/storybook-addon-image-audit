import type { InlineConfig } from 'vite';
import { imageSizeMiddleware } from './server/imageSizeMiddleware';

interface ImageSizeProxyOptions {
  imageSizeProxyHosts?: string[];
}

export function viteFinal(config: InlineConfig, { imageSizeProxyHosts = [] }: ImageSizeProxyOptions = {}): InlineConfig {
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
