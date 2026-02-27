# Plan: Supabase Tasks + Local Testing Setup

## Context

This is a greenfield Survivor-themed predictions web app (Next.js + Supabase). Only a `TODO.txt` exists — nothing has been scaffolded yet. This plan covers all 6 Supabase tasks from the TODO and sets up a **local Supabase dev environment** using the Supabase CLI + Docker so everything can be tested before touching the cloud project.

---

## Prerequisites

These must happen before any Supabase work:

1. **Scaffold Next.js app** (in `/Users/milliemince/Development/survivor_predictions_web_app/`):
   ```bash
   npx create-next-app@latest . --typescript --tailwind --app --src-dir=false
   ```
2. **Install dependencies**:
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```
3. **Install Supabase CLI** (if not already installed):
   ```bash
   brew install supabase/tap/supabase
   ```
4. **Ensure Docker Desktop is running** (required for local Supabase)

---

## Task 1: Local Dev Setup (replaces cloud "Project Setup")

Instead of creating a cloud Supabase project first, set up local dev to test everything before deploying.

```bash
supabase init          # creates supabase/ folder in project root
supabase start         # spins up local Postgres, Auth, Studio, Storage
```

After `supabase start`, you get:
- **Studio**: `http://localhost:54323`
- **API URL**: `http://localhost:54321`
- **anon key** and **service_role key** printed in terminal

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<local service role key>
```

Email confirmation is auto-disabled locally. No site URL needed for local.

---

## Task 2: Database Schema (SQL Migrations)

Create migration files under `supabase/migrations/`. Use `supabase migration new <name>` to generate timestamped files, then fill in the SQL.

### Migration 1: `create_profiles`
```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  is_admin boolean default false,
  created_at timestamp with time zone default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, username)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

### Migration 2: `create_episodes`
```sql
create table episodes (
  id serial primary key,
  episode_number int not null,
  air_date date,
  created_at timestamp with time zone default now()
);
```

### Migration 3: `create_questions`
```sql
create table questions (
  id serial primary key,
  episode_id int references episodes(id) on delete cascade,
  question_text text not null,
  point_value int not null,
  correct_answer text,
  lock_time timestamp with time zone,
  created_at timestamp with time zone default now()
);
```

### Migration 4: `create_predictions`
```sql
create table predictions (
  id serial primary key,
  user_id uuid references profiles(id) on delete cascade,
  question_id int references questions(id) on delete cascade,
  predicted_answer text not null,
  points_awarded int default 0,
  created_at timestamp with time zone default now(),
  unique(user_id, question_id)
);
```

---

## Task 3: Row-Level Security

Add to a single migration or inline with each table. Enable RLS and write policies.

```sql
-- Enable RLS on all tables
alter table profiles enable row level security;
alter table episodes enable row level security;
alter table questions enable row level security;
alter table predictions enable row level security;

-- PROFILES: users manage their own
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- EPISODES: public read, admin write
create policy "Anyone can read episodes" on episodes for select using (true);
create policy "Admins can manage episodes" on episodes for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- QUESTIONS: public read, admin write
create policy "Anyone can read questions" on questions for select using (true);
create policy "Admins can manage questions" on questions for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- PREDICTIONS: users manage own, admins read all
create policy "Users can insert own predictions" on predictions for insert
  with check (auth.uid() = user_id);
create policy "Users can update own predictions" on predictions for update
  using (auth.uid() = user_id);
create policy "Users can read own predictions" on predictions for select
  using (auth.uid() = user_id);
create policy "Admins can read all predictions" on predictions for select
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));
```

---

## Task 4: Leaderboard View

```sql
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
```

---

## Task 5: Scoring Logic (Option B — SQL function)

```sql
create or replace function score_question(question_id_input int)
returns void language plpgsql security definer as $$
declare
  correct text;
begin
  select correct_answer into correct from questions where id = question_id_input;

  update predictions
  set points_awarded = (
    select point_value from questions where id = question_id_input
  )
  where question_id = question_id_input
    and lower(trim(predicted_answer)) = lower(trim(correct));

  -- Zero out wrong answers
  update predictions
  set points_awarded = 0
  where question_id = question_id_input
    and lower(trim(predicted_answer)) != lower(trim(correct));
end;
$$;
```

---

## Task 6: Admin Utilities + Seed Script

Create `supabase/seed.sql`:
```sql
-- Insert test episodes
insert into episodes (episode_number, air_date) values
  (1, '2025-03-05'),
  (2, '2025-03-12');

-- Insert sample questions for episode 1
insert into questions (episode_id, question_text, point_value, lock_time) values
  (1, 'Who will be voted out first?', 10, '2025-03-05 20:00:00+00'),
  (1, 'Which tribe wins immunity?', 5, '2025-03-05 20:00:00+00');
```

To make yourself admin — after signing up locally, run in Supabase Studio SQL editor:
```sql
update profiles set is_admin = true where username = 'your@email.com';
```

---

## Apply Migrations Locally

```bash
supabase db reset   # drops and recreates local DB, runs all migrations + seed.sql
```

---

## Supabase Client Setup (Next.js)

**`lib/supabaseClient.ts`** (browser):
```ts
import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

**`lib/supabaseServer.ts`** (server components / API routes):
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: ... } }
  )
}
```

---

## Critical Files to Create/Modify

| File | Purpose |
|------|---------|
| `supabase/migrations/*_create_profiles.sql` | Profiles table + trigger |
| `supabase/migrations/*_create_episodes.sql` | Episodes table |
| `supabase/migrations/*_create_questions.sql` | Questions table |
| `supabase/migrations/*_create_predictions.sql` | Predictions table |
| `supabase/migrations/*_rls_policies.sql` | All RLS policies |
| `supabase/migrations/*_leaderboard_view.sql` | Leaderboard view |
| `supabase/migrations/*_scoring_function.sql` | `score_question()` function |
| `supabase/seed.sql` | Test data |
| `.env.local` | Local Supabase credentials |
| `lib/supabaseClient.ts` | Browser Supabase client |
| `lib/supabaseServer.ts` | Server Supabase client |

---

## Local Testing Workflow

### Test 1: Schema & Seed
```bash
supabase db reset
# Then visit http://localhost:54323 → Table Editor → verify all tables and data exist
```

### Test 2: Auth + Profile Trigger
1. In Supabase Studio → Auth → Users → "Invite User" or use the API
2. Confirm a row appears in `profiles` table automatically

### Test 3: RLS Policies
Use the **Supabase SQL Editor** at Studio with `set role authenticated; set local "request.jwt.claim.sub" = '<user-uuid>';` to simulate a logged-in user and verify policy restrictions.

### Test 4: Leaderboard View
```sql
select * from leaderboard;
```

### Test 5: Scoring Function
```sql
-- Set a correct answer
update questions set correct_answer = 'Jeff Probst' where id = 1;
-- Insert a test prediction manually
insert into predictions (user_id, question_id, predicted_answer) values ('<uuid>', 1, 'Jeff Probst');
-- Score it
select score_question(1);
-- Verify
select * from predictions where question_id = 1;
```

### Test 6: End-to-end via App
```bash
npm run dev   # Next.js at http://localhost:3000
```
Sign up → check profile created → make predictions → verify in Studio.

---

## Cloud Deployment (after local testing passes)

1. Create Supabase cloud project → save URL + keys
2. `supabase link --project-ref <your-project-ref>`
3. `supabase db push` — pushes all local migrations to cloud
4. Update `.env.local` (and Vercel env vars) with cloud credentials
5. Set site URL in Supabase Auth settings to production URL
