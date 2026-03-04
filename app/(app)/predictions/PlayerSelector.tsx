"use client";

import { SEASON_50_PLAYERS, PLAYER_COLORS, type Player } from "./players";

/** Circular avatar — shows the player's photo if available, otherwise a colored initial. */
export function PlayerAvatar({
  player,
  className = "",
}: {
  player: Player;
  className?: string;
}) {
  const index = SEASON_50_PLAYERS.findIndex((p) => p.id === player.id);
  const bgColor = PLAYER_COLORS[index % PLAYER_COLORS.length];
  const initials = player.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (player.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.image}
        alt={player.name}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      style={{ backgroundColor: bgColor }}
      className={`w-full h-full flex items-center justify-center text-white font-bold select-none ${className}`}
    >
      {initials}
    </div>
  );
}

/** Grid of every Season 50 player as a selectable circular card. Supports multi-select. */
export default function PlayerSelector({
  selected,
  onChange,
  disabled = false,
  maxSelections = 1,
  eliminatedNames = [],
}: {
  selected: string[];
  onChange: (playerIds: string[]) => void;
  disabled?: boolean;
  maxSelections?: number;
  eliminatedNames?: string[];
}) {
  const activePlayers = SEASON_50_PLAYERS.filter((p) => !eliminatedNames.includes(p.name));
  const selectionCount = selected.length;
  const atMax = selectionCount >= maxSelections;

  return (
    <div>
      {maxSelections > 1 && (
        <p className="text-xs text-parchment/50 mb-3 text-right">
          {selectionCount} / {maxSelections} selected
        </p>
      )}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-x-2 gap-y-6">
        {activePlayers.map((player) => {
          const isSelected = selected.includes(player.id);
          const isDisabledByMax = !isSelected && atMax;

          return (
            <button
              key={player.id}
              type="button"
              disabled={disabled || isDisabledByMax}
              onClick={() => {
                if (isSelected) {
                  onChange(selected.filter((id) => id !== player.id));
                } else if (!atMax) {
                  onChange([...selected, player.id]);
                }
              }}
              className={`flex flex-col items-center gap-1.5 group focus:outline-none ${
                isDisabledByMax ? "pointer-events-none" : ""
              }`}
            >
              {/* Circle */}
              <div
                className={`relative w-full aspect-square rounded-full overflow-hidden transition-all duration-150 ${
                  isSelected
                    ? "ring-[3px] ring-survivor-green ring-offset-2 ring-offset-earth-surface scale-105"
                    : isDisabledByMax
                    ? "ring-2 ring-transparent opacity-30"
                    : "ring-2 ring-transparent group-hover:ring-white/30"
                } ${disabled ? "opacity-50" : ""}`}
              >
                <PlayerAvatar player={player} />

                {/* Selected checkmark overlay */}
                {isSelected && (
                  <div className="absolute inset-0 bg-survivor-green/20 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-survivor-green flex items-center justify-center shadow">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Name */}
              <span
                className={`text-xs font-semibold leading-tight text-center line-clamp-2 w-full transition-colors ${
                  isSelected
                    ? "text-survivor-green"
                    : isDisabledByMax
                    ? "text-parchment/20"
                    : "text-parchment/60 group-hover:text-parchment"
                }`}
              >
                {player.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
