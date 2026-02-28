export type Player = {
  id: string;
  name: string;
  /**
   * Path relative to /public, e.g. "/players/jane-doe.jpg"
   * Leave undefined to show the colored-initial placeholder avatar.
   * TODO: Fill these in once player photos are added to /public/players/
   */
  image?: string;
};

// TODO: Replace with actual Season 50 cast — add real names and image paths once photos are in /public/players/
export const SEASON_50_PLAYERS: Player[] = [
  { id: "p01", name: "Tony Vlachos" },
  { id: "p02", name: "Sandra Diaz" },
  { id: "p03", name: "Parvati Shallow" },
  { id: "p04", name: "Boston Rob" },
  { id: "p05", name: "Kim Spradlin" },
];

// One distinct color per player slot — used for placeholder avatars
export const PLAYER_COLORS: string[] = [
  "#F87171", // red
  "#FB923C", // orange
  "#FBBF24", // amber
  "#84CC16", // lime
  "#34D399", // emerald
  "#22D3EE", // cyan
  "#60A5FA", // blue
  "#818CF8", // indigo
  "#A78BFA", // violet
  "#F472B6", // pink
  "#EF4444", // rose-red
  "#F97316", // deep orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#06B6D4", // teal
  "#3B82F6", // blue-600
  "#8B5CF6", // purple
  "#EC4899", // hot pink
];
