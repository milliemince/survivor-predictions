-- Add points_awarded column to season_predictions (already exists in production, syncing local schema)
alter table season_predictions add column if not exists points_awarded int default 0;

-- Update leaderboard view to include episode and season scores
drop view if exists leaderboard;
create view leaderboard as
select
  p.id as user_id,
  coalesce(p.name, p.username) as name,
  coalesce(sum(pr.points_awarded), 0)::int as episode_points,
  coalesce(sp_agg.season_points, 0)::int as season_points,
  (coalesce(sum(pr.points_awarded), 0) + coalesce(sp_agg.season_points, 0))::int as total_points,
  rank() over (
    order by (coalesce(sum(pr.points_awarded), 0) + coalesce(sp_agg.season_points, 0)) desc
  )::int as rank
from profiles p
left join predictions pr on pr.user_id = p.id
left join (
  select user_id, sum(points_awarded) as season_points
  from season_predictions
  group by user_id
) sp_agg on sp_agg.user_id = p.id
group by p.id, p.name, p.username, sp_agg.season_points
order by total_points desc;

grant select on leaderboard to authenticated;
