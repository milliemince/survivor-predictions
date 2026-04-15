"use client";

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

export default function SeasonPredictionsForm({
  userId,
  existingPredictions,
  eliminatedNames = [],
}: {
  userId: string;
  existingPredictions: Record<string, string>; // milestone → comma-separated names
  eliminatedNames?: string[];
}) {
  // selectedIds: milestone → array of player IDs (read-only, predictions are locked)
  const selectedIds = Object.fromEntries(
    MILESTONES.map((m) => [m.key, namesToIds(existingPredictions[m.key] ?? "")])
  ) as Record<MilestoneKey, string[]>;

  // Derive the available player pool for each milestone from the parent milestone's selections
  function poolForMilestone(key: MilestoneKey): Player[] {
    if (key === "merge") return SEASON_50_PLAYERS;
    if (key === "top_7") return SEASON_50_PLAYERS.filter((p) => selectedIds.merge.includes(p.id));
    if (key === "final_tribal") return SEASON_50_PLAYERS.filter((p) => selectedIds.top_7.includes(p.id));
    if (key === "sole_survivor") return SEASON_50_PLAYERS.filter((p) => selectedIds.final_tribal.includes(p.id));
    return SEASON_50_PLAYERS;
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
                  onChange={() => {}}
                  maxSelections={needed}
                  eliminatedNames={eliminatedNames}
                  availablePlayers={poolForMilestone(milestone.key)}
                />
              )}
            </div>
          </div>
        );
      })}

      <div className="rounded-lg px-4 py-3 text-sm font-medium text-center bg-white/5 text-parchment/50 border border-white/10">
        Season predictions are locked.
      </div>
    </div>
  );
}
