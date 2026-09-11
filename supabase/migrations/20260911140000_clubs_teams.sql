-- Fondation multi-club : clubs, équipes (avec division), rattachement des
-- joueurs et des matchs à une équipe du club.
--
-- Phase A uniquement : organisation des données. La sécurité reste basée sur
-- created_by (RLS existante sur players/matches inchangée) car il n'y a pour
-- l'instant qu'un seul coach par club — le cloisonnement par équipe et les
-- invitations multi-coach viennent dans une migration ultérieure (Phase B/C).
--
-- À appliquer manuellement (SQL editor Supabase ou `npx supabase db push`).

-- ─── clubs ──────────────────────────────────────────────────────────────────

create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table clubs enable row level security;

create policy "clubs_select_own" on clubs
  for select using (owner_id = auth.uid());
create policy "clubs_insert_own" on clubs
  for insert with check (owner_id = auth.uid());
create policy "clubs_update_own" on clubs
  for update using (owner_id = auth.uid());
create policy "clubs_delete_own" on clubs
  for delete using (owner_id = auth.uid());

-- ─── teams : équipes du club (ex: "Équipe 1", "Équipe réserve"), avec division ─

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  division text,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;

create policy "teams_select_own_club" on teams
  for select using (club_id in (select id from clubs where owner_id = auth.uid()));
create policy "teams_insert_own_club" on teams
  for insert with check (club_id in (select id from clubs where owner_id = auth.uid()));
create policy "teams_update_own_club" on teams
  for update using (club_id in (select id from clubs where owner_id = auth.uid()));
create policy "teams_delete_own_club" on teams
  for delete using (club_id in (select id from clubs where owner_id = auth.uid()));

-- ─── club_members : appartenance au club (propriétaire pour l'instant, coachs invités en Phase C) ─

create table if not exists club_members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  role text not null check (role in ('OWNER', 'COACH')),
  invited_email text,
  status text not null default 'ACTIVE' check (status in ('PENDING', 'ACTIVE')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

alter table club_members enable row level security;

create policy "club_members_select_own_club" on club_members
  for select using (
    user_id = auth.uid()
    or club_id in (select id from clubs where owner_id = auth.uid())
  );
create policy "club_members_insert_owner" on club_members
  for insert with check (club_id in (select id from clubs where owner_id = auth.uid()));
create policy "club_members_update_owner" on club_members
  for update using (club_id in (select id from clubs where owner_id = auth.uid()));
create policy "club_members_delete_owner" on club_members
  for delete using (club_id in (select id from clubs where owner_id = auth.uid()));

-- ─── players / matches : rattachement club + équipe (organisationnel pour l'instant) ─

alter table players
  add column if not exists club_id uuid references clubs(id) on delete cascade,
  add column if not exists team_id uuid references teams(id) on delete set null;

alter table matches
  add column if not exists club_id uuid references clubs(id) on delete cascade,
  add column if not exists team_id uuid references teams(id) on delete set null;

-- ─── Backfill : crée un club + une équipe par défaut pour chaque coach ayant déjà des données ─

do $$
declare
  coach uuid;
  new_club_id uuid;
  new_team_id uuid;
begin
  for coach in
    select distinct created_by from players
    union
    select distinct created_by from matches
  loop
    insert into clubs (name, owner_id) values ('Mon club', coach) returning id into new_club_id;
    insert into teams (club_id, name) values (new_club_id, 'Équipe 1') returning id into new_team_id;
    insert into club_members (club_id, user_id, team_id, role, status)
      values (new_club_id, coach, null, 'OWNER', 'ACTIVE');

    update players set club_id = new_club_id, team_id = new_team_id
      where created_by = coach and club_id is null;
    update matches set club_id = new_club_id, team_id = new_team_id
      where created_by = coach and club_id is null;
  end loop;
end $$;
