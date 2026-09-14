-- Rôle DIRIGEANT : lecture club-wide (comme PRESIDENT), jamais d'écriture,
-- ne peut pas inviter (déjà garanti : les policies d'invitation/gestion
-- club ne testent que 'OWNER', DIRIGEANT n'y matche jamais).
alter table club_members drop constraint club_members_role_check;
alter table club_members add constraint club_members_role_check
  check (role = ANY (ARRAY['OWNER','COACH','PLAYER','OTHER','PRESIDENT','CATEGORY_MANAGER','ADJOINT','DIRIGEANT']));

create or replace function can_access_team(target_club_id uuid, target_team_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
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
        or m.role = 'PRESIDENT'
        or m.role = 'DIRIGEANT'
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
$$;
