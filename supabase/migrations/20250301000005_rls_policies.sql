-- Enable RLS on all tables
alter table profiles enable row level security;
alter table episodes enable row level security;
alter table questions enable row level security;
alter table predictions enable row level security;

-- PROFILES: users manage their own
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- EPISODES: public read, admin write
create policy "Anyone can read episodes"
  on episodes for select
  using (true);

create policy "Admins can manage episodes"
  on episodes for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- QUESTIONS: public read, admin write
create policy "Anyone can read questions"
  on questions for select
  using (true);

create policy "Admins can manage questions"
  on questions for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- PREDICTIONS: users manage own, admins read all
create policy "Users can insert own predictions"
  on predictions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own predictions"
  on predictions for update
  using (auth.uid() = user_id);

create policy "Users can read own predictions"
  on predictions for select
  using (auth.uid() = user_id);

create policy "Admins can read all predictions"
  on predictions for select
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));
