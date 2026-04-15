import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

type LeaderboardRow = {
  user_id: string;
  name: string;
  episode_points: number;
  season_points: number;
  total_points: number;
  rank: number;
};

type RankedRow = LeaderboardRow & { category_rank: number };

const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function rankBy(rows: LeaderboardRow[], key: keyof LeaderboardRow): RankedRow[] {
  const sorted = [...rows].sort((a, b) => (b[key] as number) - (a[key] as number));
  let rank = 1;
  return sorted.map((row, i) => {
    if (i > 0 && (sorted[i - 1][key] as number) > (row[key] as number)) rank = i + 1;
    return { ...row, category_rank: rank };
  });
}

function LeaderboardCard({
  title,
  ranked,
  pointsKey,
  currentUserId,
}: {
  title: string;
  ranked: RankedRow[];
  pointsKey: keyof LeaderboardRow;
  currentUserId: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-earth-surface overflow-hidden">
      <div className="border-b border-white/10 bg-earth px-4 py-3">
        <h2 className="font-display text-sm uppercase tracking-wider text-parchment/60">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-earth/50 text-left">
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-parchment/40 w-12" />
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-parchment/40">Player</th>
            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-parchment/40">Pts</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row) => {
            const isCurrentUser = row.user_id === currentUserId;
            const medal = medals[row.category_rank];
            return (
              <tr
                key={row.user_id}
                className={`border-b border-white/5 last:border-0 transition-colors ${
                  isCurrentUser ? "bg-survivor-green/15" : row.category_rank <= 3 ? "bg-survivor-green/5" : "hover:bg-white/5"
                }`}
              >
                <td className="px-3 py-2">
                  {medal ? (
                    <span className="text-base">{medal}</span>
                  ) : (
                    <span className="font-mono text-xs text-parchment/40">#{row.category_rank}</span>
                  )}
                </td>
                <td className="px-3 py-2 font-medium text-parchment truncate max-w-[120px]">
                  {row.name}
                  {isCurrentUser && (
                    <span className="ml-1.5 rounded-full bg-survivor-green/20 px-1.5 py-0.5 text-[10px] font-semibold text-survivor-green">
                      you
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-bold text-survivor-green">
                  {row[pointsKey] as number}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("rank", { ascending: true });

  const episodeRanked = rows ? rankBy(rows, "episode_points") : [];
  const seasonRanked = rows ? rankBy(rows, "season_points") : [];
  const totalRanked = rows ? rankBy(rows, "total_points") : [];

  return (
    <div>
      <h1 className="font-display text-3xl uppercase tracking-wide text-parchment mb-6">Leaderboard</h1>

      {error && (
        <p className="text-sm text-tribal-red mb-4">Failed to load leaderboard.</p>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-earth-surface p-8 text-center">
          <p className="text-parchment/40">No scores yet. Be the first to make predictions!</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LeaderboardCard title="Episode Points" ranked={episodeRanked} pointsKey="episode_points" currentUserId={user.id} />
          <LeaderboardCard title="Season Points" ranked={seasonRanked} pointsKey="season_points" currentUserId={user.id} />
          <LeaderboardCard title="Total Points" ranked={totalRanked} pointsKey="total_points" currentUserId={user.id} />
        </div>
      )}
    </div>
  );
}
