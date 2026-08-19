export const LIST_ORDER = ["Stack", "Reading now", "Finished", "Dropped"] as const;

export type ListName = (typeof LIST_ORDER)[number];

export const LIST_ICONS: Record<ListName, string> = {
  Stack: "📚",
  "Reading now": "📖",
  Finished: "✓",
  Dropped: "✕",
};

export const LIST_EMPTY_MESSAGES: Record<ListName, string> = {
  Stack: "Books you want to read — add some from Browse",
  "Reading now": "Nothing in progress — start something",
  Finished: "Books you've completed will appear here",
  Dropped: "It's okay to put a book down",
};

export function slugifyListName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function listNameFromSlug(slug: string): ListName | undefined {
  return LIST_ORDER.find((name) => slugifyListName(name) === slug);
}
