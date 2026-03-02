import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import Link from "next/link";
import TribeGrid, { type TribeData } from "./TribeGrid";

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

/** Returns today's date as "YYYY-MM-DD" in US Eastern time. */
function todayEastern(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

/**
 * Format a "YYYY-MM-DD" air date string for display.
 * Constructs a local Date to avoid UTC-midnight timezone shift.
 */
function formatAirDate(airDate: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, mo, d] = airDate.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", opts);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [profileResult, leaderboardResult, episodesResult, tribeResult] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase.from("leaderboard").select("total_points, rank").eq("user_id", user.id).single(),
    // Next upcoming episode: earliest air_date that is today or in the future (Eastern time)
    supabase
      .from("episodes")
      .select("id, episode_number, air_date, questions(id, lock_time)")
      .gte("air_date", todayEastern())
      .order("air_date", { ascending: true })
      .limit(1),
    supabase
      .from("tribe_states")
      .select("id, tribe_name, tribe_color, player_name, is_eliminated, episode_number")
      .eq("season", 50)
      .order("episode_number", { ascending: false })
      .order("id", { ascending: true })
      .limit(200),
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

  // Build tribes + eliminated from the latest episode snapshot
  const tribeRows = tribeResult.data ?? [];
  const maxEp = tribeRows.reduce((max, r) => Math.max(max, r.episode_number), 0);
  const latestTribeRows = tribeRows
    .filter((r) => r.episode_number === maxEp)
    .filter((r) => {
      const n = r.player_name?.toLowerCase();
      return n && n.length >= 2 && !["none"].includes(n);
    });

  const tribeMap: Record<string, { color: string; players: string[]; eliminatedPlayers: string[] }> = {};
  // eliminated is sorted id ASC (first-eliminated first) from the query
  const eliminated: string[] = [];

  for (const row of latestTribeRows) {
    if (!tribeMap[row.tribe_name]) {
      tribeMap[row.tribe_name] = { color: row.tribe_color, players: [], eliminatedPlayers: [] };
    }
    if (row.is_eliminated) {
      tribeMap[row.tribe_name].eliminatedPlayers.push(row.player_name);
      eliminated.push(row.player_name);
    } else {
      tribeMap[row.tribe_name].players.push(row.player_name);
    }
  }
  const tribes: TribeData[] = Object.entries(tribeMap).map(([name, { color, players, eliminatedPlayers }]) => ({
    name,
    color,
    players,
    eliminatedPlayers,
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl uppercase tracking-wide text-parchment">
          Welcome back, {username} 👋
        </h1>
        <p className="text-parchment/50 mt-1">Ready to outwit, outplay, and outlast?</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-earth-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-parchment/40 mb-2">
            Total Points
          </p>
          <p className="text-3xl font-bold text-survivor-green">{totalPoints}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-earth-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-parchment/40 mb-2">
            Your Rank
          </p>
          <p className="text-3xl font-bold text-survivor-green">
            {rank !== null ? `#${rank}` : "—"}
          </p>
        </div>
      </div>

      {/* Current Tribes + Eliminated */}
      <TribeGrid tribes={tribes} eliminated={eliminated} />

      {/* Current Episode */}
      {latestEpisode ? (
        <div className="rounded-xl border border-white/10 bg-earth-surface p-5 mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-parchment/40 mb-1">
                Current Episode
              </p>
              <h2 className="text-lg font-bold text-parchment">
                Episode {latestEpisode.episode_number}
              </h2>
              {latestEpisode.air_date && (
                <p className="text-sm text-parchment/50 mt-0.5">
                  {formatAirDate(latestEpisode.air_date, {
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
            <div className="mt-4 rounded-lg bg-survivor-green/10 border border-survivor-green/20 px-4 py-3">
              <p className="text-sm font-semibold text-survivor-green">
                ⏰ Predictions lock{" "}
                {nextLockDate.toLocaleString("en-US", {
                  timeZone: "America/New_York",
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}
              </p>
              {openQuestions > 0 && (
                <p className="text-xs text-survivor-green/70 mt-1">
                  {openQuestions} question{openQuestions !== 1 ? "s" : ""} still open
                </p>
              )}
            </div>
          )}

          {openQuestions === 0 && latestEpisode.questions.length > 0 && (
            <div className="mt-4 rounded-lg bg-earth border border-white/10 px-4 py-3">
              <p className="text-sm text-parchment/50">🔒 All predictions are locked for this episode.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-earth-surface p-5 mb-4 text-center">
          <p className="text-parchment/40 text-sm">No episodes yet — check back soon!</p>
        </div>
      )}

      {/* CTA */}
      <Link
        href="/predictions"
        className="block w-full rounded-full bg-survivor-green py-3 text-center text-sm font-semibold text-white hover:bg-survivor-green-dark transition-colors"
      >
        Make Predictions →
      </Link>
    </div>
  );
}
