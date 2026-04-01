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

// Strings that appear in Wikipedia tables but are not player names or valid tribe names
const WIKI_NON_PLAYERS = new Set(["none", "vatu", "beria", "solana", "tiaka", "merged tribe"]);

function isValidPlayerName(name: string): boolean {
  return !!name && name.length >= 2 && !WIKI_NON_PLAYERS.has(name.toLowerCase());
}

// Maps Wikipedia full names → app display names (players.ts)
const WIKI_NAME_MAP: Record<string, string> = {
  'Quintavius "Q" Burdette': "Q Burdette",
  "Quintavius Burdette": "Q Burdette",
  "Stephenie LaGrossa Kendrick": "Stephanie Lagrossa Kendrick",
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

    // 4. Parse contestants table using a 2D grid that resolves rowspan/colspan
    type PlayerRow = {
      tribe_name: string;
      tribe_color: string;
      player_name: string;
      is_eliminated: boolean;
      day: number | null;
    };

    const playerRows: PlayerRow[] = [];
    const $t = cheerio.load(contestantsHtml);

    // --- Build a logical 2D grid resolving rowspan/colspan ---
    // This is necessary because cells like "Merged Tribe" (rowspan=17) and
    // "Shot in the Dark" (rowspan=N) cause subsequent rows to have fewer physical
    // cells, making naive physical-index access unreliable.
    type GridCell = { text: string; color: string };
    const tableRows = $t("table.wikitable tbody tr").toArray();
    const grid: (GridCell | null)[][] = [];

    for (let r = 0; r < tableRows.length; r++) {
      if (!grid[r]) grid[r] = [];
      const cells = $t(tableRows[r]).find("th, td").toArray();
      let cellIdx = 0;
      let c = 0;
      while (cellIdx < cells.length) {
        while (grid[r][c]) c++;
        const cell = cells[cellIdx];
        const rs = parseInt($t(cell).attr("rowspan") ?? "1");
        const cs = parseInt($t(cell).attr("colspan") ?? "1");
        const text = $t(cell).text().trim();
        const bg = ($t(cell).attr("bgcolor") ?? "").toLowerCase();
        const style = $t(cell).attr("style") ?? "";
        const bgMatch = style.match(/background(?:-color)?:\s*(#[0-9a-fA-F]{3,8})/i);
        const color = bgMatch?.[1] ?? (bg || "");

        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (!grid[r + dr]) grid[r + dr] = [];
            grid[r + dr][c + dc] = { text, color };
          }
        }
        cellIdx++;
        c++;
      }
    }

    // --- Detect tribe and day column indices from header row 0 ---
    // Logical columns: Contestant(0), Age(1), From(2), Original(3), Switched(4), Merged(5),
    //                  Placement(6), Day(7), SitD(8), Advantages(9)
    let tribeColStart = -1;
    let tribeColCount = 0;
    let dayColIdx = -1;

    const row0Cells = $t(tableRows[0]).find("th, td");
    let logicalIdx = 0;
    row0Cells.each((_, cell) => {
      const cs = parseInt($t(cell).attr("colspan") ?? "1");
      const rs = parseInt($t(cell).attr("rowspan") ?? "1");
      const text = $t(cell).text().trim().toLowerCase();

      if (text.includes("tribe")) {
        tribeColStart = logicalIdx;
        tribeColCount = cs;
      }
      if (text.includes("finish")) {
        dayColIdx = logicalIdx + cs - 1;
      }
      logicalIdx += rs >= 2 ? 1 : cs;
    });

    if (tribeColStart < 0 || dayColIdx < 0) {
      console.warn("[header] Could not detect column layout, using fallback");
      tribeColStart = 3;
      tribeColCount = 3;
      dayColIdx = 7;
    }

    console.log(`[header] tribeColStart=${tribeColStart} tribeColCount=${tribeColCount} dayColIdx=${dayColIdx}`);

    // --- Extract player data using logical grid positions ---
    // Check tribe columns right-to-left (Merged → Switched → Original)
    for (let r = 0; r < tableRows.length; r++) {
      const fnEl = $t(tableRows[r]).find(".fn");
      if (!fnEl.length) continue;
      const playerName = fnEl.first().text().trim();
      if (!isValidPlayerName(playerName)) continue;

      const row = grid[r];
      if (!row) continue;

      // Current tribe: rightmost non-empty, non-darkgray, non-label tribe column
      // Note: WIKI_NON_PLAYERS contains tribe names (vatu, kalo etc.) for player-name
      // filtering — do NOT use it here. Only skip generic labels like "Merged Tribe".
      let tribeName = "";
      let tribeColor = "#888888";
      for (let i = tribeColStart + tribeColCount - 1; i >= tribeColStart; i--) {
        const cell = row[i];
        if (!cell || !cell.text || cell.text.length < 2) continue;
        if (cell.color === "darkgray") continue;
        if (cell.text.toLowerCase().includes("tribe")) continue; // skip "Merged Tribe" etc.
        tribeName = cell.text;
        tribeColor = cell.color.startsWith("#") ? cell.color : "#888888";
        break;
      }
      if (!tribeName) continue;

      // Day column
      let isEliminated = false;
      let day: number | null = null;
      const dayCell = row[dayColIdx];
      if (dayCell) {
        const m = dayCell.text.match(/Day\s*(\d+)/i);
        if (m) {
          isEliminated = true;
          day = parseInt(m[1]);
        }
      }

      const normalizedName = normalizeName(playerName);
      console.log(`[row ${r}] "${normalizedName}" → tribe="${tribeName}" (${tribeColor}) eliminated=${isEliminated}${day ? ` day=${day}` : ""}`);
      playerRows.push({
        tribe_name: tribeName,
        tribe_color: tribeColor,
        player_name: normalizedName,
        is_eliminated: isEliminated,
        day,
      });
    }

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
