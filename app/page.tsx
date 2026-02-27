import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold tracking-tight">Survivor Predictions</h1>
      <p className="text-zinc-500">Predict who gets voted out. Compete with friends.</p>
      <div className="flex gap-4">
        <Link
          href="/signup"
          className="rounded-full bg-black px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Sign Up
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-black/10 px-6 py-2 text-sm font-medium hover:bg-black/5"
        >
          Log In
        </Link>
        <Link
          href="/leaderboard"
          className="rounded-full border border-black/10 px-6 py-2 text-sm font-medium hover:bg-black/5"
        >
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
