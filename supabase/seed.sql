-- Insert episodes
insert into episodes (episode_number, air_date) values
  (1, '2025-03-05'),
  (2, '2025-03-12');

-- Insert question for episode 2
insert into questions (episode_id, question_text, point_value, lock_time) values
  (2, 'Who is getting eliminated tonight?', 10, '2025-03-12 20:00:00+00');
