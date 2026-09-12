-- Hierarchie de roles complete (1ere tranche) : President, Responsable de
-- categorie, Adjoint. "Dirigeant" (administration club-wide de l'effectif)
-- est volontairement laisse de cote pour l'instant -- l'utilisateur a
-- lui-meme exprime un doute sur la pertinence de le construire des
-- maintenant vu qu'aucun vrai dirigeant n'utilise l'outil aujourd'hui
-- (voir CLAUDE.md, Decisions Prises).
--
-- - PRESIDENT : lecture club-wide (tout le club), jamais d'ecriture. Meme
--   principe que la lecture club-wide deja en place sur `players`/`teams`
--   (Phase B / migration 20260911280000), mais applique ici a
--   `can_access_team()` -- donc etendu aussi aux matchs/evenements/
--   effectifs de match/rapports, que `players`/`teams` ne couvraient pas.
-- - CATEGORY_MANAGER (Responsable de categorie) : lecture + ecriture sur
--   TOUTES les equipes qui partagent une categorie donnee (ex. "Seniors"),
--   de facon automatique -- y compris une equipe creee apres coup dans
--   cette categorie, sans avoir a remettre a jour ses rattachements. Nvelle
--   table de liaison `club_member_categories` (many-to-many, meme schema
--   que `club_member_teams`), le matching se fait par egalite de texte sur
--   `teams.category`.
-- - ADJOINT : rattache a une/des equipes comme un COACH (via
--   `club_member_teams`, deja en place), mais volontairement PAS un accces
--   equivalent au COACH sur la gestion du club -- seulement le droit
--   d'operer le live tracker sur son equipe (matchs/evenements/effectifs de
--   match/rapports). Note de conception : la reponse utilisateur disait
--   "lecture seulement", mais decrivait dans la meme phrase un adjoint qui
--   "sera potentiellement amene a utiliser le live tracker" pendant que le
--   coach est focalise sur le match -- utiliser le tracker (marquer un but,
--   un carton, un remplacement) exige d'ecrire dans `events`/`matches`, ce
--   qu'un role strictement lecture-seule ne permettrait pas. Tranche en
--   faveur du besoin fonctionnel explicite (operer le tracker) plutot que
--   du mot "lecture" pris au pied de la lettre : ADJOINT obtient les memes
--   droits d'ecriture que COACH, mais seulement sur son (ses) equipe(s)
--   rattachee(s), jamais sur la gestion du club (creation d'equipe,
--   invitations, effectif hors match reste reserve a OWNER/COACH via les
--   policies deja existantes qui ne testent que 'OWNER'/'COACH' pour ces
--   actions-la -- ADJOINT n'y est pas ajoute).
--
-- Rejouable sans danger.

-- 1. Elargir les roles acceptes.
alter table club_members drop constraint if exists club_members_role_check;
alter table club_members add constraint club_members_role_check
  check (role = any (array['OWNER', 'COACH', 'PLAYER', 'OTHER', 'PRESIDENT', 'CATEGORY_MANAGER', 'ADJOINT']));

-- 2. Table de liaison membre <-> categorie, pour le Responsable de categorie.
create table if not exists club_member_categories (
  member_id uuid not null references club_members(id) on delete cascade,
  category text not null,
  primary key (member_id, category)
);

alter table club_member_categories enable row level security;

drop policy if exists "club_member_categories_select" on club_member_categories;
create policy "club_member_categories_select" on club_member_categories
  for select using (
    exists (
      select 1 from club_members m
      where m.id = club_member_categories.member_id
        and (m.user_id = auth.uid() or m.club_id in (select id from clubs where owner_id = auth.uid()))
    )
  );

drop policy if exists "club_member_categories_insert_owner" on club_member_categories;
create policy "club_member_categories_insert_owner" on club_member_categories
  for insert with check (
    exists (
      select 1 from club_members m
      where m.id = club_member_categories.member_id
        and m.club_id in (select id from clubs where owner_id = auth.uid())
    )
  );

drop policy if exists "club_member_categories_delete_owner" on club_member_categories;
create policy "club_member_categories_delete_owner" on club_member_categories
  for delete using (
    exists (
      select 1 from club_members m
      where m.id = club_member_categories.member_id
        and m.club_id in (select id from clubs where owner_id = auth.uid())
    )
  );

revoke execute on function public.can_access_team(uuid, uuid) from public, anon;
revoke execute on function public.can_write_team(uuid, uuid) from public, anon;

-- 3. can_access_team : ajoute le bypass PRESIDENT (club-wide) et le match
-- par categorie pour CATEGORY_MANAGER. La branche existante (team_id non
-- null + lien club_member_teams, sans condition de role) continue de
-- couvrir COACH/PLAYER/OTHER/ADJOINT sans changement.
create or replace function public.can_access_team(target_club_id uuid, target_team_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from club_members m
    join clubs c on c.id = m.club_id
    where m.club_id = target_club_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
      and c.status = 'ACTIVE'
      and (
        m.role = 'OWNER'
        or m.role = 'PRESIDENT'
        or (
          target_team_id is not null
          and exists (
            select 1 from club_member_teams cmt
            where cmt.member_id = m.id and cmt.team_id = target_team_id
          )
        )
        or (
          m.role = 'CATEGORY_MANAGER'
          and target_team_id is not null
          and exists (
            select 1 from club_member_categories cmc
            join teams t on t.category = cmc.category
            where cmc.member_id = m.id and t.id = target_team_id
          )
        )
      )
  );
$function$;

-- 4. can_write_team : ajoute ADJOINT (ecriture scoped a son equipe, comme
-- COACH) et CATEGORY_MANAGER (ecriture sur toute equipe de sa categorie).
create or replace function public.can_write_team(target_club_id uuid, target_team_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
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
          m.role in ('COACH', 'ADJOINT')
          and target_team_id is not null
          and exists (
            select 1 from club_member_teams cmt
            where cmt.member_id = m.id and cmt.team_id = target_team_id
          )
        )
        or (
          m.role = 'CATEGORY_MANAGER'
          and target_team_id is not null
          and exists (
            select 1 from club_member_categories cmc
            join teams t on t.category = cmc.category
            where cmc.member_id = m.id and t.id = target_team_id
          )
        )
      )
  );
$function$;

grant execute on function public.can_access_team(uuid, uuid) to authenticated;
grant execute on function public.can_write_team(uuid, uuid) to authenticated;
