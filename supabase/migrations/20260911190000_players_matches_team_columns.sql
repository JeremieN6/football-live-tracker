-- La migration 140000 s'est arrêtée avant d'atteindre l'ajout de club_id/team_id
-- sur players et matches (confirmé : erreur PostgREST "Could not find the
-- 'team_id' column of 'players' in the schema cache"). Cette migration les
-- ajoute de façon autonome, indépendamment de l'état des migrations
-- précédentes.
--
-- Rejouable sans danger.

alter table players
  add column if not exists club_id uuid references clubs(id) on delete cascade,
  add column if not exists team_id uuid references teams(id) on delete set null;

alter table matches
  add column if not exists club_id uuid references clubs(id) on delete cascade,
  add column if not exists team_id uuid references teams(id) on delete set null;

-- ─── Backfill : rattache les joueurs/matchs existants au club de leur créateur ─
-- (le club a déjà été créé par les migrations précédentes ; on ne touche pas
-- team_id ici, "Sans équipe" reste un état valide que le coach choisira lui-même)

update players p
set club_id = c.id
from clubs c
where p.club_id is null and p.created_by = c.owner_id;

update matches m
set club_id = c.id
from clubs c
where m.club_id is null and m.created_by = c.owner_id;

-- ─── Vérification : les deux colonnes doivent apparaître pour players et matches ─

select table_name, column_name
from information_schema.columns
where table_name in ('players', 'matches') and column_name in ('club_id', 'team_id')
order by table_name, column_name;

-- Force PostgREST à recharger son cache de schéma (l'erreur "Could not find
-- the 'team_id' column... in the schema cache" suggère qu'il faut ce coup de
-- pouce après un ajout de colonne, plutôt que d'attendre le refresh automatique).
notify pgrst, 'reload schema';
