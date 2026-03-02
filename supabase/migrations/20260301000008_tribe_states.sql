CREATE TABLE tribe_states (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL,
  episode_number INT NOT NULL,
  tribe_name TEXT NOT NULL,
  tribe_color TEXT NOT NULL DEFAULT '#888888',
  player_name TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent upserts keyed on (season, episode_number, player_name)
ALTER TABLE tribe_states ADD CONSTRAINT tribe_states_unique
  UNIQUE (season, episode_number, player_name);

ALTER TABLE tribe_states ENABLE ROW LEVEL SECURITY;

-- Everyone reads
CREATE POLICY "Public can read tribe_states" ON tribe_states
  FOR SELECT USING (true);

-- Admins write
CREATE POLICY "Admins can manage tribe_states" ON tribe_states
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
