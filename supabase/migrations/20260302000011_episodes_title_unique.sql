ALTER TABLE episodes
  ADD COLUMN title TEXT;

ALTER TABLE episodes
  ADD CONSTRAINT episodes_episode_number_unique UNIQUE (episode_number);
