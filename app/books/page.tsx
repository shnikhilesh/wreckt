"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const PAGE_SIZE = 24;

const GENRES = [
  { label: "All", value: null },
  { label: "Fiction", value: "fiction" },
  { label: "Fantasy", value: "fantasy" },
  { label: "Science Fiction", value: "science fiction" },
  { label: "Mystery", value: "mystery" },
  { label: "Romance", value: "romance" },
  { label: "Thriller", value: "thriller" },
  { label: "Biography", value: "biography" },
  { label: "History", value: "history" },
  { label: "Self-Help", value: "self-help" },
] as const;

type Work = {
  id: string;
  title: string;
  author_name: string;
  pub_year: number | null;
  ol_work_key: string | null;
  description: string | null;
  genres: string[] | null;
  cover_url: string | null;
  cached_rating: number | null;
  rating_count: number;
  created_at: string;
};

function bookInitials(title: string, author: string) {
  const t = title.trim()[0] ?? "";
  const a = author.trim()[0] ?? "";
  return (t + a).toUpperCase();
}

function formatRating(rating: number | null) {
  if (rating == null) return null;
  return Number(rating).toFixed(1);
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] rounded-lg bg-zinc-800" />
          <div className="mt-3 h-4 rounded bg-zinc-800" />
          <div className="mt-2 h-3 w-2/3 rounded bg-zinc-800" />
          <div className="mt-2 h-3 w-1/3 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

function BookCard({ book }: { book: Work }) {
  const rating = formatRating(book.cached_rating);
  const initials = bookInitials(book.title, book.author_name);

  return (
    <Link
      href={`/books/${book.id}`}
      className="group block transition-transform duration-200 hover:scale-[1.02]"
    >
      <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 shadow-md transition-shadow duration-200 group-hover:shadow-lg group-hover:shadow-black/40">
        {book.cover_url ? (
          <img
            src={`/api/cover?url=${encodeURIComponent(book.cover_url)}`}
            alt={book.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-2xl font-semibold text-zinc-500">
            {initials}
          </div>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-medium leading-snug text-white">
        {book.title}
      </h3>
      <p className="mt-1 text-sm text-zinc-400">{book.author_name}</p>
      <div className="mt-1 flex items-center gap-1 text-sm text-zinc-400">
        {rating ? (
          <>
            <span className="text-amber-400">★</span>
            <span className="text-zinc-300">{rating}</span>
            <span>({book.rating_count})</span>
          </>
        ) : (
          <span>No ratings yet</span>
        )}
      </div>
    </Link>
  );
}

export default function BooksPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [books, setBooks] = useState<Work[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBooks = useCallback(
    async (offset: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const supabase = createClient();
      let query = supabase
        .from("works")
        .select("*", { count: "exact" })
        .order("rating_count", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      const term = debouncedSearch.trim();
      if (term) {
        query = query.or(
          `title.ilike.%${term}%,author_name.ilike.%${term}%`,
        );
      }

      if (selectedGenre) {
        query = query.contains("genres", [selectedGenre]);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Failed to fetch books:", error.message);
        if (!append) {
          setBooks([]);
          setTotalCount(0);
          setHasMore(false);
        }
      } else {
        const results = (data as Work[]) ?? [];
        const total = count ?? 0;

        setBooks((prev) => (append ? [...prev, ...results] : results));
        setTotalCount(total);
        setHasMore(offset + PAGE_SIZE < total);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [debouncedSearch, selectedGenre],
  );

  useEffect(() => {
    fetchBooks(0, false);
  }, [fetchBooks]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchBooks(books.length, true);
    }
  };

  const showEmpty = !loading && books.length === 0;
  const activeQuery = debouncedSearch.trim();

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Browse books
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Discover what everyone&apos;s reading
        </p>

        {/* Search */}
        <div className="relative mt-6">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or author…"
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 pl-4 pr-10 text-white placeholder:text-zinc-500 outline-none transition-colors focus:border-zinc-600"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-white"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* Genre chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {GENRES.map((genre) => {
            const isActive = selectedGenre === genre.value;
            return (
              <button
                key={genre.label}
                type="button"
                onClick={() => setSelectedGenre(genre.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-zinc-950"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                }`}
              >
                {genre.label}
              </button>
            );
          })}
        </div>

        {/* Count */}
        {!loading && books.length > 0 && (
          <p className="mt-6 text-sm text-zinc-400">
            Showing {books.length} of {totalCount} books
          </p>
        )}

        {/* Grid */}
        <div className="mt-6">
          {loading ? (
            <SkeletonGrid />
          ) : showEmpty ? (
            <div className="py-16 text-center">
              <p className="text-lg text-zinc-300">
                {activeQuery
                  ? `No books found for '${activeQuery}'`
                  : "No books found"}
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Try a different search or clear your filters
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>

              {loadingMore && (
                <div className="mt-6">
                  <SkeletonGrid />
                </div>
              )}

              {hasMore && !loadingMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    className="rounded-full border border-zinc-700 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:border-zinc-500 hover:bg-zinc-900"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
