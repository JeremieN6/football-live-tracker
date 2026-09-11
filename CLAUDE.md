# CLAUDE.md -- Memoire Projet

> Ce fichier est lu automatiquement par l'IA au debut de chaque conversation.
> Mets-le a jour a la fin de chaque session de travail.

---

## Objectif Final
Construire un SaaS "Match Report AI" pour coachs amateurs : suivi live des evenements match + rapport tactique IA exploitable apres match.

---

## Stack Technique
- Frontend : Vue 3 + TypeScript strict + Vite 6
- UI : Tailwind CSS v4 + composants custom tracker
- State : Pinia
- Routing : Vue Router 4 (routes protegees)
- Backend : Supabase (Postgres, Auth, Realtime, Edge Functions)
- IA : Anthropic Claude (Haiku) via Edge Function `generate-report`

---

## Etat Actuel du Projet
**Phase** : Phase 8 terminee (code), migration DB reelle a appliquer
**Derniere session** : 11/09/2026
**Progression globale** : 100% MVP + effectif/rapport nominatif (migration non encore appliquee en prod)

### Ce qui est fait :
- [x] Phase 1 — Setup projet et architecture
- [x] Phase 2 — Authentification Supabase
- [x] Phase 3 — Gestion des matchs
- [x] Phase 4 — Live Tracker complet
- [x] Phase 5 — Realtime Supabase sur events
- [x] Phase 6 — Rapport IA + edge function
- [x] Phase 7 — Polish SEO/PWA + validation build/deploy
- [x] Phase 8 — Effectif de club reutilisable + selection par match (titulaires/remplacants) + evenements nominatifs (buteur, passe decisive, carton, remplacement) + rapport de match sans IA (buteurs/passeurs, cartons, chronologie)

### Prochaines etapes :
- [ ] Appliquer la migration `supabase/migrations/20260911120000_players_and_lineups.sql` sur le projet Supabase reel (SQL Editor ou `npx supabase db push`) puis tester le flux complet (effectif → lineup → tracker → rapport)
- [ ] Renseigner `.env.e2e.local` (E2E_SUPABASE_EMAIL + PASSWORD) et lancer `npm run e2e`
- [ ] Ajouter monitoring erreurs (Sentry ou equivalent)
- [ ] Durcir la securite deployment (rotation secrets, revue RLS)

---

## Blocages et Points d Attention
- Ne jamais stocker de cle IA dans le frontend (`.env.local` client)
- Utiliser `npx supabase ...` si le binaire global `supabase` n'est pas disponible
- Garder les modeles Anthropic en alias stables (`claude-3-5-haiku-latest`)

---

## Decisions Prises
| Date | Decision | Raison |
|------|----------|--------|
| 02/05/2026 | Utiliser Claude Haiku pour le rapport IA | Suffisant en qualite pour stats structurees et bien plus economique que Sonnet |
| 02/05/2026 | Appeler l'IA uniquement depuis Edge Function | Eviter d'exposer la cle API dans le client |
| 02/05/2026 | Ajouter manifest + meta OG/SEO | Ameliorer la qualite deploy web/mobile |
| 11/09/2026 | Effectif de club reutilisable (table `players`) + selection par match (table `match_lineups`) plutot que du texte libre ou un placement sur le terrain | Le coach veut un rapport nominatif (buteurs, passeurs decisifs, cartons) sans lourdeur de saisie ; le placement terrain (formation) est ecarte pour l'instant car peu de valeur ajoutee pour le rapport face au cout UX |
| 11/09/2026 | Rester sur Supabase (ne pas migrer la base vers Neon) | L'utilisateur centralise ses autres SaaS sur Neon, mais Neon n'est qu'un Postgres : il ne fournit pas d'equivalent a l'Auth, au Realtime ni aux Edge Functions de Supabase. Migrer aurait exige de reconstruire ces trois briques ailleurs (plusieurs jours), pour un projet qui tourne deja bien — cout largement superieur au benefice ("un endroit de moins a consulter"). A envisager plutot en amont sur de futurs projets. |

---

## Notes de Session
- Phase 4 a 7 finalisees.
- Realtime ajoute dans le tracker via `useMatchSync`.
- Generation de rapport IA operationnelle via `generate-report` (Anthropic).
- Harden de securite applique : retrait des variables sensibles cote client.
- Build production valide (`npm run build` OK) et fonction Supabase redeployee.
- 11/09/2026 : Ajout effectif de club (`players`) + selection titulaires/remplacants par match (`match_lineups`), sans placement terrain. Les evenements GOAL_FOR/YELLOW_CARD/RED_CARD/SUBSTITUTION portent desormais des references vers l'effectif (scorer_id, assist_id, player_id, player_in_id, player_out_id) a la place des anciens champs texte libre player_in/player_out. ReportView affiche un rapport nominatif sans IA (buteurs, passeurs decisifs, cartons, chronologie), independant du bloc Analyse IA. Migration SQL ecrite dans `supabase/migrations/20260911120000_players_and_lineups.sql` mais **pas encore appliquee** sur le vrai projet Supabase (pas d'acces credentials depuis la session distante) — a faire manuellement avant de tester en conditions reelles. Discussion sur une migration vers Neon : ecartee pour ce projet (voir Decisions Prises), l'utilisateur reste sur Supabase.
- Build (`npm run build`) et typecheck (`vue-tsc -b`) valides apres ces changements. Dev server verifie localement (credentials factices, pas de test end-to-end avec vraies donnees possible depuis cette session).
