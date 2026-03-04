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
  answer_type: "player" | "tribe" | "free";
  num_players: number;
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

export default function PredictionsForm({
  episode,
  userId,
  existingPredictions,
  tribeOptions = [],
  eliminatedNames = [],
  isMock = false,
}: {
  episode: Episode;
  userId: string;
  existingPredictions: Record<number, string>;
  tribeOptions?: { name: string; players: string[] }[];
  eliminatedNames?: string[];
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

  function handlePlayerSelect(questionId: number, playerIds: string[]) {
    // Store comma-separated player names as predicted_answer
    const names = playerIds
      .map((id) => SEASON_50_PLAYERS.find((p) => p.id === id)?.name ?? "")
      .filter(Boolean)
      .join(",");
    setAnswers((prev) => ({ ...prev, [questionId]: names }));
  }

  /** Returns the player IDs currently selected for a player-type question */
  function getSelectedPlayerIds(questionId: number): string[] {
    const val = answers[questionId] ?? "";
    if (!val) return [];
    return val
      .split(",")
      .map((name) => SEASON_50_PLAYERS.find((p) => p.name === name.trim())?.id ?? "")
      .filter(Boolean);
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

    const hasPlayerQuestion = upserts.some((u) => {
      const q = sortedQuestions.find((q) => q.id === u.question_id);
      return q?.answer_type === "player";
    });

    if (hasPlayerQuestion) {
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
            const isPlayerQuestion = question.answer_type === "player";
            const isTribeQuestion = question.answer_type === "tribe";
            const hasAnswer = !!answers[question.id];

            // For a locked player question, find the submitted player(s)
            const submittedPlayers = locked && isPlayerQuestion && hasAnswer
              ? (answers[question.id] ?? "")
                  .split(",")
                  .map((name) => SEASON_50_PLAYERS.find((p) => p.name === name.trim()) ?? null)
                  .filter(Boolean)
              : [];

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
                      {submittedPlayers.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-parchment/40">🔒 Your pick{submittedPlayers.length > 1 ? "s" : ""}</p>
                          <div className="flex flex-wrap gap-3">
                            {submittedPlayers.map((p) => p && (
                              <div key={p.id} className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                  <PlayerAvatar player={p} />
                                </div>
                                <span className="text-sm font-semibold text-parchment">{p.name}</span>
                              </div>
                            ))}
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
                  ) : isPlayerQuestion ? (
                    // Player selector (multi-select)
                    <PlayerSelector
                      selected={getSelectedPlayerIds(question.id)}
                      onChange={(playerIds) => handlePlayerSelect(question.id, playerIds)}
                      maxSelections={question.num_players}
                      eliminatedNames={eliminatedNames}
                    />
                  ) : isTribeQuestion ? (
                    // Tribe dropdown
                    <select
                      value={answers[question.id] ?? ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({ ...prev, [question.id]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-white/10 bg-earth px-3 py-2 text-sm text-parchment outline-none focus:ring-2 focus:ring-survivor-green/30 transition-shadow"
                    >
                      <option value="">— pick a tribe —</option>
                      {tribeOptions.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}: {t.players.join(", ")}
                        </option>
                      ))}
                    </select>
                  ) : (
                    // Free text input
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
                    ? `Locked ${new Date(question.lock_time).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`
                    : `Locks ${new Date(question.lock_time).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`}
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
                Are you sure about your pick{pendingUpserts.filter((u) => sortedQuestions.find((q) => q.id === u.question_id)?.answer_type === "player").length > 0 ? "s" : ""}?
              </p>
            </div>

            {/* Player question answers */}
            {pendingUpserts
              .filter((u) => {
                const q = sortedQuestions.find((q) => q.id === u.question_id);
                return q?.answer_type === "player";
              })
              .map((u) => {
                const playerNames = u.predicted_answer.split(",").map((n) => n.trim());
                const players = playerNames
                  .map((name) => SEASON_50_PLAYERS.find((p) => p.name === name) ?? null)
                  .filter(Boolean);
                return (
                  <div
                    key={u.question_id}
                    className="flex flex-col items-center gap-3 py-4 px-6 bg-survivor-green/10 border-y border-survivor-green/20"
                  >
                    <div className="flex gap-3 justify-center flex-wrap">
                      {players.map((p) => p && (
                        <div key={p.id} className="flex flex-col items-center gap-1">
                          <div className="w-16 h-16 rounded-full overflow-hidden ring-4 ring-survivor-green ring-offset-2 ring-offset-earth-surface">
                            <PlayerAvatar player={p} />
                          </div>
                          <p className="text-sm font-bold text-parchment">{p.name}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-parchment/50">
                      {players.length === 1 ? "will be eliminated tonight" : "your picks"}
                    </p>
                  </div>
                );
              })}

            {/* Other answers summary */}
            {pendingUpserts
              .filter((u) => {
                const q = sortedQuestions.find((q) => q.id === u.question_id);
                return q?.answer_type !== "player";
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
