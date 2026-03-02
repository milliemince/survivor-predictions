"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlayerSelector, { PlayerAvatar } from "./PlayerSelector";
import { SEASON_50_PLAYERS } from "./players";

type Question = {
  id: number;
  question_text: string;
  point_value: number;
  lock_time: string;
};

type Episode = {
  id: number;
  episode_number: number;
  questions: Question[];
};

type Upsert = {
  user_id: string;
  question_id: number;
  predicted_answer: string;
};

/** Detects questions that should use the player-picker instead of a text input. */
function isEliminationQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("eliminat") ||
    lower.includes("voted out") ||
    lower.includes("going home") ||
    lower.includes("who is leaving")
  );
}

export default function PredictionsForm({
  episode,
  userId,
  existingPredictions,
  isMock = false,
}: {
  episode: Episode;
  userId: string;
  existingPredictions: Record<number, string>;
  isMock?: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, string>>(existingPredictions);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Confirmation modal state
  const [pendingUpserts, setPendingUpserts] = useState<Upsert[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const now = new Date();

  function isLocked(lockTime: string) {
    return new Date(lockTime) <= now;
  }

  const sortedQuestions = [...episode.questions].sort(
    (a, b) => new Date(a.lock_time).getTime() - new Date(b.lock_time).getTime()
  );

  // The elimination question (if any) that the user has answered
  const eliminationQuestion = sortedQuestions.find(
    (q) => isEliminationQuestion(q.question_text) && !isLocked(q.lock_time)
  );
  const selectedPlayerId = eliminationQuestion ? (answers[eliminationQuestion.id] ?? "") : "";
  const selectedPlayer = SEASON_50_PLAYERS.find((p) => p.name === selectedPlayerId) ?? null;

  function handlePlayerSelect(questionId: number, playerId: string) {
    const player = SEASON_50_PLAYERS.find((p) => p.id === playerId);
    // Store the player's name as the predicted answer (matches scoring comparison)
    setAnswers((prev) => ({ ...prev, [questionId]: player?.name ?? "" }));
  }

  function buildUpserts(): Upsert[] {
    const unlocked = sortedQuestions.filter((q) => !isLocked(q.lock_time));
    return unlocked
      .filter((q) => q.id > 0) // skip mock questions (id < 0)
      .filter((q) => answers[q.id] !== undefined && answers[q.id].trim() !== "")
      .map((q) => ({
        user_id: userId,
        question_id: q.id,
        predicted_answer: answers[q.id].trim(),
      }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const upserts = buildUpserts();

    if (upserts.length === 0) {
      setToast({ type: "error", message: "Select or enter at least one prediction before saving." });
      return;
    }

    const hasElimination = upserts.some((u) => {
      const q = sortedQuestions.find((q) => q.id === u.question_id);
      return q && isEliminationQuestion(q.question_text);
    });

    if (hasElimination) {
      // Show confirmation modal before saving
      setPendingUpserts(upserts);
      setShowConfirm(true);
    } else {
      doSave(upserts);
    }
  }

  async function doSave(upserts: Upsert[]) {
    setSaving(true);
    setShowConfirm(false);
    setToast(null);

    const { error } = await supabase
      .from("predictions")
      .upsert(upserts, { onConflict: "user_id,question_id" });

    setSaving(false);

    if (error) {
      setToast({ type: "error", message: error.message });
    } else {
      setToast({
        type: "success",
        message: `${upserts.length} prediction${upserts.length !== 1 ? "s" : ""} saved!`,
      });
      setTimeout(() => setToast(null), 4000);
    }
  }

  const allLocked = sortedQuestions.every((q) => isLocked(q.lock_time));

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-6">
          {sortedQuestions.map((question) => {
            const locked = isLocked(question.lock_time);
            const isElimination = isEliminationQuestion(question.question_text);
            const hasAnswer = !!answers[question.id];

            // For a locked elimination question, find the submitted player
            const submittedPlayer = locked && isElimination && hasAnswer
              ? SEASON_50_PLAYERS.find((p) => p.name === answers[question.id]) ?? null
              : null;

            return (
              <div
                key={question.id}
                className={`rounded-xl border transition-opacity ${
                  locked
                    ? "opacity-60 border-white/5 bg-earth/50"
                    : "border-white/10 bg-earth-surface"
                }`}
              >
                {/* Question header */}
                <div className="flex items-start justify-between gap-4 p-5 pb-3">
                  <p className="text-sm font-medium leading-relaxed text-parchment">
                    {question.question_text}
                  </p>
                  <span className="shrink-0 rounded-full bg-ocean-blue/20 px-2.5 py-0.5 text-xs font-semibold text-ocean-blue">
                    {question.point_value} pt{question.point_value !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Answer area */}
                <div className="px-5 pb-4">
                  {locked ? (
                    // Locked state
                    <div className="rounded-lg bg-earth border border-white/10 px-3 py-2.5">
                      {submittedPlayer ? (
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                            <PlayerAvatar player={submittedPlayer} />
                          </div>
                          <div>
                            <p className="text-xs text-parchment/40">🔒 Your pick</p>
                            <p className="text-sm font-semibold text-parchment">{submittedPlayer.name}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-parchment/50">
                          🔒{" "}
                          {hasAnswer
                            ? `Your answer: "${answers[question.id]}"`
                            : "No prediction submitted"}
                        </p>
                      )}
                    </div>
                  ) : isElimination ? (
                    // Player selector
                    <PlayerSelector
                      selected={
                        SEASON_50_PLAYERS.find((p) => p.name === answers[question.id])?.id ?? ""
                      }
                      onChange={(playerId) => handlePlayerSelect(question.id, playerId)}
                    />
                  ) : (
                    // Text input for other question types
                    <input
                      type="text"
                      value={answers[question.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                      }
                      placeholder="Your prediction..."
                      className="w-full rounded-lg border border-white/10 bg-earth px-3 py-2 text-sm text-parchment placeholder:text-parchment/30 outline-none focus:ring-2 focus:ring-survivor-green/30 transition-shadow"
                    />
                  )}
                </div>

                {/* Lock time */}
                <p className="px-5 pb-3 text-xs text-parchment/40">
                  {locked
                    ? `Locked ${new Date(question.lock_time).toLocaleString()}`
                    : `Locks ${new Date(question.lock_time).toLocaleString()}`}
                </p>
              </div>
            );
          })}
        </div>

        {isMock && (
          <div className="mb-4 rounded-lg border border-amber-100/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
            <span className="font-semibold">Preview only</span> — add this question via the Admin panel to enable saving.
          </div>
        )}

        {toast && (
          <div
            className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
              toast.type === "success"
                ? "bg-survivor-green/10 text-survivor-green border border-survivor-green/20"
                : "bg-tribal-red/10 text-tribal-red border border-tribal-red/20"
            }`}
          >
            {toast.message}
          </div>
        )}

        {!allLocked && !isMock && (
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-survivor-green py-3 text-sm font-semibold text-white hover:bg-survivor-green-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Predictions"}
          </button>
        )}

        {allLocked && (
          <div className="rounded-full bg-earth border border-white/10 py-3 text-center text-sm font-medium text-parchment/50">
            🔒 All predictions are locked for this episode
          </div>
        )}
      </form>

      {/* ── Confirmation Modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-earth-surface border border-white/10 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center">
              <h2 className="text-lg font-bold text-parchment">Confirm Prediction</h2>
              <p className="text-sm text-parchment/50 mt-1">
                Are you sure about your pick?
              </p>
            </div>

            {/* Selected player — for elimination question */}
            {selectedPlayer && (
              <div className="flex flex-col items-center gap-3 py-4 px-6 bg-survivor-green/10 border-y border-survivor-green/20">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-4 ring-survivor-green ring-offset-2 ring-offset-earth-surface">
                  <PlayerAvatar player={selectedPlayer} />
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-parchment">{selectedPlayer.name}</p>
                  <p className="text-sm text-parchment/50 mt-0.5">will be eliminated tonight</p>
                </div>
              </div>
            )}

            {/* Other answers summary */}
            {pendingUpserts
              .filter((u) => {
                const q = sortedQuestions.find((q) => q.id === u.question_id);
                return q && !isEliminationQuestion(q.question_text);
              })
              .map((u) => {
                const q = sortedQuestions.find((q) => q.id === u.question_id)!;
                return (
                  <div key={u.question_id} className="px-6 py-3 border-b border-white/5 last:border-0">
                    <p className="text-xs text-parchment/40 mb-0.5 truncate">{q.question_text}</p>
                    <p className="text-sm font-medium text-parchment">{u.predicted_answer}</p>
                  </div>
                );
              })}

            {/* Actions */}
            <div className="flex gap-3 p-5">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-full border border-white/10 py-2.5 text-sm font-medium text-parchment hover:bg-white/5 transition-colors"
              >
                ← Change
              </button>
              <button
                type="button"
                onClick={() => doSave(pendingUpserts)}
                disabled={saving}
                className="flex-1 rounded-full bg-survivor-green py-2.5 text-sm font-semibold text-white hover:bg-survivor-green-dark disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Confirm →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
