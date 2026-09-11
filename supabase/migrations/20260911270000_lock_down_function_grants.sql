-- Revue de securite RLS : les fonctions SECURITY DEFINER internes
-- (helpers de policies + trigger de validation de club) etaient executables
-- par le role `anon` (non authentifie) via /rest/v1/rpc/<nom_fonction>.
-- Supabase accorde EXECUTE a `anon`/`authenticated` explicitement par
-- defaut sur toute fonction du schema public (en plus du grant implicite a
-- PUBLIC) -- aucune de nos migrations ne l'avait jamais retire.
--
-- Dans la pratique, ces fonctions dependent toutes de `auth.uid()`/
-- `auth.jwt()` (NULL pour `anon`), et `enforce_club_status_change`/
-- `rls_auto_enable` sont des fonctions RETURNS trigger/event_trigger que
-- Postgres refuse d'invoquer hors de leur contexte propre -- aucune
-- n'etait donc reellement exploitable. On retire quand meme l'acces `anon`
-- par principe de moindre privilege :
--
-- - `enforce_club_status_change` et `rls_auto_enable` : jamais appelables
--   directement par personne de toute facon (trigger/event trigger), acces
--   `anon` retire par hygiene, `authenticated` conserve (le trigger de
--   validation de club doit continuer a se declencher sur les UPDATE clubs
--   faits par un utilisateur connecte).
-- - `accept_pending_invites`/`can_access_team`/`can_write_team`/
--   `is_club_member` : acces `anon` retire, `authenticated` conserve
--   (necessaire : les policies RLS invoquent ces fonctions avec les
--   privileges du role courant, et `accept_pending_invites` est appelee
--   directement par le client via `supabase.rpc(...)`).
--
-- Rejouable sans danger.

revoke execute on function public.enforce_club_status_change() from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon;
revoke execute on function public.accept_pending_invites() from public, anon;
revoke execute on function public.can_access_team(uuid, uuid) from public, anon;
revoke execute on function public.can_write_team(uuid, uuid) from public, anon;
revoke execute on function public.is_club_member(uuid) from public, anon;

grant execute on function public.enforce_club_status_change() to authenticated;
grant execute on function public.rls_auto_enable() to authenticated;
grant execute on function public.accept_pending_invites() to authenticated;
grant execute on function public.can_access_team(uuid, uuid) to authenticated;
grant execute on function public.can_write_team(uuid, uuid) to authenticated;
grant execute on function public.is_club_member(uuid) to authenticated;
