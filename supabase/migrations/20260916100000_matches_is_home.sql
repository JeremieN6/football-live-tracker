-- Ajoute une vraie notion "match a domicile" plutot que de la deviner en
-- comparant home_team (texte libre) au nom de l'equipe. Demande explicite de
-- l'utilisateur (16/09/2026) : "le nom du club a gauche = l'equipe a domicile",
-- geste elementaire au foot, autant le stocker plutot que le deviner.
--
-- Backfill sur les matchs existants : meme heuristique que celle deja en place
-- dans TeamStatsView.vue (home_team correspond au nom reel de l'equipe), c'est
-- la seule information disponible retroactivement -- imprecise si un libelle
-- ne correspondait pas exactement au nom de l'equipe, mais c'est deja le
-- comportement actuel donc aucune regression.
alter table matches
  add column if not exists is_home boolean not null default true;

update matches m
set is_home = coalesce(
  lower(trim(m.home_team)) = lower(trim(t.name)),
  true
)
from teams t
where m.team_id = t.id;
