-- Fondation multi-club : clubs, équipes (avec division), rattachement des
-- joueurs et des matchs à une équipe du club.
--
-- Phase A uniquement : organisation des données. La sécurité reste basée sur
-- created_by (RLS existante sur players/matches inchangée) car il n'y a pour
-- l'instant qu'un seul coach par club — le cloisonnement par équipe et les
-- invitations multi-coach viennent dans une migration ultérieure (Phase B/C).
--
-- Ce script est conçu pour être rejouable sans risque (colonnes et policies
-- ajoutées défensivement) au cas où une première exécution aurait échoué en
-- cours de route et laissé des objets partiellement créés.
--
-- À appliquer manuellement (SQL editor Supabase ou `npx supabase db push`).

-- ─── clubs ──────────────────────────────────────────────────────────────────

create table if not exists clubs (
  id uuid primary key default gen_random_uuid()
);

alter table clubs add column if not exists name text not null;
alter table clubs add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table clubs alter column owner_id set not null;
alter table clubs add column if not exists created_at timestamptz not null default now();

alter table clubs enable row level security;

drop policy if exists "clubs_select_own" on clubs;
create policy "clubs_select_own" on clubs
  for select using (owner_id = auth.uid());
drop policy if exists "clubs_insert_own" on clubs;
create policy "clubs_insert_own" on clubs
  for insert with check (owner_id = auth.uid());
drop policy if exists "clubs_update_own" on clubs;
create policy "clubs_update_own" on clubs
  for update using (owner_id = auth.uid());
drop policy if exists "clubs_delete_own" on clubs;
create policy "clubs_delete_own" on clubs
  for delete using (owner_id = auth.uid());

-- ─── teams : équipes du club (ex: "Équipe 1", "Équipe réserve"), avec division ─

create table if not exists teams (
  id uuid primary key default gen_random_uuid()
);

alter table teams add column if not exists club_id uuid references clubs(id) on delete cascade;
alter table teams alter column club_id set not null;
alter table teams add column if not exists name text not null;
alter table teams add column if not exists division text;
alter table teams add column if not exists created_at timestamptz not null default now();

alter table teams enable row level security;

drop policy if exists "teams_select_own_club" on teams;
create policy "teams_select_own_club" on teams
  for select using (club_id in (select id from clubs where owner_id = auth.uid()));
drop policy if exists "teams_insert_own_club" on teams;
create policy "teams_insert_own_club" on teams
  for insert with check (club_id in (select id from clubs where owner_id = auth.uid()));
drop policy if exists "teams_update_own_club" on teams;
create policy "teams_update_own_club" on teams
  for update using (club_id in (select id from clubs where owner_id = auth.uid()));
drop policy if exists "teams_delete_own_club" on teams;
create policy "teams_delete_own_club" on teams
  for delete using (club_id in (select id from clubs where owner_id = auth.uid()));

-- ─── club_members : appartenance au club (propriétaire pour l'instant, coachs invités en Phase C) ─

create table if not exists club_members (
  id uuid primary key default gen_random_uuid()
);

alter table club_members add column if not exists club_id uuid references clubs(id) on delete cascade;
alter table club_members alter column club_id set not null;
alter table club_members add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table club_members add column if not exists team_id uuid references teams(id) on delete set null;
alter table club_members add column if not exists role text;
alter table club_members alter column role set not null;
alter table club_members add column if not exists invited_email text;
alter table club_members add column if not exists status text not null default 'ACTIVE';
alter table club_members add column if not exists invited_by uuid references auth.users(id);
alter table club_members add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'club_members_role_check') then
    alter table club_members add constraint club_members_role_check check (role in ('OWNER', 'COACH'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'club_members_status_check') then
    alter table club_members add constraint club_members_status_check check (status in ('PENDING', 'ACTIVE'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'club_members_club_id_user_id_key') then
    alter table club_members add constraint club_members_club_id_user_id_key unique (club_id, user_id);
  end if;
end $$;

alter table club_members enable row level security;

drop policy if exists "club_members_select_own_club" on club_members;
create policy "club_members_select_own_club" on club_members
  for select using (
    user_id = auth.uid()
    or club_id in (select id from clubs where owner_id = auth.uid())
  );
drop policy if exists "club_members_insert_owner" on club_members;
create policy "club_members_insert_owner" on club_members
  for insert with check (club_id in (select id from clubs where owner_id = auth.uid()));
drop policy if exists "club_members_update_owner" on club_members;
create policy "club_members_update_owner" on club_members
  for update using (club_id in (select id from clubs where owner_id = auth.uid()));
drop policy if exists "club_members_delete_owner" on club_members;
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
-- (ne crée rien si le coach a déjà un club, pour rester sans danger si ce script est rejoué)

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
    if not exists (select 1 from clubs where owner_id = coach) then
      insert into clubs (name, owner_id) values ('Mon club', coach) returning id into new_club_id;
      insert into teams (club_id, name) values (new_club_id, 'Équipe 1') returning id into new_team_id;
      insert into club_members (club_id, user_id, team_id, role, status)
        values (new_club_id, coach, null, 'OWNER', 'ACTIVE')
        on conflict (club_id, user_id) do nothing;
    else
      select id into new_club_id from clubs where owner_id = coach limit 1;
      select id into new_team_id from teams where club_id = new_club_id order by created_at asc limit 1;
    end if;

    update players set club_id = new_club_id, team_id = new_team_id
      where created_by = coach and club_id is null;
    update matches set club_id = new_club_id, team_id = new_team_id
      where created_by = coach and club_id is null;
  end loop;
end $$;
