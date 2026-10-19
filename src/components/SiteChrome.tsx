import Link from "next/link";

export function SiteHeader({ isSignedIn = false }: { isSignedIn?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm text-white shadow-sm">
            ✳
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">
            AEO Engine
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
          <Link href="/#features" className="transition hover:text-slate-900">
            Features
          </Link>
          <Link href="/#how" className="transition hover:text-slate-900">
            How it works
          </Link>
          <Link href="/pricing" className="transition hover:text-slate-900">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            >
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs text-white">
            ✳
          </span>
          <span className="text-sm font-medium text-slate-700">AEO Engine</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500">
          <Link href="/pricing" className="transition hover:text-slate-900">
            Pricing
          </Link>
          <Link href="/login" className="transition hover:text-slate-900">
            Sign in
          </Link>
          <a href="/api/chat" className="transition hover:text-slate-900">
            API status
          </a>
        </div>

        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} AEO Engine. Self-hosted MVP.
        </p>
      </div>
    </footer>
  );
}
