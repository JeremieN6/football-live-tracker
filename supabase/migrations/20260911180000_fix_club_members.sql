-- Diagnostic confirmé : la table `club_members` n'existe pas du tout en prod
-- (clubs et teams existent, mais la migration 140000 s'est arrêtée avant
-- d'aller jusqu'au bout — club_members + une partie des policies n'ont
-- jamais été créées). Cette migration reconstruit tout ce qui manque de
-- façon autonome, sans dépendre du résultat des migrations précédentes.
--
-- Rejouable sans danger.

-- ─── club_members ───────────────────────────────────────────────────────────

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

-- ─── Policies : clubs, teams, club_members (recréées intégralement) ───────────

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

-- ─── Backfill : ligne OWNER manquante pour chaque club existant ───────────────

insert into club_members (club_id, user_id, role, status)
select c.id, c.owner_id, 'OWNER', 'ACTIVE'
from clubs c
where not exists (
  select 1 from club_members m where m.club_id = c.id and m.user_id = c.owner_id
)
on conflict (club_id, user_id) do nothing;

-- ─── Vérification : doit renvoyer 4 policies pour chacune des 3 tables ────────

select tablename, count(*) as policy_count
from pg_policies
where tablename in ('clubs', 'teams', 'club_members')
group by tablename;
