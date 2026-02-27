create table questions (
  id serial primary key,
  episode_id int references episodes(id) on delete cascade,
  question_text text not null,
  point_value int not null,
  correct_answer text,
  lock_time timestamp with time zone,
  created_at timestamp with time zone default now()
);
