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
  { id: "p01", name: "Mike White", image: "/players/p01.jpg" },
  { id: "p02", name: "Cirie Fields", image: "/players/p02.jpg" },
  { id: "p03", name: "Ozzy Lusth", image: "/players/p03.jpg" },
  { id: "p04", name: 'Benjamin "Coach" Wade', image: "/players/p04.jpg" },
  { id: "p05", name: "Stephanie Lagrossa Kendrick", image: "/players/p05.jpg" },
  { id: "p06", name: "Jenna Lewis-Dougherty", image: "/players/p06.jpg" },
  { id: "p07", name: "Colby Donaldson", image: "/players/p07.jpg" },
  { id: "p08", name: "Tiffany Ervin", image: "/players/p08.jpg" },
  { id: "p09", name: "Charlie Davis", image: "/players/p09.jpg" },
  { id: "p10", name: "Q Burdette", image: "/players/p10.jpg" },
  { id: "p11", name: "Emily Flippen", image: "/players/p11.jpg" },
  { id: "p12", name: "Dee Valladares", image: "/players/p12.jpg" },
  { id: "p13", name: "Jonathan Young", image: "/players/p13.jpg" },
  { id: "p14", name: "Christian Hubicki", image: "/players/p14.jpg" },
  { id: "p15", name: "Angelina Keeley", image: "/players/p15.jpg" },
  { id: "p16", name: "Kyle Fraser", image: "/players/p16.jpg" },
  { id: "p17", name: "Aubry Bracco", image: "/players/p17.jpg" },
  { id: "p18", name: "Chrissy Hofbeck", image: "/players/p18.jpg" },
  { id: "p19", name: "Rick Devens", image: "/players/p19.jpg" },
  { id: "p20", name: "Kamilla Karthigesu", image: "/players/p20.jpg" },
  { id: "p21", name: "Joe Hunter", image: "/players/p21.jpg" },
  { id: "p22", name: "Genevieve Mushaluk", image: "/players/p22.jpg" },
  { id: "p23", name: "Savannah Louie", image: "/players/p23.jpg" },
  { id: "p24", name: "Rizo Velovic", image: "/players/p24.jpg" },
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
