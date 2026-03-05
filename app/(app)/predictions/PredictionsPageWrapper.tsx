"use client";

import { useState } from "react";
import PredictionsForm from "./PredictionsForm";
import SeasonPredictionsForm from "./SeasonPredictionsForm";

type Tab = "episode" | "season";

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

const MOCK_QUESTIONS: Question[] = [
  {
    id: -1,
    question_text: "Who is getting eliminated tonight?",
    point_value: 1,
    lock_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    answer_type: "player" as const,
    num_players: 1,
    correct_answer: null,
  },
];

function formatAirDate(airDate: string | null): string {
  if (!airDate) return "";
  const [y, mo, d] = airDate.split("-").map(Number);
  return ` — ${new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export default function PredictionsPageWrapper({
  episodes,
  initialEpisodeId,
  userId,
  allPredictions,
  existingSeasonPredictions,
  tribeOptions,
  eliminatedNames,
}: {
  episodes: Episode[];
  initialEpisodeId: number | null;
  userId: string;
  allPredictions: Record<number, string>;
  existingSeasonPredictions: Record<string, string>;
  tribeOptions: { name: string; players: string[] }[];
  eliminatedNames: string[];
}) {
  const [tab, setTab] = useState<Tab>("episode");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<number | null>(initialEpisodeId);

  const selectedEpisode = episodes.find((ep) => ep.id === selectedEpisodeId) ?? null;

  const episodeForForm = selectedEpisode
    ? {
        ...selectedEpisode,
        questions: selectedEpisode.questions.length > 0 ? selectedEpisode.questions : MOCK_QUESTIONS,
      }
    : null;

  const isMock = !!selectedEpisode && selectedEpisode.questions.length === 0;

  // Filter allPredictions to only those question IDs belonging to the selected episode
  const existingPredictions: Record<number, string> = selectedEpisode
    ? Object.fromEntries(
        selectedEpisode.questions
          .map((q) => [q.id, allPredictions[q.id]])
          .filter(([, v]) => v !== undefined)
      )
    : {};

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl bg-earth p-1 mb-6 border border-white/10">
        <button
          onClick={() => setTab("episode")}
          className={`flex-1 rounded-lg py-2.5 font-display text-xs uppercase tracking-widest transition-colors ${
            tab === "episode"
              ? "bg-earth-surface text-parchment shadow-sm"
              : "text-parchment/40 hover:text-parchment/70"
          }`}
        >
          Episode Predictions
        </button>
        <button
          onClick={() => setTab("season")}
          className={`flex-1 rounded-lg py-2.5 font-display text-xs uppercase tracking-widest transition-colors ${
            tab === "season"
              ? "bg-earth-surface text-parchment shadow-sm"
              : "text-parchment/40 hover:text-parchment/70"
          }`}
        >
          Season Predictions
        </button>
      </div>

      {tab === "episode" && (
        <>
          {/* Episode selector */}
          {episodes.length > 0 && (
            <div className="mb-4">
              <select
                value={selectedEpisodeId ?? ""}
                onChange={(e) => setSelectedEpisodeId(Number(e.target.value))}
                className="w-full rounded-lg border border-white/10 bg-earth px-3 py-2.5 text-sm text-parchment outline-none focus:ring-2 focus:ring-survivor-green/30 transition-shadow"
              >
                {[...episodes].reverse().map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    Episode {ep.episode_number}{formatAirDate(ep.air_date)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!episodeForForm ? (
            <div className="rounded-xl border border-white/10 bg-earth-surface p-8 text-center">
              <p className="text-parchment/40 text-sm">No episodes yet — check back soon!</p>
            </div>
          ) : (
            <PredictionsForm
              key={selectedEpisodeId}
              episode={episodeForForm}
              userId={userId}
              existingPredictions={existingPredictions}
              tribeOptions={tribeOptions}
              eliminatedNames={eliminatedNames}
              isMock={isMock}
            />
          )}
        </>
      )}

      {tab === "season" && (
        <SeasonPredictionsForm
          userId={userId}
          existingPredictions={existingSeasonPredictions}
          eliminatedNames={eliminatedNames}
        />
      )}
    </div>
  );
}
