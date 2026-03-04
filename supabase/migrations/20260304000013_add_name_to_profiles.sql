-- Add display name column to profiles
alter table profiles add column name text;

-- Update trigger to populate name from user metadata on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, username, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email)
  );
  return new;
end;
$$;

-- Update leaderboard view to expose name instead of username
drop view if exists leaderboard;
create view leaderboard as
select
  p.id as user_id,
  coalesce(p.name, p.username) as name,
  coalesce(sum(pr.points_awarded), 0) as total_points,
  rank() over (order by coalesce(sum(pr.points_awarded), 0) desc) as rank
from profiles p
left join predictions pr on pr.user_id = p.id
group by p.id, p.name, p.username
order by total_points desc;

grant select on leaderboard to authenticated;

-- Helper function to check admin status without triggering recursive RLS
create or replace function is_admin()
returns boolean
language sql security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- Allow admins to read all profiles (for admin predictions tab)
create policy "Admins can read all profiles"
  on profiles for select
  using (is_admin());

-- Allow admins to read all season predictions
create policy "Admins can read all season predictions"
  on season_predictions for select
  using (is_admin());
