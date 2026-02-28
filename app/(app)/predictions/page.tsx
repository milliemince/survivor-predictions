import { createClient } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import PredictionsForm from "./PredictionsForm";

type Question = {
  id: number;
  question_text: string;
  point_value: number;
  lock_time: string;
};

type Episode = {
  id: number;
  episode_number: number;
  air_date: string | null;
  questions: Question[];
};

// Shown when the episode exists but has no questions in the DB yet.
// id < 0 flags it as a mock so PredictionsForm skips saving it.
// TODO: Remove once real questions are added via the Admin panel.
const MOCK_QUESTIONS: Question[] = [
  {
    id: -1,
    question_text: "Who is getting eliminated tonight?",
    point_value: 1,
    lock_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default async function PredictionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: episodes } = await supabase
    .from("episodes")
    .select("id, episode_number, air_date, questions(id, question_text, point_value, lock_time)")
    .order("episode_number", { ascending: false })
    .limit(1);

  const episode: Episode | null = episodes?.[0] ?? null;

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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Predictions</h1>
        {episode && (
          <p className="text-zinc-500 mt-1">
            Episode {episode.episode_number}
            {episode.air_date &&
              ` — ${new Date(episode.air_date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}`}
          </p>
        )}
      </div>

      {!episode && (
        <div className="rounded-xl border border-black/10 bg-white p-8 text-center">
          <p className="text-zinc-400 text-sm">No episodes yet — check back soon!</p>
        </div>
      )}

      {episode && (
        <PredictionsForm
          episode={{
            ...episode,
            questions: episode.questions.length > 0 ? episode.questions : MOCK_QUESTIONS,
          }}
          userId={user.id}
          existingPredictions={existingPredictions}
          isMock={episode.questions.length === 0}
        />
      )}
    </div>
  );
}
