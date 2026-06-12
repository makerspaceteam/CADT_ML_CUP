-- ============================================
-- CADTML CUP 2026 - Supabase Database Schema
-- ============================================
-- Run this in Supabase SQL Editor

-- ---------- PROFILES ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique,
  full_name text,
  team_name text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- MATCHES ----------
create table if not exists matches (
  id bigint generated always as identity primary key,
  sportsdb_event_id text unique, -- TheSportsDB idEvent, used for API sync upserts
  stage text not null check (stage in ('group','round16','quarter','semi','third_place','final')),
  group_name text, -- e.g. 'A', 'B' ... null for knockout
  team_home text not null,
  team_away text not null,
  team_home_flag text, -- emoji or flag URL
  team_away_flag text,
  match_date timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming','live','finished')),
  actual_home_score int,
  actual_away_score int,
  actual_outcome text check (actual_outcome in ('home','away','draw')),
  google_form_url text,
  venue text,
  created_at timestamptz default now()
);

create index if not exists idx_matches_sportsdb on matches(sportsdb_event_id);

create index if not exists idx_matches_date on matches(match_date);
create index if not exists idx_matches_status on matches(status);

-- ---------- PREDICTIONS ----------
create table if not exists predictions (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  match_id bigint not null references matches(id) on delete cascade,
  predicted_home_score int,
  predicted_away_score int,
  predicted_outcome text check (predicted_outcome in ('home','away','draw')),
  confidence text check (confidence in ('low','medium','high')),
  points_earned int default 0,
  source text default 'manual' check (source in ('manual','csv_import')),
  created_at timestamptz default now(),
  unique(user_id, match_id)
);

create index if not exists idx_predictions_user on predictions(user_id);
create index if not exists idx_predictions_match on predictions(match_id);

-- ---------- SCORING FUNCTION ----------
-- Recalculates points for all predictions of a given match after result is entered
create or replace function calculate_match_points(p_match_id bigint)
returns void as $$
declare
  m record;
  pred record;
  pts int;
  pred_goal_diff int;
  actual_goal_diff int;
begin
  select * into m from matches where id = p_match_id;

  if m.actual_home_score is null or m.actual_away_score is null or m.actual_outcome is null then
    return; -- result not entered yet
  end if;

  actual_goal_diff := m.actual_home_score - m.actual_away_score;

  for pred in select * from predictions where match_id = p_match_id loop
    pts := 0;

    -- 3 points: correct outcome (win/loss/draw)
    if pred.predicted_outcome = m.actual_outcome then
      pts := pts + 3;

      -- 2 points: correct goal difference (only counted if outcome correct)
      if pred.predicted_home_score is not null and pred.predicted_away_score is not null then
        pred_goal_diff := pred.predicted_home_score - pred.predicted_away_score;
        if pred_goal_diff = actual_goal_diff then
          pts := pts + 2;
        end if;
      end if;
    end if;

    -- 5 bonus points: exact final score
    if pred.predicted_home_score = m.actual_home_score
       and pred.predicted_away_score = m.actual_away_score then
      pts := pts + 5;
    end if;

    -- 2 bonus points: correct high-confidence prediction
    if pred.confidence = 'high' and pred.predicted_outcome = m.actual_outcome then
      pts := pts + 2;
    end if;

    update predictions set points_earned = pts where id = pred.id;
  end loop;
end;
$$ language plpgsql security definer;

-- ---------- LEADERBOARD VIEW ----------
create or replace view leaderboard as
select
  p.id as user_id,
  p.username,
  p.full_name,
  p.team_name,
  coalesce(sum(pr.points_earned), 0) as total_points,
  count(pr.id) as predictions_made,
  count(pr.id) filter (where pr.points_earned >= 3) as correct_outcomes
from profiles p
left join predictions pr on pr.user_id = p.id
group by p.id, p.username, p.full_name, p.team_name
order by total_points desc, correct_outcomes desc;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table profiles enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;

-- PROFILES policies
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- MATCHES policies (everyone can read; only admins write)
create policy "Matches are viewable by everyone"
  on matches for select using (true);

create policy "Admins can insert matches"
  on matches for insert with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update matches"
  on matches for update using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can delete matches"
  on matches for delete using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- PREDICTIONS policies
create policy "Predictions viewable by everyone"
  on predictions for select using (true);

create policy "Users can insert own predictions"
  on predictions for insert with check (auth.uid() = user_id);

create policy "Users can update own predictions"
  on predictions for update using (auth.uid() = user_id);

create policy "Admins can insert any prediction"
  on predictions for insert with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can update any prediction"
  on predictions for update using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

create policy "Admins can delete predictions"
  on predictions for delete using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================
-- MIGRATION (if you already ran this schema before adding API sync):
-- ALTER TABLE matches ADD COLUMN IF NOT EXISTS sportsdb_event_id text UNIQUE;
-- CREATE INDEX IF NOT EXISTS idx_matches_sportsdb ON matches(sportsdb_event_id);
-- ============================================

-- ============================================
-- NOTES:
-- 1. To make a user admin, run:
--    update profiles set is_admin = true where username = 'your_username';
-- 2. After entering match results in admin panel, call:
--    select calculate_match_points(<match_id>);
--    (the admin JS will call this automatically via RPC)
-- ============================================
