"use client";

import { SEASON_50_PLAYERS } from "@/app/(app)/predictions/players";
import { PlayerAvatar } from "@/app/(app)/predictions/PlayerSelector";

export type TribeData = {
  name: string;
  color: string;
  players: string[];
};

function PlayerIcon({ playerName, dimmed = false }: { playerName: string; dimmed?: boolean }) {
  const player = SEASON_50_PLAYERS.find((p) => p.name === playerName);
  const initials = playerName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-12">
      <div
        className={`w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/10 ${
          dimmed ? "grayscale opacity-50" : ""
        }`}
      >
        {player ? (
          <PlayerAvatar player={player} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/10 text-parchment font-bold text-xs select-none">
            {initials}
          </div>
        )}
      </div>
      <span className="text-[10px] text-parchment/50 text-center leading-tight line-clamp-2 w-full">
        {playerName}
      </span>
    </div>
  );
}

export default function TribeGrid({
  tribes,
  eliminated,
}: {
  tribes: TribeData[];
  eliminated: string[]; // ordered first-eliminated first
}) {
  const hasTribes = tribes.length > 0;
  const hasEliminated = eliminated.length > 0;

  if (!hasTribes && !hasEliminated) return null;

  // Reverse for display: last eliminated on the left, first eliminated on the right
  const eliminatedForDisplay = [...eliminated].reverse();

  return (
    <div className="mb-6 space-y-4">
      {/* Current Tribes */}
      {hasTribes && (
        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-parchment/60 mb-3">
            Current Tribes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tribes.map(({ name: tribeName, color, players }) => (
              <div
                key={tribeName}
                className="rounded-xl border border-white/10 bg-earth-surface overflow-hidden"
              >
                {/* Tribe header */}
                <div
                  className="px-4 py-2.5 flex items-center gap-2"
                  style={{ backgroundColor: color + "33" }}
                >
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <p className="font-display text-sm uppercase tracking-wider text-parchment">
                    {tribeName}
                  </p>
                  <p className="ml-auto text-xs text-parchment/40">{players.length} left</p>
                </div>
                {/* Player avatars */}
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {players.map((name) => (
                    <PlayerIcon key={name} playerName={name} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Eliminated strip */}
      {hasEliminated && (
        <div>
          <h2 className="font-display text-lg uppercase tracking-wide text-parchment/60 mb-3">
            Eliminated
          </h2>
          <div className="rounded-xl border border-white/10 bg-earth-surface px-4 py-3">
            <div className="flex items-start gap-3 overflow-x-auto pb-1">
              <div className="flex flex-col items-center justify-center shrink-0 pt-1 pb-4">
                <span className="text-[10px] font-display uppercase tracking-wide text-parchment/30 whitespace-nowrap">
                  Last
                </span>
                <span className="text-[10px] font-display uppercase tracking-wide text-parchment/30 whitespace-nowrap">
                  Out
                </span>
              </div>

              <div className="flex gap-2">
                {eliminatedForDisplay.map((name) => (
                  <PlayerIcon key={name} playerName={name} dimmed />
                ))}
              </div>

              <div className="flex flex-col items-center justify-center shrink-0 pt-1 pb-4">
                <span className="text-[10px] font-display uppercase tracking-wide text-parchment/30 whitespace-nowrap">
                  First
                </span>
                <span className="text-[10px] font-display uppercase tracking-wide text-parchment/30 whitespace-nowrap">
                  Out
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
