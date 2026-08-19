const UNITS = [
  { limit: 60, divisor: 1, label: "second" },
  { limit: 3600, divisor: 60, label: "minute" },
  { limit: 86400, divisor: 3600, label: "hour" },
  { limit: 604800, divisor: 86400, label: "day" },
  { limit: 2629800, divisor: 604800, label: "week" },
  { limit: 31557600, divisor: 2629800, label: "month" },
] as const;

export function relativeTime(dateString: string): string {
  const seconds = Math.max(
    0,
    (Date.now() - new Date(dateString).getTime()) / 1000,
  );

  if (seconds < 30) return "just now";

  for (const unit of UNITS) {
    if (seconds < unit.limit) {
      const value = Math.floor(seconds / unit.divisor);
      return `${value} ${unit.label}${value === 1 ? "" : "s"} ago`;
    }
  }

  const years = Math.floor(seconds / 31557600);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
