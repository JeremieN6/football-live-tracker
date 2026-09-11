-- Effectif de club réutilisable + sélection de l'effectif par match
-- + rattachement des joueurs aux événements (buteur, passeur, carton, remplacement)
--
-- À appliquer manuellement (ex: `npx supabase db push` ou SQL editor Supabase),
-- aucune CLI Supabase n'est disponible depuis cette session.

-- ─── players : effectif du club, réutilisable d'un match à l'autre ────────────

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  number smallint,
  position text,
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table players enable row level security;

create policy "players_select_own" on players
  for select using (created_by = auth.uid());
create policy "players_insert_own" on players
  for insert with check (created_by = auth.uid());
create policy "players_update_own" on players
  for update using (created_by = auth.uid());
create policy "players_delete_own" on players
  for delete using (created_by = auth.uid());

-- ─── match_lineups : titulaires + remplaçants sélectionnés pour un match ──────

create table if not exists match_lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  role text not null check (role in ('STARTER', 'SUB')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (match_id, player_id)
);

alter table match_lineups enable row level security;

create policy "match_lineups_select_own" on match_lineups
  for select using (created_by = auth.uid());
create policy "match_lineups_insert_own" on match_lineups
  for insert with check (created_by = auth.uid());
create policy "match_lineups_update_own" on match_lineups
  for update using (created_by = auth.uid());
create policy "match_lineups_delete_own" on match_lineups
  for delete using (created_by = auth.uid());

-- ─── events : rattacher buteur / passeur décisif / porteur de carton / remplacement ─
-- Remplace les anciens champs texte libre player_in / player_out par des
-- références vers l'effectif (players). Les remplacements déjà enregistrés en
-- texte libre ne sont pas migrés (pas de correspondance fiable vers l'effectif).

alter table events
  add column if not exists scorer_id uuid references players(id) on delete set null,
  add column if not exists assist_id uuid references players(id) on delete set null,
  add column if not exists player_id uuid references players(id) on delete set null,
  add column if not exists player_in_id uuid references players(id) on delete set null,
  add column if not exists player_out_id uuid references players(id) on delete set null;

alter table events drop column if exists player_in;
alter table events drop column if exists player_out;
