import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import Link from "next/link";

type Question = {
  id: number;
  lock_time: string;
};

type Episode = {
  id: number;
  episode_number: number;
  air_date: string | null;
  questions: Question[];
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileResult, leaderboardResult, episodesResult] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase.from("leaderboard").select("total_points, rank").eq("user_id", user.id).single(),
    supabase
      .from("episodes")
      .select("id, episode_number, air_date, questions(id, lock_time)")
      .order("episode_number", { ascending: false })
      .limit(1),
  ]);

  const username = profileResult.data?.username ?? user.email ?? "Player";
  const totalPoints = leaderboardResult.data?.total_points ?? 0;
  const rank = leaderboardResult.data?.rank ?? null;

  const latestEpisode: Episode | null = episodesResult.data?.[0] ?? null;

  const now = new Date();
  const upcomingLocks = (latestEpisode?.questions ?? [])
    .map((q) => new Date(q.lock_time))
    .filter((t) => t > now)
    .sort((a, b) => a.getTime() - b.getTime());

  const nextLockDate = upcomingLocks[0] ?? null;

  const openQuestions = (latestEpisode?.questions ?? []).filter(
    (q) => new Date(q.lock_time) > now
  ).length;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back, {username} 👋</h1>
        <p className="text-zinc-500 mt-1">Ready to outwit, outplay, and outlast?</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Total Points
          </p>
          <p className="text-3xl font-bold text-zinc-900">{totalPoints}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Your Rank
          </p>
          <p className="text-3xl font-bold text-zinc-900">
            {rank !== null ? `#${rank}` : "—"}
          </p>
        </div>
      </div>

      {/* Current Episode */}
      {latestEpisode ? (
        <div className="rounded-xl border border-black/10 bg-white p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                Current Episode
              </p>
              <h2 className="text-lg font-bold text-zinc-900">
                Episode {latestEpisode.episode_number}
              </h2>
              {latestEpisode.air_date && (
                <p className="text-sm text-zinc-500 mt-0.5">
                  {new Date(latestEpisode.air_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
            </div>
            <span className="text-3xl">📺</span>
          </div>

          {nextLockDate && (
            <div className="mt-4 rounded-lg bg-orange-50 border border-orange-100 px-4 py-3">
              <p className="text-sm font-semibold text-orange-700">
                ⏰ Predictions lock{" "}
                {nextLockDate.toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              {openQuestions > 0 && (
                <p className="text-xs text-orange-500 mt-1">
                  {openQuestions} question{openQuestions !== 1 ? "s" : ""} still open
                </p>
              )}
            </div>
          )}

          {openQuestions === 0 && latestEpisode.questions.length > 0 && (
            <div className="mt-4 rounded-lg bg-zinc-100 px-4 py-3">
              <p className="text-sm text-zinc-500">🔒 All predictions are locked for this episode.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-black/10 bg-white p-5 mb-4 text-center">
          <p className="text-zinc-400 text-sm">No episodes yet — check back soon!</p>
        </div>
      )}

      {/* CTA */}
      <Link
        href="/predictions"
        className="block w-full rounded-full bg-orange-600 py-3 text-center text-sm font-semibold text-white hover:bg-orange-700 transition-colors"
      >
        Make Predictions →
      </Link>
    </div>
  );
}
