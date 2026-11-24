const dimensionsFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const oneDecimal = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export const formatRatio = (value: number) => dimensionsFormat.format(value);
export const formatLayout = (width: number, height: number) =>
  `${oneDecimal.format(width)} × ${oneDecimal.format(height)} CSS px`;

export function formatFilesize(bytes: number): string {
  if (bytes >= 999_950_000) return `${oneDecimal.format(bytes / 1e9)} GB`;
  if (bytes >= 999_950) return `${oneDecimal.format(bytes / 1e6)} MB`;
  if (bytes >= 1_000) return `${oneDecimal.format(bytes / 1e3)} kB`;
  return `${oneDecimal.format(bytes)} B`;
}
