"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlayerSelector from "./PlayerSelector";
import { SEASON_50_PLAYERS, type Player } from "./players";

const MILESTONES = [
  { key: "merge", label: "Merge", description: "Pick the 12 players who make the merge.", count: 12 },
  { key: "top_7", label: "Top 7", description: "Of your merge picks, who makes it to the final 7?", count: 7 },
  { key: "final_tribal", label: "Final Tribal", description: "Of your top 7, who sits at Final Tribal Council?", count: 3 },
  { key: "sole_survivor", label: "Sole Survivor", description: "Of your finalists, who wins Survivor 50?", count: 1 },
] as const;

type MilestoneKey = (typeof MILESTONES)[number]["key"];

/** Convert comma-separated player names → player ID array */
function namesToIds(names: string): string[] {
  if (!names) return [];
  return names
    .split(",")
    .map((n) => SEASON_50_PLAYERS.find((p) => p.name === n.trim())?.id ?? "")
    .filter(Boolean);
}

/** Convert player ID array → comma-separated player names */
function idsToNames(ids: string[]): string {
  return ids
    .map((id) => SEASON_50_PLAYERS.find((p) => p.id === id)?.name ?? "")
    .filter(Boolean)
    .join(",");
}

export default function SeasonPredictionsForm({
  userId,
  existingPredictions,
  eliminatedNames = [],
}: {
  userId: string;
  existingPredictions: Record<string, string>; // milestone → comma-separated names
  eliminatedNames?: string[];
}) {
  // selectedIds: milestone → array of player IDs
  const [selectedIds, setSelectedIds] = useState<Record<MilestoneKey, string[]>>(
    () =>
      Object.fromEntries(
        MILESTONES.map((m) => [m.key, namesToIds(existingPredictions[m.key] ?? "")])
      ) as Record<MilestoneKey, string[]>
  );

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Cascade: when a milestone changes, drop any downstream selections no longer in the new pool
  function handleChange(key: MilestoneKey, ids: string[]) {
    setSelectedIds((prev) => {
      const next = { ...prev, [key]: ids };
      if (key === "merge") {
        next.top_7 = next.top_7.filter((id) => ids.includes(id));
        next.final_tribal = next.final_tribal.filter((id) => next.top_7.includes(id));
        next.sole_survivor = next.sole_survivor.filter((id) => next.final_tribal.includes(id));
      } else if (key === "top_7") {
        next.final_tribal = next.final_tribal.filter((id) => ids.includes(id));
        next.sole_survivor = next.sole_survivor.filter((id) => next.final_tribal.includes(id));
      } else if (key === "final_tribal") {
        next.sole_survivor = next.sole_survivor.filter((id) => ids.includes(id));
      }
      return next;
    });
  }

  // Derive the available player pool for each milestone from the parent milestone's selections
  function poolForMilestone(key: MilestoneKey): Player[] {
    if (key === "merge") return SEASON_50_PLAYERS;
    if (key === "top_7") return SEASON_50_PLAYERS.filter((p) => selectedIds.merge.includes(p.id));
    if (key === "final_tribal") return SEASON_50_PLAYERS.filter((p) => selectedIds.top_7.includes(p.id));
    if (key === "sole_survivor") return SEASON_50_PLAYERS.filter((p) => selectedIds.final_tribal.includes(p.id));
    return SEASON_50_PLAYERS;
  }

  async function handleSave() {
    setSaving(true);
    setToast(null);

    const rows = MILESTONES.map((m) => ({
      user_id: userId,
      milestone: m.key,
      player_names: idsToNames(selectedIds[m.key]),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("season_predictions")
      .upsert(rows, { onConflict: "user_id,milestone" });

    setSaving(false);

    if (error) {
      setToast({ type: "error", message: error.message });
    } else {
      setToast({ type: "success", message: "Season predictions saved!" });
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <div className="space-y-6">
      {MILESTONES.map((milestone) => {
        const selected = selectedIds[milestone.key];
        const count = selected.length;
        const needed = milestone.count;
        const complete = count === needed;

        return (
          <div
            key={milestone.key}
            className="rounded-xl border border-white/10 bg-earth-surface overflow-hidden"
          >
            {/* Card header */}
            <div className="flex flex-wrap items-start gap-2 px-4 py-3 sm:px-5 sm:py-4 border-b border-white/10">
              <div>
                <h3 className="font-display text-sm uppercase tracking-widest text-parchment">{milestone.label}</h3>
                <p className="text-xs text-parchment/50 mt-0.5">{milestone.description}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  complete
                    ? "bg-survivor-green/20 text-survivor-green"
                    : "bg-ocean-blue/20 text-ocean-blue"
                }`}
              >
                {count} / {needed}
              </span>
            </div>

            {/* Player selector */}
            <div className="p-3 sm:p-5">
              {poolForMilestone(milestone.key).length === 0 ? (
                <p className="text-xs text-parchment/40 text-center py-4">
                  Complete the previous milestone first.
                </p>
              ) : (
                <PlayerSelector
                  selected={selected}
                  onChange={(ids) => handleChange(milestone.key, ids)}
                  maxSelections={needed}
                  eliminatedNames={eliminatedNames}
                  availablePlayers={poolForMilestone(milestone.key)}
                />
              )}
            </div>
          </div>
        );
      })}

      {toast && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === "success"
              ? "bg-survivor-green/10 text-survivor-green border border-survivor-green/20"
              : "bg-tribal-red/10 text-tribal-red border border-tribal-red/20"
          }`}
        >
          {toast.message}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-full bg-survivor-green py-3 text-sm font-semibold text-white hover:bg-survivor-green-dark disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save Season Predictions"}
      </button>
    </div>
  );
}
