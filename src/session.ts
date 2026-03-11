export function formatSessionDuration(startTime?: string): string {
  if (!startTime) return "";

  const startEpoch = new Date(startTime).getTime();
  if (isNaN(startEpoch)) return "";

  const elapsed = Math.floor((Date.now() - startEpoch) / 1000);
  if (elapsed < 0) return "";

  if (elapsed >= 3600) {
    return `${Math.floor(elapsed / 3600)}h${Math.floor((elapsed % 3600) / 60)}m`;
  }
  if (elapsed >= 60) {
    return `${Math.floor(elapsed / 60)}m`;
  }
  return `${elapsed}s`;
}
