-- Permet au proprietaire de renseigner deux infos d'identite du club, affichees
-- sur HomeView ("fonde en {annee} · {localisation}"). La policy d'UPDATE existante
-- (clubs_update_own, owner_id = auth.uid()) couvre deja ces nouvelles colonnes,
-- le trigger enforce_club_status_change ne bloque que les changements de `status`.
--
-- Rejouable sans danger.

alter table clubs add column if not exists founded_year integer;
alter table clubs add column if not exists location text;

alter table clubs drop constraint if exists clubs_founded_year_check;
alter table clubs add constraint clubs_founded_year_check
  check (founded_year is null or (founded_year between 1850 and 2100));
