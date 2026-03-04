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
};

type Episode = {
  id: number;
  episode_number: number;
  air_date: string | null;
  questions: Question[];
};

const MOCK_QUESTIONS: Question[] = [
  {
    id: -1,
    question_text: "Who is getting eliminated tonight?",
    point_value: 1,
    lock_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    answer_type: "player" as const,
    num_players: 1,
  },
];

export default async function PredictionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: episodes }, { data: tribeStateRows }, { data: eliminatedRows }, { data: seasonPredRows }] =
    await Promise.all([
      // Fetch recent episodes; we'll pick the earliest one with open questions below
      supabase
        .from("episodes")
        .select("id, episode_number, air_date, questions(id, question_text, point_value, lock_time, answer_type, num_players)")
        .order("episode_number", { ascending: false })
        .limit(3),
      supabase
        .from("tribe_states")
        .select("tribe_name, player_name")
        .eq("season", 50)
        .eq("is_eliminated", false),
      supabase
        .from("tribe_states")
        .select("player_name")
        .eq("season", 50)
        .eq("is_eliminated", true),
      supabase
        .from("season_predictions")
        .select("milestone, player_names")
        .eq("user_id", user.id),
    ]);

  // Show the earliest episode with at least one open question; fall back to latest
  const nowIso = new Date().toISOString();
  const episode: Episode | null =
    [...(episodes ?? [])]
      .reverse()
      .find((ep) => ep.questions.some((q) => q.lock_time > nowIso)) ??
    episodes?.[0] ??
    null;
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

  let existingPredictions: Record<number, string> = {};
  if (episode && episode.questions.length > 0) {
    const questionIds = episode.questions.map((q) => q.id);
    const { data: preds } = await supabase
      .from("predictions")
      .select("question_id, predicted_answer")
      .eq("user_id", user.id)
      .in("question_id", questionIds);

    if (preds) {
      existingPredictions = Object.fromEntries(
        preds.map((p) => [p.question_id, p.predicted_answer])
      );
    }
  }

  const episodeForForm = episode
    ? {
        ...episode,
        questions: episode.questions.length > 0 ? episode.questions : MOCK_QUESTIONS,
      }
    : null;

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl uppercase tracking-wide text-parchment">
          Predictions
        </h1>
        {episode && (
          <p className="text-parchment/50 mt-1">
            Episode {episode.episode_number}
            {episode.air_date &&
              (() => {
                const [y, mo, d] = episode.air_date.split("-").map(Number);
                return ` — ${new Date(y, mo - 1, d).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}`;
              })()}
          </p>
        )}
      </div>

      <PredictionsPageWrapper
        episode={episodeForForm}
        userId={user.id}
        existingPredictions={existingPredictions}
        existingSeasonPredictions={existingSeasonPredictions}
        tribeOptions={tribeOptions}
        eliminatedNames={eliminatedNames}
        isMock={episode !== null && episode.questions.length === 0}
      />
    </div>
  );
}
