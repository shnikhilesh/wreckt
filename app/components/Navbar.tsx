import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-white transition-opacity hover:opacity-80"
        >
          Wreckt
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href="/books"
            className="text-sm text-zinc-400 transition-colors hover:text-white"
          >
            Browse
          </Link>
          <Link
            href="/login"
            className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-zinc-950 transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </nav>
    </header>
  );
}
