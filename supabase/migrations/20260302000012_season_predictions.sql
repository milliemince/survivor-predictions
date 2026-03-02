CREATE TABLE season_predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  milestone TEXT NOT NULL,
  player_names TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, milestone)
);

ALTER TABLE season_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own season predictions"
  ON season_predictions FOR ALL
  USING (auth.uid() = user_id);
