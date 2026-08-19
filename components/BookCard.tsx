import Link from "next/link";

export type BookCardWork = {
  id: string;
  title: string;
  author_name: string;
  cover_url: string | null;
  cached_rating?: number | null;
  rating_count?: number | null;
};

function bookInitials(title: string, author: string) {
  const t = title.trim()[0] ?? "";
  const a = author.trim()[0] ?? "";
  return (t + a).toUpperCase();
}

function formatRating(rating: number | null | undefined) {
  if (rating == null) return null;
  return Number(rating).toFixed(1);
}

export function BookCard({
  work,
  compact = false,
}: {
  work: BookCardWork;
  compact?: boolean;
}) {
  const rating = formatRating(work.cached_rating);
  const initials = bookInitials(work.title, work.author_name);

  return (
    <Link
      href={`/books/${work.id}`}
      className={`group block transition-transform duration-200 hover:scale-[1.02] ${
        compact ? "w-32 shrink-0" : ""
      }`}
    >
      <div className="aspect-[2/3] overflow-hidden rounded-lg bg-zinc-800 shadow-md transition-shadow duration-200 group-hover:shadow-lg group-hover:shadow-black/40">
        {work.cover_url ? (
          <img
            src={`/api/cover?url=${encodeURIComponent(work.cover_url)}`}
            alt={work.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-2xl font-semibold text-zinc-500">
            {initials}
          </div>
        )}
      </div>
      <h3
        className={
          compact
            ? "mt-2 line-clamp-1 text-sm font-medium leading-snug text-white"
            : "mt-3 line-clamp-2 text-sm font-medium leading-snug text-white"
        }
      >
        {work.title}
      </h3>
      <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
        {work.author_name}
      </p>
      {!compact && (
        <div className="mt-1 flex items-center gap-1 text-sm text-zinc-400">
          {rating ? (
            <>
              <span className="text-amber-400">★</span>
              <span className="text-zinc-300">{rating}</span>
              {work.rating_count != null && <span>({work.rating_count})</span>}
            </>
          ) : (
            <span>No ratings yet</span>
          )}
        </div>
      )}
    </Link>
  );
}
