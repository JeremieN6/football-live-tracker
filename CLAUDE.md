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
**Phase** : Phase 7 terminee
**Derniere session** : 02/05/2026
**Progression globale** : 100% MVP

### Ce qui est fait :
- [x] Phase 1 — Setup projet et architecture
- [x] Phase 2 — Authentification Supabase
- [x] Phase 3 — Gestion des matchs
- [x] Phase 4 — Live Tracker complet
- [x] Phase 5 — Realtime Supabase sur events
- [x] Phase 6 — Rapport IA + edge function
- [x] Phase 7 — Polish SEO/PWA + validation build/deploy

### Prochaines etapes :
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

---

## Notes de Session
- Phase 4 a 7 finalisees.
- Realtime ajoute dans le tracker via `useMatchSync`.
- Generation de rapport IA operationnelle via `generate-report` (Anthropic).
- Harden de securite applique : retrait des variables sensibles cote client.
- Build production valide (`npm run build` OK) et fonction Supabase redeployee.
