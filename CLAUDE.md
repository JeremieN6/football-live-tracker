# CLAUDE.md -- Memoire Projet

> Ce fichier est lu automatiquement par l'IA au debut de chaque conversation.
> Mets-le a jour a la fin de chaque session de travail.

---

## Objectif Final
Construire un SaaS "Match Report AI" pour coachs amateurs : suivi live des evenements match + rapport tactique IA exploitable apres match. Cible a terme : plusieurs clubs, chacun avec plusieurs equipes (ex. Equipe 1, Equipe reserve) et plusieurs coachs, cloisonnement strict des donnees par club/equipe.

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
**Phase** : Phase 10 (Phase A de la fondation multi-club) terminee cote code, migration a appliquer
**Derniere session** : 11/09/2026
**Progression globale** : 100% MVP + effectif/rapport nominatif/profil joueur, teste de bout en bout ; fondation multi-club (clubs/equipes) en cours (Phase A faite, RLS par equipe et invitations restent a faire)

### Ce qui est fait :
- [x] Phase 1 — Setup projet et architecture
- [x] Phase 2 — Authentification Supabase
- [x] Phase 3 — Gestion des matchs
- [x] Phase 4 — Live Tracker complet
- [x] Phase 5 — Realtime Supabase sur events
- [x] Phase 6 — Rapport IA + edge function
- [x] Phase 7 — Polish SEO/PWA + validation build/deploy
- [x] Phase 8 — Effectif de club reutilisable + selection par match (titulaires/remplacants) + evenements nominatifs (buteur, passe decisive, carton, remplacement) + rapport de match sans IA (buteurs/passeurs, cartons, chronologie)
- [x] Phase 9 — Vue profil joueur (`/roster/:id`) : stats agregees sur tous les matchs (buts, passes decisives, cartons, titularisations, entrees en jeu, minutes jouees total + moyenne) + historique match par match
- [x] Phase 10 (Phase A multi-club) — Tables `clubs`/`teams`/`club_members`, `players`/`matches` rattaches a un `club_id`+`team_id`. Club + premiere equipe crees automatiquement au premier login (`clubsStore.ensureClub`). Vue `/teams` (CRUD equipes + division). RosterView : assignation d'equipe par joueur, filtre/tri par equipe. CreateMatchModal : selection de l'equipe du club concernee. PlayerProfileView : equipe affichee + detection automatique des matchs joues avec une AUTRE equipe que l'equipe actuelle du joueur ("appele en renfort"), sans historique a saisir a la main.

### Prochaines etapes :
- [ ] Appliquer la migration `20260911190000_players_matches_team_columns.sql` (colonnes `club_id`/`team_id` manquantes sur `players` et `matches` — la migration 140000 s'est arretee encore plus tot que suppose, avant meme ces ALTER TABLE ; erreur observee : "Could not find the 'team_id' column of 'players' in the schema cache") puis reessayer d'assigner une equipe a un joueur
- [ ] Verifier que la migration `20260911160000_clubs_fixes.sql` a bien ete appliquee (contrainte d'unicite `clubs_owner_id_key` + dedup d'eventuels clubs en double) — a executer si pas deja fait, avant ou apres les autres peu importe, elle est independante
- [ ] Tester en conditions reelles la fondation multi-club (creer une 2e equipe avec division — deja fait par l'utilisateur, assigner des joueurs a une equipe, verifier le filtre/tri par equipe dans l'effectif, creer un match rattache a une equipe, verifier le profil joueur)
- [ ] Phase B multi-club : reecrire les policies RLS de `players`/`matches`/`events`/`match_lineups`/`reports` pour un cloisonnement reel par equipe (aujourd'hui la securite reste basee sur `created_by` = un seul coach par club, ce qui est encore correct tant qu'il n'y a pas d'invitations)
- [ ] Phase C multi-club : invitations par email (le OWNER invite un coach sur une equipe precise via `club_members`, table deja prete avec `status PENDING/ACTIVE` et `invited_email`), UI de gestion des membres
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
| 11/09/2026 | Fondation multi-club en 3 phases (A: modele de donnees clubs/equipes maintenant, B: RLS par equipe, C: invitations par email) plutot qu'en un seul chantier | L'utilisateur n'est pas presse et veut un produit fini plutot que d'accumuler des features non compartimentees. Poser le modele de donnees (club_id/team_id) des maintenant evite de re-migrer les donnees plus tard ; la securite par equipe (RLS) et les invitations ne sont utiles qu'au moment ou un 2e coach rejoint un club, donc peuvent suivre sans risque. |
| 11/09/2026 | Le "renfort" d'un joueur dans une autre equipe du club n'est pas un historique a saisir a la main | Detecte automatiquement en comparant l'equipe du match (`matches.team_id`) a l'equipe actuelle du joueur (`players.team_id`) au moment de l'affichage du profil — plus simple qu'une table d'historique, coherent avec la demande de l'utilisateur ("un joueur peut jouer dans une autre equipe ponctuellement, ca doit etre marque quelque part") sans complexifier le modele. |

---

## Notes de Session
- Phase 4 a 7 finalisees.
- Realtime ajoute dans le tracker via `useMatchSync`.
- Generation de rapport IA operationnelle via `generate-report` (Anthropic).
- Harden de securite applique : retrait des variables sensibles cote client.
- Build production valide (`npm run build` OK) et fonction Supabase redeployee.
- 11/09/2026 : Ajout effectif de club (`players`) + selection titulaires/remplacants par match (`match_lineups`), sans placement terrain. Les evenements GOAL_FOR/YELLOW_CARD/RED_CARD/SUBSTITUTION portent desormais des references vers l'effectif (scorer_id, assist_id, player_id, player_in_id, player_out_id) a la place des anciens champs texte libre player_in/player_out. ReportView affiche un rapport nominatif sans IA (buteurs, passeurs decisifs, cartons, chronologie), independant du bloc Analyse IA. Discussion sur une migration vers Neon : ecartee pour ce projet (voir Decisions Prises), l'utilisateur reste sur Supabase.
- Build (`npm run build`) et typecheck (`vue-tsc -b`) valides apres ces changements.
- 11/09/2026 : Migration `20260911120000_players_and_lineups.sql` appliquee par l'utilisateur sur le vrai projet Supabase (SQL Editor). Parcours complet teste en conditions reelles par l'utilisateur : creation joueurs dans l'effectif, nouveau match, selection titulaires/remplacants, but avec buteur + passeur decisif, carton jaune nominatif, remplacement via liste deroulante, rapport final affichant buteurs/passeurs/cartons/chronologie — tout fonctionne.
- Bug corrige en cours de test : `RosterView.vue`, le champ numero (`<input type="number">` + v-model) pouvait renvoyer une valeur de type `number` selon le navigateur au lieu d'une chaine, faisant planter `.trim()` a la creation d'un joueur ("number.value.trim is not a function"). Fix : cast explicite `String(number.value).trim()` avant conversion en `Number`.
- PR #1 (effectif/lineups/rapport nominatif) mergee dans `main`.
- 11/09/2026 (suite) : Ajout de la vue profil joueur. Point de donnees manquant identifie : le champ `minute` des evenements est relatif a la mi-temps en cours (remis a zero par `switchHalf`), et rien n'enregistrait la duree reelle de chaque mi-temps — impossible de calculer des minutes jouees fiables sans ca. Ajout de `first_half_minutes`/`second_half_minutes` sur `matches` (migration `20260911130000_match_durations.sql`), captures dans `TrackerView` (au changement de mi-temps et a la fin du match) et persistees via `matchStore.finishMatch`. Nouveau store `playerProfile.store.ts` : agrege pour un joueur donne, a partir de `match_lineups` + `events`, le nombre de matchs joues, titularisations, entrees en jeu, buts, passes decisives, cartons, minutes jouees (total + moyenne — seulement sur les matchs dont la duree est connue, avec avertissement affiche si des matchs anciens manquent cette info). Vue `PlayerProfileView.vue` sur `/roster/:id`, accessible en cliquant un joueur dans `RosterView`.
- 11/09/2026 (suite) : Discussion sur la demande "equipes + divisions + cloisonnement multi-club". Choix de poser la fondation (clubs/equipes) avant d'ajouter la feature en surface, decoupe en 3 phases (voir Decisions Prises). Implementation de la Phase A : tables `clubs`/`teams`/`club_members`, `players`/`matches` rattaches a `club_id`+`team_id`, vue `/teams`, RosterView/CreateMatchModal mis a jour, detection auto du "renfort" dans le profil joueur. Migration `20260911140000_clubs_teams.sql`.
- 11/09/2026 (suite) : Premier essai de la migration clubs/teams par l'utilisateur en echec ("column owner_id does not exist") — la table `clubs` avait ete partiellement creee lors d'une premiere tentative. Migration reecrite pour etre rejouable sans danger (colonnes/contraintes ajoutees defensivement via `add column if not exists`, policies redefinies via `drop policy if exists` + `create policy`, backfill qui ne recree pas de club si le coach en a deja un). **Rejouee avec succes par l'utilisateur** — migrations `20260911130000_match_durations.sql` et `20260911140000_clubs_teams.sql` appliquees en prod. Reste a tester en conditions reelles (creation d'une 2e equipe, filtre/tri effectif, match rattache a une equipe).
- PR #2 (profil joueur + fondation multi-club Phase A) ouverte, pas encore mergee.
- 11/09/2026 (suite) : Premier test reel de creation d'equipe echoue ("Erreur lors de l'enregistrement.", generique) sur un club affiche "Mon club" mais 0 equipe. Cause probable : un appel `ensureClub()` precedent (dans une autre vue, ex. RosterView) a cree la ligne `clubs` puis echoue avant de creer sa premiere equipe (aucun `try/catch` autour de `ensureClub()` dans les vues, donc echec silencieux cote UI), laissant un club orphelin sans equipe que les visites suivantes recuperent tel quel (la branche "club existant" de `ensureClub()` ne verifiait pas s'il avait une equipe). Bug annexe trouve en creusant : le pattern `err instanceof Error ? err.message : fallback`, duplique dans ~14 fichiers, masquait le vrai message d'erreur Supabase des que l'objet leve n'etait pas strictement reconnu comme `Error` — nouveau helper `src/lib/errors.ts` (`extractErrorMessage`) applique partout. `ensureClub()` verifie et cree desormais une equipe par defaut si le club existant n'en a aucune (auto-reparation). Tous les appels `ensureClub()` dans les vues sont maintenant dans un `try/catch` qui affiche l'erreur reelle. Migration `20260911160000_clubs_fixes.sql` ajoutee : fusionne d'eventuels clubs en double pour un meme owner_id, ajoute la contrainte d'unicite manquante `clubs_owner_id_key`, cree une equipe par defaut pour tout club qui n'en a aucune.
- 11/09/2026 (suite) : Toujours en echec apres le fix precedent, avec cette fois le vrai message ("new row violates row-level security policy for table teams"). Diagnostic demande a l'utilisateur (requetes read-only) : `select * from pg_policies where tablename='teams'` renvoie **0 ligne** — aucune policy RLS n'existe sur `teams` en prod, alors que la migration `20260911140000_clubs_teams.sql` (qui en cree 4) avait ete reportee comme executee avec succes. La table `clubs` elle-meme est correcte (1 ligne, bon `owner_id`), et une equipe "Équipe 1" existe deja (probablement creee via le SQL editor lui-meme, qui contourne RLS — pas via l'app). Migration `20260911170000_recreate_club_policies.sql` ecrite pour recreer les 12 policies, en supposant `club_members` deja existante.
- 11/09/2026 (suite) : Cette hypothese etait fausse — l'utilisateur a essaye d'appliquer 170000 et obtenu `relation "club_members" does not exist`. Diagnostic complet : `clubs` existe (1 ligne correcte), `teams` existe (avec des donnees, mais 0 policy), `club_members` **n'existe pas du tout**. Confirme que la migration `20260911140000_clubs_teams.sql` s'est arretee en cours de route bien plus tot que suppose (avant meme de creer `club_members`), malgre le rapport de succes de l'utilisateur a l'epoque — probablement parce que le SQL editor Supabase execute les instructions sans transaction globale, et qu'un echec silencieux ou partiel n'a pas ete remarque. Migration `20260911170000` supprimee (ne pouvait pas s'appliquer) et remplacee par `20260911180000_fix_club_members.sql`, autonome : cree `club_members` de A a Z si absente, recree les 12 policies (clubs/teams/club_members), backfill la ligne `OWNER` manquante pour les clubs existants, avec verification finale.
- 11/09/2026 (suite) : Migration `20260911180000_fix_club_members.sql` appliquee avec succes par l'utilisateur — verification finale confirmee : 4 policies pour chacune des 3 tables (clubs, teams, club_members). Creation d'une 2e equipe ("Équipe Réserve · Division 3") reussie dans l'app.
- 11/09/2026 (suite) : Deux nouveaux bugs trouves en poursuivant le test. (1) Assigner une equipe a un joueur echoue avec "Could not find the 'team_id' column of 'players' in the schema cache" — confirme que la migration 140000 s'est arretee encore plus tot que prevu, avant meme d'ajouter club_id/team_id sur players et matches. Migration `20260911190000_players_matches_team_columns.sql` ecrite : ajoute les colonnes manquantes, backfill club_id (pas team_id, "Sans équipe" reste un choix valide du coach), termine par un `notify pgrst, 'reload schema'` au cas ou le cache PostgREST serait en cause. (2) Tous les `<select>` de l'app (equipe, buteur/passeur, carton, remplacement) affichaient un menu deroulant illisible (fond blanc, texte invisible) faute de `[color-scheme:dark]` — present sur l'input date de CreateMatchModal mais oublie sur les select ajoutes depuis. Ajoute aux 8 select concernes (CreateMatchModal, RosterView x2, SubstitutionModal x2, CardPlayerModal, GoalDetailsModal x2). Build et typecheck valides.
- 11/09/2026 (suite) : Migration `20260911190000` appliquee, assignation d'equipe a un joueur confirmee fonctionnelle par l'utilisateur (Marco → Équipe Réserve). Le fix `[color-scheme:dark]` sur les select etait insuffisant : sur Chrome/Windows, les `<option>` du popup natif restaient rendues en clair (fond blanc, texte illisible), `[color-scheme:dark]` n'agissant pas de facon fiable sur le contenu du popup selon navigateur/OS. Fix definitif : regle CSS globale (`select option { background-color / color }`) dans `src/assets/main.css`, qui s'applique a tous les select de l'app sans avoir a toucher chaque composant. **Pas encore reteste par l'utilisateur.**
