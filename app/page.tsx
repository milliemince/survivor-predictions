import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div>
        <p className="font-display text-survivor-green text-sm uppercase tracking-[0.3em] mb-3">Season 50</p>
        <h1 className="font-display text-5xl md:text-7xl font-bold uppercase tracking-wide text-parchment leading-none">
          Survivor Predictions
        </h1>
        <p className="mt-4 text-parchment/60 max-w-sm mx-auto">
          Outwit. Outplay. Outpredict.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
        <Link
          href="/signup"
          className="rounded-full bg-survivor-green px-8 py-3 text-sm font-semibold text-white hover:bg-survivor-green-dark transition-colors w-full sm:w-auto text-center"
        >
          Play Now
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-parchment/20 px-8 py-3 text-sm font-medium text-parchment hover:bg-white/5 transition-colors w-full sm:w-auto text-center"
        >
          Log In
        </Link>
      </div>
    </div>
  );
}
