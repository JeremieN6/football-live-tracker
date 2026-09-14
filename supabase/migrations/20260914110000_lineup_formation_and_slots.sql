-- La nouvelle LineupView (refonte) place les titulaires sur des positions
-- tactiques nommees (ex. "DG", "MC", "BU") selon une formation choisie
-- (4-4-2/4-3-3/3-5-2), au lieu du simple statut STARTER/SUB existant.
-- Colonnes nullables, retrocompatibles : une ligne match_lineups sans
-- slot_id reste un STARTER/SUB "non positionne" (ancien comportement).
--
-- Rejouable sans danger.

alter table matches add column if not exists formation text;
alter table match_lineups add column if not exists slot_id text;
alter table match_lineups add column if not exists slot_label text;
