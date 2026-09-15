-- Auto-inscription des joueurs (invitation par lien magique) : un membre
-- role PLAYER peut relier son compte a une fiche joueur existante non
-- reclamee (claim_player_profile) ou en creer une pour lui-meme
-- (create_own_player_profile), sans avoir le droit d'ecriture general sur
-- players (reserve a can_write_team()). Fonctions security definer etroites
-- plutot qu'elargir can_write_team, pour ne pas donner au joueur le droit
-- de modifier/creer des fiches pour d'AUTRES joueurs.

create or replace function claim_player_profile(target_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_member_id uuid;
  target_club_id uuid;
  target_team_id uuid;
begin
  select cm.id into caller_member_id
  from club_members cm
  where cm.user_id = auth.uid() and cm.status = 'ACTIVE'
  limit 1;

  if caller_member_id is null then
    raise exception 'Aucun compte membre actif trouve.';
  end if;

  if exists (select 1 from players where member_id = caller_member_id) then
    raise exception 'Un profil joueur est deja relie a ce compte.';
  end if;

  select p.club_id, p.team_id into target_club_id, target_team_id
  from players p
  where p.id = target_player_id and p.member_id is null;

  if target_club_id is null then
    raise exception 'Fiche joueur introuvable ou deja reclamee.';
  end if;

  if not can_access_team(target_club_id, target_team_id) then
    raise exception 'Acces refuse a cette equipe.';
  end if;

  update players set member_id = caller_member_id where id = target_player_id;
end;
$$;

create or replace function create_own_player_profile(
  p_name text,
  p_team_id uuid,
  p_position text default null,
  p_number int default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_member_id uuid;
  caller_club_id uuid;
  new_id uuid;
begin
  select cm.id, cm.club_id into caller_member_id, caller_club_id
  from club_members cm
  where cm.user_id = auth.uid() and cm.status = 'ACTIVE'
  limit 1;

  if caller_member_id is null then
    raise exception 'Aucun compte membre actif trouve.';
  end if;

  if exists (select 1 from players where member_id = caller_member_id) then
    raise exception 'Un profil joueur est deja relie a ce compte.';
  end if;

  if not can_access_team(caller_club_id, p_team_id) then
    raise exception 'Acces refuse a cette equipe.';
  end if;

  insert into players (name, team_id, club_id, position, number, member_id, created_by)
  values (p_name, p_team_id, caller_club_id, p_position, p_number, caller_member_id, auth.uid())
  returning id into new_id;

  return new_id;
end;
$$;

-- Supabase re-accorde EXECUTE a PUBLIC/anon par defaut sur toute nouvelle
-- fonction (parfois via un event trigger applique juste apres le CREATE,
-- pas instantane) : le revoke explicite de "public, anon" ensemble, verifie
-- avec has_function_privilege plutot qu'un simple re-lint, est le remede
-- fiable deja utilise sur les fonctions security definer precedentes.
revoke execute on function claim_player_profile(uuid) from public, anon;
grant execute on function claim_player_profile(uuid) to authenticated;
revoke execute on function create_own_player_profile(text, uuid, text, int) from public, anon;
grant execute on function create_own_player_profile(text, uuid, text, int) to authenticated;
