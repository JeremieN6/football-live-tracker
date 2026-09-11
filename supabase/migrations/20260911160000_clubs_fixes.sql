-- Corrections suite au 1er test réel de la fondation multi-club :
-- 1) un club pouvait se retrouver sans aucune équipe (ex: club créé par une
--    exécution partielle antérieure) -> on crée une "Équipe 1" par défaut
--    pour tout club qui n'en a aucune.
-- 2) rien n'empêchait deux clubs pour le même propriétaire (pas de contrainte
--    d'unicité) -> on fusionne les doublons éventuels dans le plus ancien
--    club de chaque propriétaire, puis on ajoute la contrainte.
--
-- Rejouable sans danger.

-- ─── Fusionne les clubs en double pour un même owner_id (le plus ancien gagne) ─

do $$
declare
  r record;
  keep_id uuid;
  dup_id uuid;
begin
  for r in
    select owner_id from clubs group by owner_id having count(*) > 1
  loop
    select id into keep_id from clubs where owner_id = r.owner_id order by created_at asc limit 1;

    for dup_id in
      select id from clubs where owner_id = r.owner_id and id <> keep_id
    loop
      update teams set club_id = keep_id where club_id = dup_id;
      update players set club_id = keep_id where club_id = dup_id;
      update matches set club_id = keep_id where club_id = dup_id;
      delete from club_members where club_id = dup_id;
      delete from clubs where id = dup_id;
    end loop;
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clubs_owner_id_key') then
    alter table clubs add constraint clubs_owner_id_key unique (owner_id);
  end if;
end $$;

-- ─── Crée une équipe par défaut pour tout club qui n'en a encore aucune ────────

insert into teams (club_id, name)
select c.id, 'Équipe 1'
from clubs c
where not exists (select 1 from teams t where t.club_id = c.id);

-- Note : les joueurs/matchs déjà rattachés au club mais sans équipe (team_id
-- null) ne sont volontairement pas réassignés ici — "Sans équipe" est un état
-- valide que le coach peut avoir choisi explicitement.
