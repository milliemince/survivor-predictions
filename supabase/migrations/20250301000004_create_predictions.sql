create table predictions (
  id serial primary key,
  user_id uuid references profiles(id) on delete cascade,
  question_id int references questions(id) on delete cascade,
  predicted_answer text not null,
  points_awarded int default 0,
  created_at timestamp with time zone default now(),
  unique(user_id, question_id)
);
