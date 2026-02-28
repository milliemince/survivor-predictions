import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";

type LeaderboardRow = {
  user_id: string;
  username: string;
  total_points: number;
  rank: number;
};

const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

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
      <h1 className="text-2xl font-bold mb-6">Leaderboard 🏆</h1>

      {error && (
        <p className="text-sm text-red-500 mb-4">Failed to load leaderboard.</p>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-black/10 bg-white p-8 text-center">
          <p className="text-zinc-400">No scores yet. Be the first to make predictions!</p>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-zinc-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Rank
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Player
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Points
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: LeaderboardRow) => {
                const isCurrentUser = row.user_id === user.id;
                const medal = medals[row.rank];
                return (
                  <tr
                    key={row.user_id}
                    className={`border-b border-black/5 last:border-0 transition-colors ${
                      isCurrentUser ? "bg-orange-50" : "hover:bg-zinc-50"
                    }`}
                  >
                    <td className="px-4 py-3 w-16">
                      {medal ? (
                        <span className="text-lg">{medal}</span>
                      ) : (
                        <span className="font-mono text-zinc-400">#{row.rank}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {row.username}
                      {isCurrentUser && (
                        <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600">
                          you
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                      {row.total_points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
