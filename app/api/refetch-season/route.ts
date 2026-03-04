import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { createClient } from "@/lib/supabaseServer";

const WIKI_PAGE = "Survivor_50:_In_the_Hands_of_the_Fans";

/** Returns the UTC ISO string for 8 PM Eastern Time on the given air date. */
function etAirTimeToUTC(airDate: string): string {
  const year = parseInt(airDate.slice(0, 4));
  const month = parseInt(airDate.slice(5, 7));
  const day = parseInt(airDate.slice(8, 10));
  const approxUTC = new Date(Date.UTC(year, month - 1, day, 20, 0));
  const etHour =
    parseInt(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        hour12: false,
      }).format(approxUTC)
    ) % 24;
  const offsetHours = (20 - etHour + 24) % 24;
  return new Date(Date.UTC(year, month - 1, day, 20 + offsetHours, 0)).toISOString();
}
const SEASON = 50;
const CONTESTANTS_SECTION = 5;
const SEASON_SUMMARY_SECTION = 6;

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

/** Parse "February 25, 2026" → "2026-02-25" */
function parseWikiDate(text: string): string | null {
  const MONTHS: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04",
    May: "05", June: "06", July: "07", August: "08",
    September: "09", October: "10", November: "11", December: "12",
  };
  const m = text.trim().match(/^(\w+)\s+(\d+),\s+(\d{4})$/);
  if (!m) return null;
  const [, month, day, year] = m;
  const mm = MONTHS[month];
  if (!mm) return null;
  return `${year}-${mm}-${day.padStart(2, "0")}`;
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

    // 3. Fetch both sections in parallel
    const [contestantsHtml, seasonHtml] = await Promise.all([
      fetchSection(CONTESTANTS_SECTION),
      fetchSection(SEASON_SUMMARY_SECTION),
    ]);

    // 4. Parse section 5 (contestants) — column-index approach
    type PlayerRow = {
      tribe_name: string;
      tribe_color: string;
      player_name: string;
      is_eliminated: boolean;
      day: number | null;
    };

    const playerRows: PlayerRow[] = [];
    const $t = cheerio.load(contestantsHtml);

    $t("table.wikitable tbody tr").each((rowIdx, tr) => {
      const cells = $t(tr).find("th, td");

      // Log every row's cell count and first cell text to understand table structure
      const firstCellText = cells.first().text().trim().slice(0, 40);
      console.log(`[row ${rowIdx}] cells=${cells.length} firstCell="${firstCellText}"`);

      if (cells.length < 4) {
        console.log(`[row ${rowIdx}] SKIP: too few cells (${cells.length})`);
        return;
      }

      // Skip header rows (first cell is a <th> with no .fn inside)
      const firstCell = cells.first();
      if (firstCell.is("th") && $t(tr).find(".fn").length === 0) {
        console.log(`[row ${rowIdx}] SKIP: header row`);
        return;
      }

      // Player name: prefer .fn hCard microformat
      const fnEl = $t(tr).find(".fn");
      if (!fnEl.length) {
        console.log(`[row ${rowIdx}] SKIP: no .fn element`);
        return;
      }
      const playerName = fnEl.first().text().trim();
      if (!isValidPlayerName(playerName)) {
        console.log(`[row ${rowIdx}] SKIP: invalid player name "${playerName}"`);
        return;
      }

      // Log all cell texts to find the right column indices
      const allCells = Array.from({ length: cells.length }, (_, i) =>
        `[${i}]="${cells.eq(i).text().trim().slice(0, 20)}"`
      ).join(" ");
      console.log(`[row ${rowIdx}] player="${playerName}" cells: ${allCells}`);

      // Original tribe: column index 3 (0-based)
      const tribeCell = cells.eq(3);
      const tribeName = tribeCell.text().trim();
      const tdStyle = tribeCell.attr("style") ?? "";
      const bgMatch = tdStyle.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|[a-z]+)/i);
      const tribeColor = bgMatch?.[1]
        ? bgMatch[1].startsWith("#") ? bgMatch[1] : `#${bgMatch[1]}`
        : "#888888";

      console.log(`[row ${rowIdx}] tribe col[3]: name="${tribeName}" style="${tdStyle}" color="${tribeColor}"`);

      if (tribeName.length < 2) {
        console.log(`[row ${rowIdx}] SKIP: empty/short tribe name "${tribeName}"`);
        return;
      }

      // Finish column: index 6 — "Day N" means eliminated
      const finishCell = cells.eq(6);
      const finishText = finishCell.text().trim();
      const dayMatch = finishText.match(/Day\s*(\d+)/i);
      const isEliminated = !!dayMatch;
      const day = dayMatch ? parseInt(dayMatch[1]) : null;

      console.log(`[row ${rowIdx}] finish col[6]: "${finishText}" → isEliminated=${isEliminated} day=${day}`);

      const normalizedName = normalizeName(playerName);
      console.log(`[row ${rowIdx}] PARSED: "${normalizedName}" → tribe="${tribeName}" eliminated=${isEliminated}`);
      playerRows.push({
        tribe_name: tribeName,
        tribe_color: tribeColor,
        player_name: normalizedName,
        is_eliminated: isEliminated,
        day,
      });
    });

    const tribeBreakdown = playerRows.reduce<Record<string, { active: number; eliminated: number }>>((acc, r) => {
      if (!acc[r.tribe_name]) acc[r.tribe_name] = { active: 0, eliminated: 0 };
      if (r.is_eliminated) acc[r.tribe_name].eliminated++;
      else acc[r.tribe_name].active++;
      return acc;
    }, {});
    console.log(`[contestants] parsed ${playerRows.length} rows across ${Object.keys(tribeBreakdown).length} tribes:`);
    for (const [tribe, counts] of Object.entries(tribeBreakdown)) {
      console.log(`  tribe "${tribe}": ${counts.active} active, ${counts.eliminated} eliminated`);
    }

    if (playerRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No player/tribe data parsed from Wikipedia contestants section" },
        { status: 500 }
      );
    }

    // Sort: active first (day=null), then eliminated sorted by day ascending
    const activeRows = playerRows.filter((r) => !r.is_eliminated);
    const eliminatedRows = [...playerRows.filter((r) => r.is_eliminated)].sort(
      (a, b) => (a.day ?? 0) - (b.day ?? 0)
    );

    // 5. Parse section 6 (season summary) for episode upserts
    type EpisodeRow = { number: number; title: string | null; airDate: string | null };
    const parsedEpisodes: EpisodeRow[] = [];

    const $s = cheerio.load(seasonHtml);
    $s("table.wikitable tr").each((_, tr) => {
      const ths = $s(tr).find("th");
      const tds = $s(tr).find("td");
      if (ths.length === 0 || tds.length === 0) return;

      const epNumText = ths.first().text().trim();
      const epNum = parseInt(epNumText);
      if (isNaN(epNum)) return;

      // Title is in quotes in first td; air date in second td
      const rawTitle = tds.eq(0).text().trim().replace(/^[""]|[""]$/g, "").trim();
      const title = rawTitle || null;
      const airDateText = tds.eq(1).text().trim();
      const airDate = parseWikiDate(airDateText);

      parsedEpisodes.push({ number: epNum, title, airDate });
    });

    console.log(`[season summary] parsed ${parsedEpisodes.length} episodes`);

    // 6. Upsert episodes from season summary
    let episodesUpserted = 0;
    if (parsedEpisodes.length > 0) {
      const { error: epErr } = await supabase.from("episodes").upsert(
        parsedEpisodes.map((ep) => ({
          episode_number: ep.number,
          title: ep.title,
          air_date: ep.airDate,
        })),
        { onConflict: "episode_number" }
      );
      if (epErr) {
        console.error("[episodes upsert error]", epErr.message);
      } else {
        episodesUpserted = parsedEpisodes.length;
      }

      // Auto-set lock_time on questions for future episodes (8 PM ET = T20:00:00)
      const todayStr = new Date().toISOString().split("T")[0];
      const futureEps = parsedEpisodes.filter((e) => e.airDate && e.airDate >= todayStr);
      if (futureEps.length > 0) {
        const { data: futureEpRows } = await supabase
          .from("episodes")
          .select("id, episode_number")
          .in("episode_number", futureEps.map((e) => e.number));

        if (futureEpRows?.length) {
          await Promise.all(
            futureEpRows.map((epRow) => {
              const ep = futureEps.find((e) => e.number === epRow.episode_number);
              if (!ep?.airDate) return Promise.resolve();
              return supabase
                .from("questions")
                .update({ lock_time: etAirTimeToUTC(ep.airDate) })
                .eq("episode_id", epRow.id);
            })
          );
          console.log(`[lock times] updated questions for ${futureEpRows.length} future episodes`);
        }
      }
    }

    // 7. Delete existing tribe_states for season+episode, then insert fresh
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
      is_eliminated: r.is_eliminated,
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
      episodesUpserted,
      episodeNumber,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
