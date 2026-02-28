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

/** Grid of every Season 50 player as a selectable circular card. */
export default function PlayerSelector({
  selected,
  onChange,
  disabled = false,
}: {
  selected: string;
  onChange: (playerId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-10">
      {SEASON_50_PLAYERS.map((player) => {
        const isSelected = selected === player.id;
        return (
          <button
            key={player.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(isSelected ? "" : player.id)}
            className={`flex flex-col items-center gap-1.5 group focus:outline-none disabled:pointer-events-none`}
          >
            {/* Circle */}
            <div
              className={`relative w-full aspect-square rounded-full overflow-hidden transition-all duration-150 ${
                isSelected
                  ? "ring-[3px] ring-orange-500 ring-offset-2 scale-105"
                  : "ring-2 ring-transparent group-hover:ring-zinc-300"
              } ${disabled ? "opacity-50" : ""}`}
            >
              <PlayerAvatar player={player} />

              {/* Selected checkmark overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shadow">
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
              className={`text-sm font-bold leading-tight text-center line-clamp-2 w-full transition-colors ${
                isSelected ? "text-orange-700" : "text-zinc-600 group-hover:text-zinc-800"
              }`}
            >
              {player.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
