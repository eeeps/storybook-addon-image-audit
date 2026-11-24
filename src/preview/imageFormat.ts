const formatByExtension = new Map([
  ['jpg', 'JPEG'], ['jpeg', 'JPEG'], ['jfif', 'JPEG'], ['png', 'PNG'],
  ['apng', 'APNG'], ['gif', 'GIF'], ['svg', 'SVG'], ['svgz', 'SVG'],
  ['webp', 'WebP'], ['avif', 'AVIF'], ['jxl', 'JPEG XL'], ['bmp', 'BMP'],
  ['ico', 'ICO'], ['tiff', 'TIFF'], ['tif', 'TIFF'], ['heic', 'HEIC'], ['heif', 'HEIF'],
]);

export function formatFromContentType(value: unknown) {
  if (typeof value !== 'string') return;
  const type = value.split(';', 1)[0].trim().toLowerCase();
  if (!/^image\/[a-z0-9][a-z0-9.+-]*$/.test(type)) return;
  const subtype = type.slice('image/'.length);
  if (subtype === 'svg+xml') return 'SVG';
  if (subtype === 'pjpeg') return 'JPEG';
  if (subtype === 'vnd.microsoft.icon') return 'ICO';
  return formatByExtension.get(subtype.replace(/^x-/, '')) ?? type;
}

export function formatFromUrl(url: URL) {
  if (url.protocol === 'data:') {
    return formatFromContentType(/^data:([^;,]*)/i.exec(url.href)?.[1]);
  }
  if (url.protocol === 'blob:') return;
  const extension = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1];
  return extension ? formatByExtension.get(extension.toLowerCase()) : undefined;
}
