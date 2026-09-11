-- Phase B multi-club : cloisonnement reel par equipe.
--
-- Jusqu'ici, players/matches/events/match_lineups/reports restaient
-- accessibles via les anciennes policies basees sur created_by = auth.uid()
-- (correct tant qu'il n'y avait qu'un seul coach par club). On les remplace
-- par des policies basees sur l'appartenance a l'equipe (club_members),
-- indispensable avant d'ouvrir les invitations multi-coach (Phase C).
--
-- Regles retenues :
-- - Le OWNER d'un club voit et gere tout, sur toutes les equipes.
-- - Un COACH ne voit/gere que les donnees de SON equipe (team_id = la sienne).
-- - Exception : les joueurs (players) restent visibles en LECTURE par tout
--   membre actif du club (pas seulement son equipe), pour que le nom d'un
--   joueur "appele en renfort" depuis une autre equipe reste lisible dans
--   les matchs/rapports. L'ECRITURE sur players (creer/modifier/archiver)
--   reste en revanche limitee a l'equipe du joueur.
-- - Une ligne sans equipe (team_id null) n'est geree que par le OWNER.
--
-- Rejouable sans danger.

-- ─── Fonction utilitaire : l'utilisateur courant a-t-il acces a cette equipe ? ─
-- SECURITY DEFINER : contourne le RLS de club_members pour eviter toute
-- recursion de policies (cette fonction EST utilisee depuis des policies).

create or replace function public.can_access_team(target_club_id uuid, target_team_id uuid)
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
      and (m.role = 'OWNER' or (target_team_id is not null and m.team_id = target_team_id))
  );
$$;

-- L'utilisateur courant est-il membre actif de ce club (quelle que soit son equipe) ?
create or replace function public.is_club_member(target_club_id uuid)
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
  );
$$;

-- ─── Supprime toutes les anciennes policies (noms inconnus, ecrites avant ce projet) ─

do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where tablename in ('players', 'matches', 'events', 'match_lineups', 'reports')
  loop
    execute format('drop policy %I on %I', pol.policyname, pol.tablename);
  end loop;
end $$;

alter table players enable row level security;
alter table matches enable row level security;
alter table events enable row level security;
alter table match_lineups enable row level security;
alter table reports enable row level security;

-- ─── players : lecture club-wide, ecriture limitee a l'equipe ────────────────

create policy "players_select_club_member" on players
  for select using (is_club_member(club_id));
create policy "players_insert_team_access" on players
  for insert with check (can_access_team(club_id, team_id));
create policy "players_update_team_access" on players
  for update using (can_access_team(club_id, team_id));
create policy "players_delete_team_access" on players
  for delete using (can_access_team(club_id, team_id));

-- ─── matches : lecture + ecriture limitees a l'equipe ─────────────────────────

create policy "matches_select_team_access" on matches
  for select using (can_access_team(club_id, team_id));
create policy "matches_insert_team_access" on matches
  for insert with check (can_access_team(club_id, team_id));
create policy "matches_update_team_access" on matches
  for update using (can_access_team(club_id, team_id));
create policy "matches_delete_team_access" on matches
  for delete using (can_access_team(club_id, team_id));

-- ─── events / match_lineups / reports : acces via l'equipe du match parent ────

create policy "events_select_via_match" on events
  for select using (
    exists (select 1 from matches m where m.id = events.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "events_insert_via_match" on events
  for insert with check (
    exists (select 1 from matches m where m.id = events.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "events_update_via_match" on events
  for update using (
    exists (select 1 from matches m where m.id = events.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "events_delete_via_match" on events
  for delete using (
    exists (select 1 from matches m where m.id = events.match_id and can_access_team(m.club_id, m.team_id))
  );

create policy "match_lineups_select_via_match" on match_lineups
  for select using (
    exists (select 1 from matches m where m.id = match_lineups.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "match_lineups_insert_via_match" on match_lineups
  for insert with check (
    exists (select 1 from matches m where m.id = match_lineups.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "match_lineups_update_via_match" on match_lineups
  for update using (
    exists (select 1 from matches m where m.id = match_lineups.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "match_lineups_delete_via_match" on match_lineups
  for delete using (
    exists (select 1 from matches m where m.id = match_lineups.match_id and can_access_team(m.club_id, m.team_id))
  );

create policy "reports_select_via_match" on reports
  for select using (
    exists (select 1 from matches m where m.id = reports.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "reports_insert_via_match" on reports
  for insert with check (
    exists (select 1 from matches m where m.id = reports.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "reports_update_via_match" on reports
  for update using (
    exists (select 1 from matches m where m.id = reports.match_id and can_access_team(m.club_id, m.team_id))
  );
create policy "reports_delete_via_match" on reports
  for delete using (
    exists (select 1 from matches m where m.id = reports.match_id and can_access_team(m.club_id, m.team_id))
  );

-- ─── clubs / teams : elargit la lecture a tout membre actif (pas que le OWNER) ─
-- Prepare la Phase C (un COACH invite doit pouvoir lire "son" club et son
-- equipe) sans attendre une nouvelle migration a ce moment-la. L'ecriture
-- (creer/modifier/supprimer un club ou une equipe) reste reservee au OWNER.

drop policy if exists "clubs_select_own" on clubs;
create policy "clubs_select_member" on clubs
  for select using (owner_id = auth.uid() or is_club_member(id));

drop policy if exists "teams_select_own_club" on teams;
create policy "teams_select_member" on teams
  for select using (can_access_team(club_id, id));

-- ─── Verification : chaque table doit avoir au moins 1 policy ────────────────

select tablename, count(*) as policy_count
from pg_policies
where tablename in ('players', 'matches', 'events', 'match_lineups', 'reports', 'clubs', 'teams', 'club_members')
group by tablename
order by tablename;
