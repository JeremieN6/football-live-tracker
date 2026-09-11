-- Durée de chaque mi-temps (en minutes), capturée à la fin du match, pour
-- pouvoir calculer les minutes jouées par joueur dans le profil joueur.
--
-- À appliquer manuellement (SQL editor Supabase ou `npx supabase db push`).

alter table matches
  add column if not exists first_half_minutes smallint,
  add column if not exists second_half_minutes smallint;
