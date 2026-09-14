-- Désignation d'un membre (généralement un joueur) autorisé à tracker un
-- match précis, sans lui donner les droits COACH/ADJOINT sur toute l'équipe.
-- Le coach choisit le délégué à la création du match (CreateMatchModal) ;
-- pas de file de validation séparée : le délégué écrit directement comme un
-- coach le ferait, le coach relit/corrige le rapport après coup si besoin
-- (décision utilisateur du 15/09/2026 — "écriture directe, revue a posteriori").

alter table matches add column if not exists designated_tracker_member_id uuid references club_members(id) on delete set null;

create or replace function is_match_tracker(target_match_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from matches m
    join club_members cm on cm.id = m.designated_tracker_member_id
    where m.id = target_match_id
      and cm.user_id = auth.uid()
  );
$$;

-- Supabase accorde EXECUTE à PUBLIC (donc anon) par défaut sur toute nouvelle
-- fonction : revoke explicite de PUBLIC puis grant explicite à authenticated
-- (le simple "revoke ... from anon" ne suffit pas, la fonction reste
-- exécutable via le grant PUBLIC hérité — même leçon que les migrations
-- précédentes de verrouillage des fonctions security definer).
revoke execute on function is_match_tracker(uuid) from public;
grant execute on function is_match_tracker(uuid) to authenticated;

drop policy if exists "matches_update_team_access" on matches;
create policy "matches_update_team_access" on matches
  for update using (can_write_team(club_id, team_id) or is_match_tracker(id));

drop policy if exists "events_insert_via_match" on events;
create policy "events_insert_via_match" on events
  for insert with check (
    exists (select 1 from matches m where m.id = events.match_id and (can_write_team(m.club_id, m.team_id) or is_match_tracker(m.id)))
  );

drop policy if exists "events_update_via_match" on events;
create policy "events_update_via_match" on events
  for update using (
    exists (select 1 from matches m where m.id = events.match_id and (can_write_team(m.club_id, m.team_id) or is_match_tracker(m.id)))
  );

drop policy if exists "events_delete_via_match" on events;
create policy "events_delete_via_match" on events
  for delete using (
    exists (select 1 from matches m where m.id = events.match_id and (can_write_team(m.club_id, m.team_id) or is_match_tracker(m.id)))
  );

drop policy if exists "match_lineups_insert_via_match" on match_lineups;
create policy "match_lineups_insert_via_match" on match_lineups
  for insert with check (
    exists (select 1 from matches m where m.id = match_lineups.match_id and (can_write_team(m.club_id, m.team_id) or is_match_tracker(m.id)))
  );

drop policy if exists "match_lineups_update_via_match" on match_lineups;
create policy "match_lineups_update_via_match" on match_lineups
  for update using (
    exists (select 1 from matches m where m.id = match_lineups.match_id and (can_write_team(m.club_id, m.team_id) or is_match_tracker(m.id)))
  );

drop policy if exists "match_lineups_delete_via_match" on match_lineups;
create policy "match_lineups_delete_via_match" on match_lineups
  for delete using (
    exists (select 1 from matches m where m.id = match_lineups.match_id and (can_write_team(m.club_id, m.team_id) or is_match_tracker(m.id)))
  );
