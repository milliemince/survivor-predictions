create table episodes (
  id serial primary key,
  episode_number int not null,
  air_date date,
  created_at timestamp with time zone default now()
);
