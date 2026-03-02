Absolutely! Let’s put everything together in a **complete, structured TODO plan** that covers the database schema, MediaWiki API commands, parsing logic, and event tracking. I’ll make it detailed so you can implement it directly.

---

# 📝 Survivor Tribe Tracking – Full TODO List

---

## 1️⃣ Database Schema

Create tables to store **contestants, tribe states, and game events**.

### **Table: `contestants`**

```sql
CREATE TABLE contestants (
    id SERIAL PRIMARY KEY,
    season INT NOT NULL,
    player_name TEXT NOT NULL,
    original_tribe TEXT,
    status TEXT DEFAULT 'active'  -- 'active', 'voted_out', 'quit'
);
```

### **Table: `tribe_states`**

```sql
CREATE TABLE tribe_states (
    id SERIAL PRIMARY KEY,
    season INT NOT NULL,
    episode_number INT NOT NULL,
    tribe_name TEXT NOT NULL,
    player_name TEXT NOT NULL
);
```

### **Table: `game_events`**

```sql
CREATE TABLE game_events (
    id SERIAL PRIMARY KEY,
    season INT NOT NULL,
    episode_number INT NOT NULL,
    event_type TEXT NOT NULL,  -- 'swap', 'merge', 'vote_out'
    payload JSONB NOT NULL
);
```

---

## 2️⃣ MediaWiki API Commands

Use the **Wikipedia API** to fetch the Contestants and Season Summary tables.

### Fetch the raw wikitext for a section

```http
GET https://en.wikipedia.org/w/api.php
  ?action=parse
  &page=Survivor_Season_50
  &section=Contestants
  &format=json
```

* `section` can also target `Season Summary`
* You can fetch **HTML instead of wikitext** by adding `&prop=text`

### Optional: parse HTML tables

* Many prefer `cheerio` in Node.js:

```ts
const $ = cheerio.load(htmlString);
const rows = $("table.wikitable tbody tr");
```

---

## 3️⃣ Parsing Logic

### **Step 1 – Initial Contestants Table**

* Build **Episode 0 tribe map**:

```ts
const tribeMap: Record<string, string[]> = {};

rows.each((i, row) => {
  const cells = $(row).find("th, td");
  const player = $(cells[0]).find(".fn").text().trim();
  const tribe = $(cells[3]).text().trim();
  
  if (!tribeMap[tribe]) tribeMap[tribe] = [];
  tribeMap[tribe].push(player);
});
```

* Store in `tribe_states` for `episode_number = 0`.

---

### **Step 2 – Track Each Episode**

* Pull **updated Contestants table** after each episode.
* Build `currentTribeMap`.
* Compare with `previousTribeMap`.

---

### **Step 3 – Swap Detection**

```ts
for (const player in currentTribeMap) {
  const prevTribe = prevTribeMap[player];
  const newTribe = currentTribeMap[player];

  if (prevTribe && prevTribe !== newTribe) {
    await db.insert('game_events', {
      season,
      episode_number,
      event_type: 'swap',
      payload: { player, from: prevTribe, to: newTribe }
    });
  }
}
```

---

### **Step 4 – Merge Detection**

```ts
const prevTribes = Object.keys(prevTribeMap);
const currentTribes = Object.keys(currentTribeMap);

if (prevTribes.length > 1 && currentTribes.length === 1) {
  await db.insert('game_events', {
    season,
    episode_number,
    event_type: 'merge',
    payload: { tribe: currentTribes[0] }
  });
}
```

---

### **Step 5 – Update Tribe States**

* Insert all players’ current tribes for this episode:

```ts
for (const tribe in currentTribeMap) {
  for (const player of currentTribeMap[tribe]) {
    await db.upsert('tribe_states', {
      season,
      episode_number,
      tribe_name: tribe,
      player_name: player
    });
  }
}
```

---

### **Step 6 – Track Eliminations**

* Check Season Summary table for voted-out players.
* Insert vote-out events in `game_events`:

```ts
await db.insert('game_events', {
  season,
  episode_number,
  event_type: 'vote_out',
  payload: { player: votedOutPlayer }
});
```

---

## 4️⃣ Automation / Loop

1. Fetch Contestants section → build current tribe map
2. Compare with previous episode → detect swaps & merges → insert events
3. Fetch Season Summary → detect voted-out players → insert events
4. Insert `tribe_states` for this episode
5. Repeat for all episodes

💡 **Tip:** Make this idempotent: store last processed episode number per season to avoid reprocessing.

---

## 5️⃣ Optional Enhancements

* Store **tribe colors** from table for visual tracking.
* Build a **current state cache** for fast queries:

```ts
SELECT player_name, tribe_name
FROM tribe_states
WHERE season = 50
AND episode_number = (SELECT MAX(episode_number) FROM tribe_states WHERE season = 50);
```

* Add a **fantasy scoring engine** based on `game_events`.

---

