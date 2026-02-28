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

export const SEASON_50_PLAYERS: Player[] = [
  { id: "p01", name: "Mike White", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p01.jpg" },
  { id: "p02", name: "Cirie Fields", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p02.jpg" },
  { id: "p03", name: "Ozzy Lusth", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p03.jpg" },
  { id: "p04", name: 'Benjamin "Coach" Wade', image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p04.jpg" },
  { id: "p05", name: "Stephanie Lagrossa Kendrick", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p05.jpg" },
  { id: "p06", name: "Jenna Lewis-Dougherty", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p06.jpg" },
  { id: "p07", name: "Colby Donaldson", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p07.jpg" },
  { id: "p08", name: "Tiffany Ervin", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p08.jpg" },
  { id: "p09", name: "Charlie Davis", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p09.jpg" },
  { id: "p10", name: "Q Burdette", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p10.jpg" },
  { id: "p11", name: "Emily Flippen", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p11.jpg" },
  { id: "p12", name: "Dee Valladares", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p12.jpg" },
  { id: "p13", name: "Jonathan Young", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p13.jpg" },
  { id: "p14", name: "Christian Hubicki", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p14.jpg" },
  { id: "p15", name: "Angelina Keeley", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p15.jpg" },
  { id: "p16", name: "Kyle Fraser", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p16.jpg" },
  { id: "p17", name: "Aubry Bracco", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p17.jpg" },
  { id: "p18", name: "Chrissy Hofbeck", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p18.jpg" },
  { id: "p19", name: "Rick Devens", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p19.jpg" },
  { id: "p20", name: "Kamilla Karthigesu", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p20.jpg" },
  { id: "p21", name: "Joseph Hunter", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p21.jpg" },
  { id: "p22", name: "Genevieve Mushaluk", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p22.jpg" },
  { id: "p23", name: "Savannah Louie", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p23.jpg" },
  { id: "p24", name: "Rizo Velovic", image: "http://127.0.0.1:54321/storage/v1/object/public/player-photos/p24.jpg" },
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
