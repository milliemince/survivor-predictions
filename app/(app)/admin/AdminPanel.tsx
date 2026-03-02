"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { SEASON_50_PLAYERS } from "@/app/(app)/predictions/players";

type Episode = {
  id: number;
  episode_number: number;
  air_date: string | null;
};

type Question = {
  id: number;
  episode_id: number;
  question_text: string;
  point_value: number;
  correct_answer: string | null;
  lock_time: string;
  answer_type: string;
  num_players: number;
  episodes: { episode_number: number } | null;
};

type Tab = "episodes" | "questions" | "scoring" | "season";

type Message = { type: "success" | "error"; text: string };

function StatusMessage({ msg }: { msg: Message | null }) {
  if (!msg) return null;
  return (
    <p
      className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
        msg.type === "success"
          ? "bg-green-50 text-green-700 border border-green-100"
          : "bg-red-50 text-red-700 border border-red-100"
      }`}
    >
      {msg.text}
    </p>
  );
}

export default function AdminPanel({
  episodes,
  questions,
}: {
  episodes: Episode[];
  questions: Question[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("episodes");

  // ── Episode form ──────────────────────────────────────
  const [epNumber, setEpNumber] = useState("");
  const [epDate, setEpDate] = useState("");
  const [epLoading, setEpLoading] = useState(false);
  const [epMsg, setEpMsg] = useState<Message | null>(null);

  async function createEpisode(e: React.FormEvent) {
    e.preventDefault();
    setEpLoading(true);
    setEpMsg(null);
    const { error } = await supabase.from("episodes").insert({
      episode_number: parseInt(epNumber),
      air_date: epDate || null,
    });
    setEpLoading(false);
    if (error) {
      setEpMsg({ type: "error", text: error.message });
    } else {
      setEpMsg({ type: "success", text: `Episode ${epNumber} created!` });
      setEpNumber("");
      setEpDate("");
      router.refresh();
    }
  }

  // ── Question form ─────────────────────────────────────
  const [qEpisodeId, setQEpisodeId] = useState(episodes[0]?.id?.toString() ?? "");
  const [qText, setQText] = useState("");
  const [qPoints, setQPoints] = useState("1");
  const [qLockTime, setQLockTime] = useState("");
  const [qAnswerType, setQAnswerType] = useState<"free" | "player" | "tribe">("free");
  const [qNumPlayers, setQNumPlayers] = useState("1");
  const [qLoading, setQLoading] = useState(false);
  const [qMsg, setQMsg] = useState<Message | null>(null);

  async function createQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!qEpisodeId) {
      setQMsg({ type: "error", text: "Select an episode first." });
      return;
    }
    setQLoading(true);
    setQMsg(null);
    const { error } = await supabase.from("questions").insert({
      episode_id: parseInt(qEpisodeId),
      question_text: qText.trim(),
      point_value: parseInt(qPoints),
      lock_time: qLockTime,
      answer_type: qAnswerType,
      num_players: qAnswerType === "player" ? parseInt(qNumPlayers) : 1,
    });
    setQLoading(false);
    if (error) {
      setQMsg({ type: "error", text: error.message });
    } else {
      setQMsg({ type: "success", text: "Question created!" });
      setQText("");
      setQPoints("1");
      setQLockTime("");
      setQAnswerType("free");
      setQNumPlayers("1");
      router.refresh();
    }
  }

  // ── Scoring quick-fill ────────────────────────────────
  const [tribeNames, setTribeNames] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from("tribe_states")
      .select("tribe_name")
      .neq("tribe_name", "Eliminated")
      .then(({ data }) => {
        setTribeNames([...new Set(data?.map((r) => r.tribe_name) ?? [])]);
      });
  }, []);

  // ── Season State ──────────────────────────────────────
  const [seasonLoading, setSeasonLoading] = useState(false);
  const [seasonMsg, setSeasonMsg] = useState<Message | null>(null);

  async function handleRefetchSeason() {
    setSeasonLoading(true);
    setSeasonMsg(null);
    try {
      const res = await fetch("/api/refetch-season", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setSeasonMsg({
          type: "success",
          text: `Updated ${data.playersCount} players across ${data.tribesCount} tribes (Episode ${data.episodeNumber})${data.episodesUpserted ? ` · ${data.episodesUpserted} episodes upserted` : ""}`,
        });
        router.refresh();
      } else {
        setSeasonMsg({ type: "error", text: data.error ?? "Unknown error" });
      }
    } catch (err) {
      setSeasonMsg({ type: "error", text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSeasonLoading(false);
    }
  }

  // ── Scoring form ──────────────────────────────────────
  const [scoreQId, setScoreQId] = useState(questions[0]?.id?.toString() ?? "");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreMsg, setScoreMsg] = useState<Message | null>(null);

  async function handleScoring(e: React.FormEvent) {
    e.preventDefault();
    if (!scoreQId) {
      setScoreMsg({ type: "error", text: "Select a question first." });
      return;
    }
    setScoreLoading(true);
    setScoreMsg(null);

    const qId = parseInt(scoreQId);

    // Save the correct answer
    const { error: saveErr } = await supabase
      .from("questions")
      .update({ correct_answer: correctAnswer.trim() })
      .eq("id", qId);

    if (saveErr) {
      setScoreMsg({ type: "error", text: saveErr.message });
      setScoreLoading(false);
      return;
    }

    // Trigger the scoring function
    const { error: rpcErr } = await supabase.rpc("score_question", {
      question_id_input: qId,
    });

    setScoreLoading(false);

    if (rpcErr) {
      setScoreMsg({ type: "error", text: rpcErr.message });
    } else {
      setScoreMsg({ type: "success", text: "Scoring complete! Points updated." });
      setCorrectAnswer("");
      router.refresh();
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "episodes", label: "Episodes" },
    { id: "questions", label: "Questions" },
    { id: "scoring", label: "Scoring" },
    { id: "season", label: "Season" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel ⚙️</h1>
        <p className="text-zinc-600 mt-1">Manage episodes, questions, and scoring.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-zinc-600 hover:text-zinc-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Episodes Tab ── */}
      {tab === "episodes" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-4">Create Episode</h2>
            <form onSubmit={createEpisode} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Episode Number
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={epNumber}
                  onChange={(e) => setEpNumber(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Air Date
                </label>
                <input
                  type="date"
                  value={epDate}
                  onChange={(e) => setEpDate(e.target.value)}
                  className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <button
                type="submit"
                disabled={epLoading}
                className="w-full rounded-full bg-orange-600 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {epLoading ? "Creating..." : "Create Episode"}
              </button>
            </form>
            <StatusMessage msg={epMsg} />
          </div>

          {episodes.length > 0 && (
            <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-zinc-50 border-b border-black/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  All Episodes
                </p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {episodes.map((ep) => (
                    <tr key={ep.id} className="border-b border-black/5 last:border-0">
                      <td className="px-5 py-3 font-medium text-zinc-800">Episode {ep.episode_number}</td>
                      <td className="px-5 py-3 text-zinc-700 text-right">
                        {ep.air_date
                          ? new Date(ep.air_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Questions Tab ── */}
      {tab === "questions" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-4">Create Question</h2>

            {episodes.length === 0 ? (
              <p className="text-sm text-zinc-600">Create an episode first.</p>
            ) : (
              <form onSubmit={createQuestion} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Episode</label>
                  <select
                    value={qEpisodeId}
                    onChange={(e) => setQEpisodeId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-200 bg-white"
                  >
                    {episodes.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        Episode {ep.episode_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Question Text
                  </label>
                  <textarea
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    required
                    rows={3}
                    placeholder="Who will be voted out this episode?"
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-200 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Point Value
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={qPoints}
                      onChange={(e) => setQPoints(e.target.value)}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Lock Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={qLockTime}
                      onChange={(e) => setQLockTime(e.target.value)}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Answer Type
                  </label>
                  <select
                    value={qAnswerType}
                    onChange={(e) => setQAnswerType(e.target.value as "free" | "player" | "tribe")}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-200 bg-white"
                  >
                    <option value="free">Free answer</option>
                    <option value="player">Player pick</option>
                    <option value="tribe">Tribe pick</option>
                  </select>
                </div>
                {qAnswerType === "player" && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Num Players to Pick
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      required
                      value={qNumPlayers}
                      onChange={(e) => setQNumPlayers(e.target.value)}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={qLoading}
                  className="w-full rounded-full bg-orange-600 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {qLoading ? "Creating..." : "Create Question"}
                </button>
              </form>
            )}
            <StatusMessage msg={qMsg} />
          </div>

          {questions.length > 0 && (
            <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-zinc-50 border-b border-black/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  All Questions
                </p>
              </div>
              <div className="divide-y divide-black/5">
                {questions.map((q) => (
                  <div key={q.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">
                          {q.question_text}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          Ep. {q.episodes?.episode_number ?? "?"} ·{" "}
                          {q.point_value} pt{q.point_value !== 1 ? "s" : ""} ·{" "}
                          Locks {new Date(q.lock_time).toLocaleDateString()}
                        </p>
                      </div>
                      {q.correct_answer && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          ✓ Scored
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Season Tab ── */}
      {tab === "season" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-1">Season State</h2>
            <p className="text-xs text-zinc-600 mb-4">
              Fetch current tribe membership from Wikipedia.
            </p>
            <button
              type="button"
              onClick={handleRefetchSeason}
              disabled={seasonLoading}
              className="w-full rounded-full bg-survivor-green py-2 text-sm font-semibold text-white hover:bg-survivor-green-dark disabled:opacity-50 transition-colors"
            >
              {seasonLoading ? "Fetching..." : "Refetch Season State"}
            </button>
            <StatusMessage msg={seasonMsg} />
          </div>
        </div>
      )}

      {/* ── Scoring Tab ── */}
      {tab === "scoring" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-black/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-700 mb-1">Score a Question</h2>
            <p className="text-xs text-zinc-600 mb-4">
              Set the correct answer and trigger scoring for all predictions.
            </p>

            {questions.length === 0 ? (
              <p className="text-sm text-zinc-600">No questions yet.</p>
            ) : (
              <form onSubmit={handleScoring} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Question</label>
                  <select
                    value={scoreQId}
                    onChange={(e) => {
                      setScoreQId(e.target.value);
                      const q = questions.find((q) => q.id === parseInt(e.target.value));
                      setCorrectAnswer(q?.correct_answer ?? "");
                    }}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-200 bg-white"
                  >
                    {questions.map((q) => (
                      <option key={q.id} value={q.id}>
                        Ep. {q.episodes?.episode_number ?? "?"} — {q.question_text.slice(0, 60)}
                        {q.question_text.length > 60 ? "…" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Correct Answer
                  </label>
                  <input
                    type="text"
                    required
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    placeholder="e.g. Sandra"
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                {/* Quick-fill dropdowns */}
                <div className="rounded-lg bg-zinc-50 border border-black/5 px-3 py-3 space-y-2">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Quick fill</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-zinc-700 mb-1">Player</label>
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) setCorrectAnswer(e.target.value); }}
                        className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-200 bg-white"
                      >
                        <option value="">— pick player —</option>
                        {SEASON_50_PLAYERS.map((p) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-700 mb-1">Tribe</label>
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) setCorrectAnswer(e.target.value); }}
                        className="w-full rounded-lg border border-black/10 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-orange-200 bg-white"
                      >
                        <option value="">— pick tribe —</option>
                        {tribeNames.map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={scoreLoading}
                  className="w-full rounded-full bg-orange-600 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors"
                >
                  {scoreLoading ? "Scoring..." : "Save Answer & Score Predictions"}
                </button>
              </form>
            )}
            <StatusMessage msg={scoreMsg} />
          </div>

          {questions.filter((q) => q.correct_answer).length > 0 && (
            <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
              <div className="px-5 py-3 bg-zinc-50 border-b border-black/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Scored Questions
                </p>
              </div>
              <div className="divide-y divide-black/5">
                {questions
                  .filter((q) => q.correct_answer)
                  .map((q) => (
                    <div key={q.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">
                          {q.question_text}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          Ep. {q.episodes?.episode_number ?? "?"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-zinc-600">Answer</p>
                        <p className="text-sm font-semibold text-green-700">{q.correct_answer}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
