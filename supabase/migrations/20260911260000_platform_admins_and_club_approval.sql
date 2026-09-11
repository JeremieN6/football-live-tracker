-- Page admin de validation des clubs en attente, + fermeture d'un trou de
-- sécurité trouvé en la construisant : la policy "clubs_update_own"
-- (owner_id = auth.uid()) laissait n'importe quel propriétaire de club
-- passer lui-même son propre statut à 'ACTIVE', ce qui aurait rendu
-- l'approbation manuelle inutile dès que quelqu'un l'aurait remarqué.
--
-- Table `platform_admins` : liste des comptes autorisés à valider/rejeter
-- un club. Un trigger BEFORE UPDATE bloque tout changement de `status` sur
-- `clubs` qui ne vient pas d'un admin, quelle que soit la policy RLS qui a
-- laissé passer l'UPDATE par ailleurs (défense en profondeur : la policy
-- seule ne suffit pas à empêcher un propriétaire de modifier SA propre ligne).
--
-- Rejouable sans danger.

create table if not exists platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table platform_admins enable row level security;

drop policy if exists "platform_admins_select_self" on platform_admins;
create policy "platform_admins_select_self" on platform_admins
  for select using (user_id = auth.uid());

-- Seed : l'utilisateur courant du projet est admin de la plateforme.
insert into platform_admins (user_id)
select id from auth.users where email = 'ngoyi.jeremie@gmail.com'
on conflict do nothing;

-- ─── Empêche tout changement de `status` hors admin, peu importe qui a le droit d'UPDATE la ligne ─

create or replace function public.enforce_club_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if not exists (select 1 from platform_admins where user_id = auth.uid()) then
      raise exception 'Seul un administrateur peut modifier le statut du club.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_status_change_guard on clubs;
create trigger clubs_status_change_guard
  before update on clubs
  for each row
  execute function public.enforce_club_status_change();

-- ─── Un admin doit pouvoir lire/modifier/supprimer N'IMPORTE QUEL club (pas seulement le sien) ─

drop policy if exists "clubs_select_member" on clubs;
create policy "clubs_select_member" on clubs
  for select using (
    owner_id = auth.uid()
    or is_club_member(id)
    or exists (select 1 from platform_admins where user_id = auth.uid())
  );

drop policy if exists "clubs_update_admin" on clubs;
create policy "clubs_update_admin" on clubs
  for update using (exists (select 1 from platform_admins where user_id = auth.uid()));

drop policy if exists "clubs_delete_admin" on clubs;
create policy "clubs_delete_admin" on clubs
  for delete using (exists (select 1 from platform_admins where user_id = auth.uid()));
