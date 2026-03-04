import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

type LeaderboardRow = {
  user_id: string;
  name: string;
  total_points: number;
  rank: number;
};

const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const topRowBg: Record<number, string> = {
  1: "bg-survivor-green/10",
  2: "bg-ocean-blue/10",
  3: "bg-parchment/5",
};

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

  return (
    <div>
      <h1 className="font-display text-3xl uppercase tracking-wide text-parchment mb-6">Leaderboard 🏆</h1>

      {error && (
        <p className="text-sm text-tribal-red mb-4">Failed to load leaderboard.</p>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-white/10 bg-earth-surface p-8 text-center">
          <p className="text-parchment/40">No scores yet. Be the first to make predictions!</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-earth-surface overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-earth text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-parchment/40">
                  Rank
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-parchment/40">
                  Player
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-parchment/40">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: LeaderboardRow) => {
                const isCurrentUser = row.user_id === user.id;
                const medal = medals[row.rank];
                const topBg = topRowBg[row.rank] ?? "";
                return (
                  <tr
                    key={row.user_id}
                    className={`border-b border-white/5 last:border-0 transition-colors ${
                      isCurrentUser ? "bg-survivor-green/15" : topBg || "hover:bg-white/5"
                    }`}
                  >
                    <td className="px-4 py-3 w-16">
                      {medal ? (
                        <span className="text-lg">{medal}</span>
                      ) : (
                        <span className="font-mono text-parchment/40">#{row.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-parchment">
                      {row.name}
                      {isCurrentUser && (
                        <span className="ml-2 rounded-full bg-survivor-green/20 px-2 py-0.5 text-xs font-semibold text-survivor-green">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-survivor-green">
                      {row.total_points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
