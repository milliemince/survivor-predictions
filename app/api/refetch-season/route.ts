import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@/lib/supabaseServer";

const WIKI_PAGE = "Survivor_50:_In_the_Hands_of_the_Fans";
const SEASON = 50;
// Section indices on the Wikipedia page (verify with ?action=parse&prop=sections if they shift)
const TRIBE_SECTIONS = [5, 6];
const VOTING_HISTORY_SECTION = 8;

// Strings that appear in Wikipedia tables but are not player names
const WIKI_NON_PLAYERS = new Set(["none", "vatu", "beria", "solana", "tiaka"]);

function isValidPlayerName(name: string): boolean {
  return !!name && name.length >= 2 && !WIKI_NON_PLAYERS.has(name.toLowerCase());
}

// Maps Wikipedia full names → app display names (players.ts)
const WIKI_NAME_MAP: Record<string, string> = {
  'Quintavius "Q" Burdette': "Q Burdette",
  "Quintavius Burdette": "Q Burdette",
  "Stephenie LaGrossa Kendrick": "Stephenie Lagrossa Kendrick",
  'Oscar "Ozzy" Lusth': "Ozzy Lusth",
  "Oscar Lusth": "Ozzy Lusth",
  'Dianelys "Dee" Valladares': "Dee Valladares",
  "Dianelys Valladares": "Dee Valladares",
};

function normalizeName(name: string): string {
  return WIKI_NAME_MAP[name] ?? name;
}

async function fetchSection(index: number): Promise<string> {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${WIKI_PAGE}&prop=text&format=json&section=${index}`,
    { headers: { "User-Agent": "SurvivorPredictionsApp/1.0" } }
  );
  if (!res.ok) throw new Error(`Wikipedia fetch failed for section ${index}: ${res.status}`);
  const json = await res.json();
  return json?.parse?.text?.["*"] ?? "";
}

export async function POST() {
  try {
    // 1. Authenticate & verify admin
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    // 2. Get current episode number
    const { data: epData } = await supabase
      .from("episodes")
      .select("episode_number")
      .order("episode_number", { ascending: false })
      .limit(1);

    const episodeNumber = epData?.[0]?.episode_number ?? 0;

    // 3. Fetch all sections in parallel
    const [tribeHtmlParts, votingHtml] = await Promise.all([
      Promise.all(TRIBE_SECTIONS.map(fetchSection)),
      fetchSection(VOTING_HISTORY_SECTION),
    ]);

    const tribeHtml = tribeHtmlParts.join("\n");

    // 4a. Parse tribe membership from sections 5 & 6
    type TribeRow = { tribe_name: string; tribe_color: string; player_name: string };
    const activeRows: TribeRow[] = [];

    const $t = cheerio.load(tribeHtml);
    console.log(`[tribes] raw HTML (first 1000 chars):\n${tribeHtml.slice(0, 1000)}`);

    $t("table.wikitable tbody tr").each((_, tr) => {
      const cells = $t(tr).find("th, td");
      if (cells.length < 2) return;

      // Player name: prefer .fn hCard microformat, fall back to first cell text
      const fnEl = $t(tr).find(".fn");
      const playerName = fnEl.length
        ? fnEl.first().text().trim()
        : cells.first().text().trim();

      if (!isValidPlayerName(playerName)) return;

      // Find tribe by looking for a colored cell with a text label
      let tribeColor = "#888888";
      let tribeName = "";

      cells.each((_, td) => {
        const bgColor = $t(td).attr("bgcolor");
        const tdStyle = $t(td).attr("style") ?? "";
        const bgColorFromStyle = tdStyle.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|[a-z]+)/i)?.[1];
        const color = bgColor ?? bgColorFromStyle;

        if (color && color !== "#ffffff" && color !== "white") {
          const text = $t(td).text().trim();
          if (text && !/^\d+$/.test(text) && text !== playerName) {
            tribeName = text;
            tribeColor = color.startsWith("#") ? color : `#${color}`;
          } else if (!tribeName) {
            tribeColor = color.startsWith("#") ? color : `#${color}`;
          }
        }
      });

      if (!tribeName) return;

      const normalizedName = normalizeName(playerName);
      console.log(`[tribes] active: "${normalizedName}" → tribe: "${tribeName}" (${tribeColor})`);
      activeRows.push({ tribe_name: tribeName, tribe_color: tribeColor, player_name: normalizedName });
    });

    // 4b. Parse voting history (section 8) for eliminated players in episode order
    const eliminatedRows: TribeRow[] = [];

    const $v = cheerio.load(votingHtml);
    console.log(`[voting] raw HTML (first 1000 chars):\n${votingHtml.slice(0, 1000)}`);

    $v("table.wikitable").each((_, table) => {
      $v(table).find("tr").each((_, row) => {
        const thText = $v(row).find("th").first().text().trim().toLowerCase();
        if (thText !== "eliminated") return;

        // Each td in this row = one episode column, left-to-right = episode order
        $v(row).find("td").each((_, cell) => {
          const text = $v(cell).text().trim();
          if (!text) return;
          // Multiple eliminations in one episode are separated by newlines or commas
          const players = text
            .split(/[\n,]+/)
            .map((s) => normalizeName(s.trim()))
            .filter(isValidPlayerName);
          players.forEach((name) => {
            console.log(`[voting] eliminated: "${name}"`);
            eliminatedRows.push({ tribe_name: "Eliminated", tribe_color: "#6b7280", player_name: name });
          });
        });
      });
    });

    console.log(`[summary] active: ${activeRows.length}, eliminated: ${eliminatedRows.length}`);

    if (activeRows.length === 0 && eliminatedRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No player/tribe data parsed from Wikipedia" },
        { status: 500 }
      );
    }

    // 5. Delete existing rows for this season+episode, then insert fresh
    // Active rows inserted first, then eliminated in episode order (first-eliminated first).
    // The id column preserves this order for the dashboard query.
    await supabase
      .from("tribe_states")
      .delete()
      .eq("season", SEASON)
      .eq("episode_number", episodeNumber);

    const insertRows = [...activeRows, ...eliminatedRows].map((r) => ({
      season: SEASON,
      episode_number: episodeNumber,
      tribe_name: r.tribe_name,
      tribe_color: r.tribe_color,
      player_name: r.player_name,
    }));

    const { error: insertErr } = await supabase.from("tribe_states").insert(insertRows);

    if (insertErr) {
      return NextResponse.json({ ok: false, error: insertErr.message }, { status: 500 });
    }

    const uniqueTribes = new Set(activeRows.map((r) => r.tribe_name)).size;

    return NextResponse.json({
      ok: true,
      tribesCount: uniqueTribes,
      playersCount: activeRows.length,
      eliminatedCount: eliminatedRows.length,
      episodeNumber,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
