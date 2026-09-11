-- Un membre du club peut désormais être rattaché à PLUSIEURS équipes (pas
-- une seule) : ex. un coach de l'équipe 1 qui est aussi responsable des
-- séniors et doit voir/gérer une autre équipe. Remplace club_members.team_id
-- (une seule équipe) par une table de liaison many-to-many.
--
-- Rejouable sans danger.

create table if not exists club_member_teams (
  member_id uuid not null references club_members(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  primary key (member_id, team_id)
);

-- Reprend les rattachements existants (un par membre) avant de retirer l'ancienne colonne
insert into club_member_teams (member_id, team_id)
select id, team_id from club_members
where team_id is not null
on conflict do nothing;

alter table club_members drop column if exists team_id;

alter table club_member_teams enable row level security;

drop policy if exists "club_member_teams_select" on club_member_teams;
create policy "club_member_teams_select" on club_member_teams
  for select using (
    exists (
      select 1 from club_members m
      where m.id = club_member_teams.member_id
        and (m.user_id = auth.uid() or m.club_id in (select id from clubs where owner_id = auth.uid()))
    )
  );

drop policy if exists "club_member_teams_insert_owner" on club_member_teams;
create policy "club_member_teams_insert_owner" on club_member_teams
  for insert with check (
    exists (
      select 1 from club_members m
      where m.id = club_member_teams.member_id
        and m.club_id in (select id from clubs where owner_id = auth.uid())
    )
  );

drop policy if exists "club_member_teams_delete_owner" on club_member_teams;
create policy "club_member_teams_delete_owner" on club_member_teams
  for delete using (
    exists (
      select 1 from club_members m
      where m.id = club_member_teams.member_id
        and m.club_id in (select id from clubs where owner_id = auth.uid())
    )
  );

-- can_access_team : un OWNER a toujours accès ; un COACH doit être lié à
-- cette équipe précise via club_member_teams (au lieu d'un unique team_id).
create or replace function public.can_access_team(target_club_id uuid, target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from club_members m
    where m.club_id = target_club_id
      and m.user_id = auth.uid()
      and m.status = 'ACTIVE'
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
