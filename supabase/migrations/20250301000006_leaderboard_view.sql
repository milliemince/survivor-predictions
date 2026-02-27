create or replace view leaderboard as
select
  p.id as user_id,
  p.username,
  coalesce(sum(pr.points_awarded), 0) as total_points,
  rank() over (order by coalesce(sum(pr.points_awarded), 0) desc) as rank
from profiles p
left join predictions pr on pr.user_id = p.id
group by p.id, p.username
order by total_points desc;

-- Grant read access to authenticated users
grant select on leaderboard to authenticated;
