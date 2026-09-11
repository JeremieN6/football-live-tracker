-- Les policies RLS de clubs/teams/club_members se sont retrouvées absentes en
-- prod (vérifié : `select * from pg_policies where tablename = 'teams'` ne
-- renvoyait aucune ligne), bloquant toute écriture cliente sur ces tables
-- malgré des droits légitimes. Cette migration les recrée explicitement,
-- sans dépendre de l'historique des migrations précédentes.
--
-- Rejouable sans danger (drop policy if exists + create policy).

-- ─── clubs ──────────────────────────────────────────────────────────────────

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

-- ─── teams ──────────────────────────────────────────────────────────────────

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

-- ─── club_members ───────────────────────────────────────────────────────────

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

-- ─── Vérification : doit renvoyer 4 lignes pour chacune des 3 tables ──────────
select tablename, count(*) as policy_count
from pg_policies
where tablename in ('clubs', 'teams', 'club_members')
group by tablename;
