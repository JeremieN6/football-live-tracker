-- Aligne la lecture de `teams` sur celle de `players` (Phase B) : tout membre
-- actif du club peut lire le nom (et division/categorie/formation) de
-- n'importe quelle equipe du club, pas seulement celles auxquelles il est
-- rattache. Necessaire pour que le nom d'une equipe reste lisible quand un
-- joueur "appele en renfort" y est rattache, dans le profil joueur d'un
-- coach qui n'a pas acces a cette equipe.
--
-- L'ecriture (creer/modifier/supprimer une equipe) reste inchangee, limitee
-- au OWNER (`teams_insert_own_club`/`teams_update_own_club`/
-- `teams_delete_own_club`, non touchees par cette migration).
--
-- Rejouable sans danger.

drop policy if exists "teams_select_member" on teams;
create policy "teams_select_member" on teams
  for select using (is_club_member(club_id));
