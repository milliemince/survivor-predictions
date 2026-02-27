-- Insert test episodes
insert into episodes (episode_number, air_date) values
  (1, '2025-03-05'),
  (2, '2025-03-12');

-- Insert sample questions for episode 1
insert into questions (episode_id, question_text, point_value, lock_time) values
  (1, 'Who will be voted out first?', 10, '2025-03-05 20:00:00+00'),
  (1, 'Which tribe wins immunity?', 5, '2025-03-05 20:00:00+00');
