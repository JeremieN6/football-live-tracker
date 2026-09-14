-- Lien reel entre une fiche joueur (players, utilisee pour les compositions/
-- rapports) et un compte membre (club_members, avec role/acces a l'app) --
-- pour les vrais joueurs qui ont aussi un compte. Optionnel : la plupart des
-- fiches players restent sans lien (la majorite des joueurs n'ont pas de
-- compte). Un membre ne peut etre lie qu'a une seule fiche joueur (unique).
--
-- Rejouable sans danger.

alter table players add column if not exists member_id uuid references club_members(id) on delete set null;

alter table players drop constraint if exists players_member_id_key;
alter table players add constraint players_member_id_key unique (member_id);
