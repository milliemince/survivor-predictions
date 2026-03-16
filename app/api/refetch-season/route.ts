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

/** Look up current section indices by name (they shift when Wikipedia editors add sections). */
async function fetchSectionIndices(): Promise<{ contestants: number; seasonSummary: number }> {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=parse&page=${WIKI_PAGE}&prop=sections&format=json`,
    { headers: { "User-Agent": "SurvivorPredictionsApp/1.0" } }
  );
  if (!res.ok) throw new Error(`Wikipedia sections fetch failed: ${res.status}`);
  const json = await res.json();
  const sections: { line: string; index: string }[] = json?.parse?.sections ?? [];

  let contestants = -1;
  let seasonSummary = -1;
  for (const s of sections) {
    const name = s.line.toLowerCase().replace(/&amp;/g, "&");
    if (name === "contestants") contestants = parseInt(s.index);
    else if (name === "season summary") seasonSummary = parseInt(s.index);
  }
  if (contestants < 0) throw new Error("Could not find 'Contestants' section on Wikipedia page");
  if (seasonSummary < 0) throw new Error("Could not find 'Season summary' section on Wikipedia page");
  return { contestants, seasonSummary };
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

    // 3. Look up section indices dynamically, then fetch both in parallel
    const sectionIdx = await fetchSectionIndices();
    const [contestantsHtml, seasonHtml] = await Promise.all([
      fetchSection(sectionIdx.contestants),
      fetchSection(sectionIdx.seasonSummary),
    ]);

    // 4. Parse contestants table — detect column layout from headers dynamically
    type PlayerRow = {
      tribe_name: string;
      tribe_color: string;
      player_name: string;
      is_eliminated: boolean;
      day: number | null;
    };

    const playerRows: PlayerRow[] = [];
    const $t = cheerio.load(contestantsHtml);

    // --- Detect column layout from the two header rows ---
    // Header row 0 uses colspan to group columns (e.g. "Tribe" cs=3, "Finish" cs=2).
    // Header row 1 has the sub-headers (e.g. "Original", "Switched", "Merged", "Placement", "Day").
    // We build a flat column map so data rows can be indexed correctly regardless of
    // how many tribe sub-columns Wikipedia currently has.
    const headerRows = $t("table.wikitable tbody tr").filter((_, tr) => {
      const firstCell = $t(tr).find("th, td").first();
      return firstCell.is("th") && $t(tr).find(".fn").length === 0;
    });

    // Build logical-column-index → name map from sub-header row (row 1)
    // We need to know: which indices are tribe columns, and which is "Day".
    // Logical column indices for data rows account for rowspan=2 headers occupying
    // both header rows — the sub-header row only lists columns whose parent had colspan.
    let tribeColStart = -1;
    let tribeColCount = 0;
    let dayColIdx = -1;
    let totalLogicalCols = 0;

    if (headerRows.length >= 2) {
      // From header row 0, find "Tribe" colspan and "Finish" colspan
      const row0Cells = $t(headerRows[0]).find("th, td");
      let logicalIdx = 0;
      row0Cells.each((_, cell) => {
        const cs = parseInt($t(cell).attr("colspan") ?? "1");
        const rs = parseInt($t(cell).attr("rowspan") ?? "1");
        const text = $t(cell).text().trim().toLowerCase();

        if (text.includes("tribe")) {
          tribeColStart = logicalIdx;
          tribeColCount = cs;
        }
        // "Finish" group contains "Placement" and "Day" sub-columns
        if (text.includes("finish")) {
          // "Day" is the last sub-column of Finish
          dayColIdx = logicalIdx + cs - 1;
        }
        logicalIdx += (rs >= 2 ? 1 : cs); // rowspan=2 headers take 1 logical slot
        totalLogicalCols = logicalIdx;
      });
      // Add remaining from sub-header if needed
      const row1Cells = $t(headerRows[1]).find("th, td");
      // The sub-header row only covers columns whose parent had colspan (no rowspan=2)
      // Verify by counting
      let subCount = 0;
      row1Cells.each(() => { subCount++; });
      console.log(`[header] tribeColStart=${tribeColStart} tribeColCount=${tribeColCount} dayColIdx=${dayColIdx} subHeaders=${subCount}`);
    }

    if (tribeColStart < 0 || dayColIdx < 0) {
      // Fallback: assume original layout (3 tribe cols starting at index 3, day at last tribe + 2)
      console.warn("[header] Could not detect column layout from headers, using fallback");
      tribeColStart = 3;
      tribeColCount = 2;
      dayColIdx = 6;
    }

    // For each data row, figure out which physical cell index corresponds to each
    // logical column. Rows may have fewer physical cells due to rowspan from prior rows.
    // Strategy: tribe columns start at physical index = tribeColStart (always present in data rows
    // since the first 3 columns — Contestant, Age, From — never use rowspan).
    // However cells AFTER the tribe group may shift due to rowspan on non-tribe columns
    // (e.g. "Shot in the Dark" uses rowspan). We search right-to-left from end of row for "Day N".

    $t("table.wikitable tbody tr").each((rowIdx, tr) => {
      const cells = $t(tr).find("th, td");
      if (cells.length < 4) return;

      // Skip header rows
      const firstCell = cells.first();
      if (firstCell.is("th") && $t(tr).find(".fn").length === 0) return;

      // Player name
      const fnEl = $t(tr).find(".fn");
      if (!fnEl.length) return;
      const playerName = fnEl.first().text().trim();
      if (!isValidPlayerName(playerName)) return;

      // Current tribe: use the rightmost non-empty tribe column (Merged > Switched > Original).
      // Tribe columns are at physical indices tribeColStart .. tribeColStart + tribeColCount - 1.
      let tribeName = "";
      let tribeColor = "#888888";
      for (let i = tribeColStart + tribeColCount - 1; i >= tribeColStart; i--) {
        const cell = cells.eq(i);
        const text = cell.text().trim();
        const bg = cell.attr("bgcolor") ?? "";
        // Skip empty cells and darkgray placeholders (used for eliminated-before-swap)
        if (!text || text.length < 2 || bg.toLowerCase() === "darkgray") continue;
        tribeName = text;
        const style = cell.attr("style") ?? "";
        const bgMatch = style.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8}|[a-z]+)/i);
        tribeColor = bgMatch?.[1]
          ? bgMatch[1].startsWith("#") ? bgMatch[1] : `#${bgMatch[1]}`
          : "#888888";
        break;
      }
      if (!tribeName || tribeName.length < 2) return;

      // Day: find "Day N" by scanning cells from the right (robust against rowspan shifts)
      let isEliminated = false;
      let day: number | null = null;
      for (let i = cells.length - 1; i > tribeColStart + tribeColCount; i--) {
        const text = cells.eq(i).text().trim();
        const m = text.match(/^Day\s*(\d+)$/i);
        if (m) {
          isEliminated = true;
          day = parseInt(m[1]);
          break;
        }
      }

      const normalizedName = normalizeName(playerName);
      console.log(`[row ${rowIdx}] "${normalizedName}" → tribe="${tribeName}" (${tribeColor}) eliminated=${isEliminated}${day ? ` day=${day}` : ""}`);
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
