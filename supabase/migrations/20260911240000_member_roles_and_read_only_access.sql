-- Prépare l'invitation "par rôle" : un membre invité n'est plus forcément
-- un coach. On ajoute PLAYER (joueur) et OTHER (autre membre du staff) aux
-- rôles possibles, avec un accès LECTURE SEULE sur leurs équipes (le nom du
-- rôle affiché reste géré côté client, cette table ne stocke qu'un rôle
-- fonctionnel simple).
--
-- Le rôle OWNER garde volontairement un accès total (lecture+écriture sur
-- tout le club) : dans la vie réelle il représentera le président, qui ne
-- fera que consulter, mais pendant la construction de l'outil c'est le
-- compte de l'administrateur/créateur et il doit garder le contrôle complet
-- pour ne pas se bloquer lui-même (voir CLAUDE.md, Décisions Prises).
--
-- can_access_team() (lecture) ne change pas de comportement : un membre lié
-- à une équipe (quel que soit son rôle) ou le OWNER peuvent la lire.
-- can_write_team() est nouvelle : seuls le OWNER et un membre au rôle COACH
-- lié à l'équipe peuvent écrire (créer/modifier/supprimer). Les policies
-- d'écriture de players/matches/events/match_lineups/reports basculent sur
-- cette nouvelle fonction ; les policies de lecture restent sur
-- can_access_team().
--
-- Rejouable sans danger.

alter table club_members drop constraint if exists club_members_role_check;
alter table club_members add constraint club_members_role_check
  check (role in ('OWNER', 'COACH', 'PLAYER', 'OTHER'));

create or replace function public.can_write_team(target_club_id uuid, target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from club_members m
    where m.club_id = target_club_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and (
        m.role = 'OWNER'
        or (
          m.role = 'COACH'
          and target_team_id is not null
          and exists (
            select 1 from club_member_teams cmt
            where cmt.member_id = m.id and cmt.team_id = target_team_id
          )
        )
      )
  );
$$;

-- ─── players : lecture club-wide (inchangé), écriture réservée à can_write_team ─

drop policy if exists "players_insert_team_access" on players;
create policy "players_insert_team_access" on players
  for insert with check (can_write_team(club_id, team_id));

drop policy if exists "players_update_team_access" on players;
create policy "players_update_team_access" on players
  for update using (can_write_team(club_id, team_id));

drop policy if exists "players_delete_team_access" on players;
create policy "players_delete_team_access" on players
  for delete using (can_write_team(club_id, team_id));

-- ─── matches : lecture via can_access_team (inchangé), écriture via can_write_team ─

drop policy if exists "matches_insert_team_access" on matches;
create policy "matches_insert_team_access" on matches
  for insert with check (can_write_team(club_id, team_id));

drop policy if exists "matches_update_team_access" on matches;
create policy "matches_update_team_access" on matches
  for update using (can_write_team(club_id, team_id));

drop policy if exists "matches_delete_team_access" on matches;
create policy "matches_delete_team_access" on matches
  for delete using (can_write_team(club_id, team_id));

-- ─── events / match_lineups / reports : écriture via can_write_team du match parent ─

drop policy if exists "events_insert_via_match" on events;
create policy "events_insert_via_match" on events
  for insert with check (
    exists (select 1 from matches m where m.id = events.match_id and can_write_team(m.club_id, m.team_id))
  );
drop policy if exists "events_update_via_match" on events;
create policy "events_update_via_match" on events
  for update using (
    exists (select 1 from matches m where m.id = events.match_id and can_write_team(m.club_id, m.team_id))
  );
drop policy if exists "events_delete_via_match" on events;
create policy "events_delete_via_match" on events
  for delete using (
    exists (select 1 from matches m where m.id = events.match_id and can_write_team(m.club_id, m.team_id))
  );

drop policy if exists "match_lineups_insert_via_match" on match_lineups;
create policy "match_lineups_insert_via_match" on match_lineups
  for insert with check (
    exists (select 1 from matches m where m.id = match_lineups.match_id and can_write_team(m.club_id, m.team_id))
  );
drop policy if exists "match_lineups_update_via_match" on match_lineups;
create policy "match_lineups_update_via_match" on match_lineups
  for update using (
    exists (select 1 from matches m where m.id = match_lineups.match_id and can_write_team(m.club_id, m.team_id))
  );
drop policy if exists "match_lineups_delete_via_match" on match_lineups;
create policy "match_lineups_delete_via_match" on match_lineups
  for delete using (
    exists (select 1 from matches m where m.id = match_lineups.match_id and can_write_team(m.club_id, m.team_id))
  );

drop policy if exists "reports_insert_via_match" on reports;
create policy "reports_insert_via_match" on reports
  for insert with check (
    exists (select 1 from matches m where m.id = reports.match_id and can_write_team(m.club_id, m.team_id))
  );
drop policy if exists "reports_update_via_match" on reports;
create policy "reports_update_via_match" on reports
  for update using (
    exists (select 1 from matches m where m.id = reports.match_id and can_write_team(m.club_id, m.team_id))
  );
drop policy if exists "reports_delete_via_match" on reports;
create policy "reports_delete_via_match" on reports
  for delete using (
    exists (select 1 from matches m where m.id = reports.match_id and can_write_team(m.club_id, m.team_id))
  );
