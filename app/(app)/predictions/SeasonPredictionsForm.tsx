"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PlayerSelector from "./PlayerSelector";
import { SEASON_50_PLAYERS } from "./players";

const MILESTONES = [
  { key: "top_16", label: "Top 16", description: "Which 16 players survive the first votes?", count: 16 },
  { key: "top_12", label: "Top 12", description: "Pick who makes the merge.", count: 12 },
  { key: "top_9", label: "Top 9", description: "Who survives to the final 9?", count: 9 },
  { key: "top_7", label: "Top 7", description: "Who makes it to the final 7?", count: 7 },
  { key: "top_5", label: "Top 5", description: "Pick your final 5.", count: 5 },
  { key: "final_tribal", label: "Final Tribal", description: "Who sits at Final Tribal Council?", count: 3 },
  { key: "sole_survivor", label: "Sole Survivor", description: "Who wins Survivor 50?", count: 1 },
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
}: {
  userId: string;
  existingPredictions: Record<string, string>; // milestone → comma-separated names
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

  function handleChange(key: MilestoneKey, ids: string[]) {
    setSelectedIds((prev) => ({ ...prev, [key]: ids }));
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-parchment">{milestone.label}</h3>
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
            <div className="p-5">
              <PlayerSelector
                selected={selected}
                onChange={(ids) => handleChange(milestone.key, ids)}
                maxSelections={needed}
              />
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
