-- Empêche un club nouvellement créé (premier login, sans invitation) d'être
-- utilisable tant qu'il n'a pas été validé manuellement par l'administrateur
-- de l'outil. L'objectif n'est pas d'empêcher la création en soi (pas de
-- système de code d'invitation à gérer pour un tout premier club), mais de
-- ne jamais laisser un club actif sans que l'admin ait pu le voir passer --
-- et repérer un doublon/usurpation de nom avant que ce soit trop tard.
--
-- Un club rejoint via invitation (club_members) n'est pas concerné : il
-- utilise un club déjà validé par construction.
--
-- Rejouable sans danger.

alter table clubs add column if not exists status text not null default 'PENDING';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'clubs_status_check') then
    alter table clubs add constraint clubs_status_check check (status in ('PENDING', 'ACTIVE'));
  end if;
end $$;

-- Les clubs déjà en place sont déjà en usage réel : considérés validés d'office.
update clubs set status = 'ACTIVE' where status = 'PENDING';

-- is_club_member / can_access_team / can_write_team exigent désormais que le
-- club soit ACTIVE, en plus de l'appartenance. Bloque de fait tout usage
-- fonctionnel (équipes, effectif, matchs...) d'un club en attente, y compris
-- pour son propriétaire -- seule la ligne `clubs` elle-même reste lisible
-- (policy "clubs_select_member", owner_id = auth.uid() OR is_club_member),
-- pour que l'écran d'attente côté client puisse afficher le statut.

create or replace function public.is_club_member(target_club_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from club_members m
    join clubs c on c.id = m.club_id
    where m.club_id = target_club_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and c.status = 'ACTIVE'
  );
$$;

create or replace function public.can_access_team(target_club_id uuid, target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from club_members m
    join clubs c on c.id = m.club_id
    where m.club_id = target_club_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and c.status = 'ACTIVE'
      and (
        m.role = 'OWNER'
        or (
          target_team_id is not null
          and exists (
            select 1 from club_member_teams cmt
            where cmt.member_id = m.id and cmt.team_id = target_team_id
          )
        )
      )
  );
$$;

create or replace function public.can_write_team(target_club_id uuid, target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from club_members m
    join clubs c on c.id = m.club_id
    where m.club_id = target_club_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and c.status = 'ACTIVE'
      and (
        m.role = 'OWNER'
        or (
          m.role = 'COACH'
          and target_team_id is not null
          and exists (
            select 1 from club_member_teams cmt
            where cmt.member_id = m.id and cmt.team_id = target_team_id
          )
        )
      )
  );
$$;

-- ─── Pour approuver un club en attente (à lancer à la main dans le SQL Editor) ─
-- select id, name, owner_id, created_at from clubs where status = 'PENDING';
-- update clubs set status = 'ACTIVE' where id = '<id du club>';
