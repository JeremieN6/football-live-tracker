# tasks/todo.md — Suivi des Tâches

> Fichier géré par l'IA. Mis à jour à chaque session de travail.

---

## En Cours

### PHASE 8 — Tests e2e + Monitoring
- [x] 8.1 Setup Playwright — `@playwright/test`, `playwright.config.ts`, chromium installé
- [x] 8.2 Scénario e2e `report-flow.spec.ts` — login → créer match → tracker → rapport IA
- [x] 8.3 Scripts npm — `e2e`, `e2e:headed`, `e2e:install`
- [ ] 8.4 Variables d'environnement e2e — créer `.env.e2e.local` avec `E2E_SUPABASE_EMAIL` + `E2E_SUPABASE_PASSWORD`
- [ ] 8.5 Exécution e2e réussie (test vert)
- [ ] 8.6 Monitoring erreurs (Sentry ou équivalent)
- [ ] 8.7 Revue sécurité — rotation secrets, revue RLS

---

## Complété

### PHASE 7 — Polish & Deploy (02/05/2026)
- [x] 7.1 Sécurité env — suppression des variables sensibles côté client
- [x] 7.2 Meta SEO/PWA — balises description, theme-color, OG, favicon
- [x] 7.3 PWA assets — `public/manifest.webmanifest` + icônes SVG
- [x] 7.4 Validation prod — `vue-tsc --noEmit` + `npm run build` EXIT 0
- [x] 7.5 Déploiement fonction — `npx supabase functions deploy generate-report`

### PHASE 6 — Rapport IA (02/05/2026)
- [x] 6.1 Edge Function `generate-report` (Supabase Functions)
- [x] 6.2 `report.store.ts` (fetch + generate)
- [x] 6.3 `ReportView.vue` (stats + rendu rapport IA)
- [x] 6.4 TypeScript check — `vue-tsc --noEmit` EXIT 0

### PHASE 5 — Realtime Supabase (02/05/2026)
- [x] 5.1 `useMatchSync.ts` — Supabase Realtime INSERT/DELETE sur `events` filtré par `match_id`
- [x] 5.2 Intégration `TrackerView.vue` — `subscribe()` après chargement du match
- [x] 5.3 TypeScript check — `vue-tsc --noEmit` EXIT 0 ✓

### PHASE 4 — Live Tracker (02/05/2026)
- [x] 4.1 `events.store.ts` — CRUD events + optimistic updates
- [x] 4.2 `useTimer.ts` — chronomètre MI1/MI2, setInterval, cleanup
- [x] 4.3 `MatchTimer.vue` — barre sticky score + contrôles chrono
- [x] 4.4 `PitchMap.vue` — terrain SVG cliquable + marqueurs colorés
- [x] 4.5 `ActionButtons.vue` — 3 groupes (offensif/défensif/disciplinaire) + remplacement
- [x] 4.6 `SubstitutionModal.vue` — saisie joueur entrant/sortant
- [x] 4.7 `EventLog.vue` — liste chronologique + suppression
- [x] 4.8 `TrackerView.vue` — assemblage complet + score calculé + fin de match
- [x] 4.9 `useOfflineQueue.ts` — file localStorage + flush sur window.online
- [x] 4.10 TypeScript check — `vue-tsc --noEmit` EXIT 0 ✓

---

## Complété

### PHASE 2 — Authentification (01/05/2026)
- [x] 2.1 `AuthView.vue` — formulaire login/register (email + password)
- [x] 2.2 Supabase Auth (signIn, signUp, signOut) — dans auth.store.ts
- [x] 2.3 Guard Vue Router — redirection vers /auth si non connecté
- [x] 2.4 Session persistée dans auth.store.ts
- [x] 2.5 Testé : login, logout, refresh ✓

### PHASE 1 — Setup projet (01/05/2026)
- [x] 1.1 Vite + Vue 3 + TypeScript
- [x] 1.2 @supabase/supabase-js, pinia, vue-router@4, tailwindcss, shadcn-vue
- [x] 1.3 Tailwind CSS v4 via @tailwindcss/vite
- [x] 1.4 Vue Router (routes /, /auth, /match/:id, /match/:id/report, /history)
- [x] 1.5 Pinia + auth.store.ts
- [x] 1.6 src/types/match.types.ts (copie exacte CLAUDE.md)
- [x] 1.7 src/services/supabase.ts
- [x] 1.8 Schéma SQL exécuté manuellement dans Supabase Dashboard
- [x] 1.9 .env.local configuré (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)

---

## Review de Session

<!-- L'IA ajoute ici un résumé de ce qui a été fait et les décisions prises -->

### 03/05/2026 — Correctif affichage Rapport IA
- Le backend `generate-report` produit bien un contenu complet (validation via logs RAW/PARSED/NORMALIZED).
- Correctif applique cote frontend dans le store pour parser/normaliser `reports.content` (objet JSON ou string JSON).
- Nettoyage des logs debug temporaires dans l'Edge Function puis redeploiement.
