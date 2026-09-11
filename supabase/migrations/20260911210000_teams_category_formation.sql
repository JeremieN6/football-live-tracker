-- Enrichit les équipes avec une catégorie (ex: Seniors, U19) et une formation
-- favorite (ex: 4-4-2), en plus du nom et de la division déjà existants.
--
-- Rejouable sans danger.

alter table teams
  add column if not exists category text,
  add column if not exists formation text;
