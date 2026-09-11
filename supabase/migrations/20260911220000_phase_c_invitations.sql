-- Phase C multi-club : invitations par email.
--
-- Le OWNER invite un coach en créant une ligne `club_members` avec
-- status='PENDING', team_id (l'équipe visée), role='COACH' et
-- invited_email (pas encore de user_id, la personne n'a peut-être pas
-- encore de compte). Quand cette personne se connecte (compte existant
-- ou tout juste créé) avec cette adresse email, `accept_pending_invites()`
-- relie automatiquement son user_id à l'invitation et passe le statut à
-- ACTIVE. Appelée à chaque login (voir clubsStore.ensureClub côté client).
--
-- invited_email n'est jamais effacé après acceptation : c'est le seul
-- moyen d'afficher une identité lisible pour un membre côté client (pas
-- d'accès à auth.users depuis le rôle authenticated).
--
-- Rejouable sans danger.

create or replace function public.accept_pending_invites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update club_members
  set user_id = auth.uid(), status = 'ACTIVE'
  where status = 'PENDING'
    and invited_email is not null
    and lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''));
end;
$$;

-- Normalise en minuscule les emails déjà stockés, pour que la comparaison
-- ci-dessus soit fiable même pour des invitations déjà en base.
update club_members set invited_email = lower(invited_email) where invited_email is not null;

-- S'assure explicitement que les utilisateurs connectés peuvent appeler cette fonction.
grant execute on function public.accept_pending_invites() to authenticated;
