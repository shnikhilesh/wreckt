export function starString(score: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(score)));
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}
