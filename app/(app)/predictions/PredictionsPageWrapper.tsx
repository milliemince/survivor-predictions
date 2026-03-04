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
};

type Episode = {
  id: number;
  episode_number: number;
  questions: Question[];
};

export default function PredictionsPageWrapper({
  episode,
  userId,
  existingPredictions,
  existingSeasonPredictions,
  tribeOptions,
  eliminatedNames,
  isMock,
}: {
  episode: Episode | null;
  userId: string;
  existingPredictions: Record<number, string>;
  existingSeasonPredictions: Record<string, string>;
  tribeOptions: { name: string; players: string[] }[];
  eliminatedNames: string[];
  isMock: boolean;
}) {
  const [tab, setTab] = useState<Tab>("episode");

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
          {!episode ? (
            <div className="rounded-xl border border-white/10 bg-earth-surface p-8 text-center">
              <p className="text-parchment/40 text-sm">No episodes yet — check back soon!</p>
            </div>
          ) : (
            <PredictionsForm
              episode={episode}
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
