import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import PredictionsPageWrapper from "./PredictionsPageWrapper";

type Question = {
  id: number;
  question_text: string;
  point_value: number;
  lock_time: string;
  answer_type: "player" | "tribe" | "free";
  num_players: number;
  correct_answer: string | null;
};

type Episode = {
  id: number;
  episode_number: number;
  air_date: string | null;
  questions: Question[];
};

export default async function PredictionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: episodes }, { data: allTribeRows }, { data: seasonPredRows }] =
    await Promise.all([
      supabase
        .from("episodes")
        .select("id, episode_number, air_date, questions(id, question_text, point_value, lock_time, answer_type, num_players, correct_answer)")
        .order("episode_number", { ascending: true }),
      supabase
        .from("tribe_states")
        .select("tribe_name, player_name, is_eliminated, episode_number")
        .eq("season", 50)
        .order("episode_number", { ascending: false })
        .order("id", { ascending: true })
        .limit(200),
      supabase
        .from("season_predictions")
        .select("milestone, player_names")
        .eq("user_id", user.id),
    ]);

  // Filter to latest episode snapshot only (same logic as dashboard)
  const tribeRowsAll = allTribeRows ?? [];
  const maxEp = tribeRowsAll.reduce((max, r) => Math.max(max, r.episode_number), 0);
  const latestTribeRows = tribeRowsAll.filter((r) => r.episode_number === maxEp);
  const tribeStateRows = latestTribeRows.filter((r) => !r.is_eliminated);
  const eliminatedRows = latestTribeRows.filter((r) => r.is_eliminated);

  const allEpisodes: Episode[] = (episodes ?? []).map((ep) => ({
    ...ep,
    questions: (ep.questions as Question[]) ?? [],
  }));

  // Current episode = earliest episode with unlocked questions, else latest
  const nowMs = Date.now();
  const initialEpisode =
    allEpisodes.find((ep) =>
      ep.questions.some((q) => new Date(q.lock_time).getTime() > nowMs)
    ) ?? allEpisodes[allEpisodes.length - 1] ?? null;

  const tribeMap = new Map<string, string[]>();
  for (const row of tribeStateRows ?? []) {
    const players = tribeMap.get(row.tribe_name) ?? [];
    players.push(row.player_name);
    tribeMap.set(row.tribe_name, players);
  }
  const tribeOptions = Array.from(tribeMap.entries()).map(([name, players]) => ({ name, players }));
  const eliminatedNames: string[] = [...new Set((eliminatedRows ?? []).map((r) => r.player_name))];
  const existingSeasonPredictions: Record<string, string> = Object.fromEntries(
    (seasonPredRows ?? []).map((r) => [r.milestone, r.player_names])
  );

  // Fetch ALL predictions for this user across all episodes at once
  const allQuestionIds = allEpisodes.flatMap((ep) => ep.questions.map((q) => q.id));
  let allPredictions: Record<number, string> = {};
  if (allQuestionIds.length > 0) {
    const { data: preds } = await supabase
      .from("predictions")
      .select("question_id, predicted_answer")
      .eq("user_id", user.id)
      .in("question_id", allQuestionIds);

    if (preds) {
      allPredictions = Object.fromEntries(
        preds.map((p) => [p.question_id, p.predicted_answer])
      );
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl uppercase tracking-wide text-parchment">
          Predictions
        </h1>
      </div>

      <PredictionsPageWrapper
        episodes={allEpisodes}
        initialEpisodeId={initialEpisode?.id ?? null}
        userId={user.id}
        allPredictions={allPredictions}
        existingSeasonPredictions={existingSeasonPredictions}
        tribeOptions={tribeOptions}
        eliminatedNames={eliminatedNames}
      />
    </div>
  );
}
