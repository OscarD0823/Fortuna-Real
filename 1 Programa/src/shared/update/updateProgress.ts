export function calculateUpdateProgress(downloadedBytes: number, totalBytes: number): number | null {
  if (!Number.isFinite(downloadedBytes) || !Number.isFinite(totalBytes) || totalBytes <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((downloadedBytes / totalBytes) * 100)));
}

export function formatUpdateBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}
