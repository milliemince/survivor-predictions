import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import LogoutButton from "./LogoutButton";

type LeaderboardRow = {
  user_id: string;
  username: string;
  total_points: number;
  rank: number;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: rows, error } = await supabase.from("leaderboard").select("*");

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <LogoutButton />
      </div>

      {error && (
        <p className="text-sm text-red-500">Failed to load leaderboard.</p>
      )}

      {rows && rows.length === 0 && (
        <p className="text-zinc-500">No scores yet. Make some predictions!</p>
      )}

      {rows && rows.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-zinc-500">
              <th className="pb-3 font-medium">Rank</th>
              <th className="pb-3 font-medium">Player</th>
              <th className="pb-3 text-right font-medium">Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row: LeaderboardRow) => (
              <tr
                key={row.user_id}
                className={`border-b border-black/5 ${row.user_id === user.id ? "bg-zinc-100" : ""}`}
              >
                <td className="py-3 font-mono text-zinc-400">#{row.rank}</td>
                <td className="py-3 font-medium">
                  {row.username}
                  {row.user_id === user.id && (
                    <span className="ml-2 text-xs text-zinc-400">(you)</span>
                  )}
                </td>
                <td className="py-3 text-right font-semibold">{row.total_points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
