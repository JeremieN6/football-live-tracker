# tasks/lessons.md — Leçons Apprises

> Ce fichier est relu **en début de chaque session** pour éviter de répéter les mêmes erreurs.  
> Mis à jour après **toute correction** de l'utilisateur.

---

## Format d'entrée

```
### [Date] — Titre court du problème

**Problème original** :  
Décrire ce qui s'est passé / l'erreur commise.

**Cause racine** :  
Pourquoi c'est arrivé.

**Solution appliquée** :  
Ce qui a été fait pour corriger.

**Règle à retenir** :  
> La règle courte et actionnable pour ne pas répéter l'erreur.
```

---

## Leçons

### [02/05/2026] — Supabase CLI introuvable dans PowerShell

**Problème original** :  
La commande `supabase functions deploy ...` echouait avec `CommandNotFoundException`.

**Cause racine** :  
Le binaire global Supabase CLI n'etait pas installe (ou pas dans le PATH).

**Solution appliquée** :  
Execution via `npx supabase ...` puis deploiement reussi.

**Règle à retenir** :  
> Si `supabase` n'est pas reconnu, utiliser `npx supabase` avant toute autre action.

### [02/05/2026] — Secret IA expose dans les variables frontend

**Problème original** :  
Une cle IA et une URL DB sensible etaient presentes dans `.env.local` client.

**Cause racine** :  
Confusion entre secrets backend (Edge Functions) et variables build frontend.

**Solution appliquée** :  
Suppression des variables sensibles du client ; conservation de la cle uniquement dans les secrets Supabase.

**Règle à retenir** :  
> Ne jamais mettre de secret serveur dans `.env.local` frontend ; utiliser `supabase secrets set`.

### [03/05/2026] — Rapport IA vide malgre une generation valide

**Problème original** :  
Le rapport s'affichait vide dans l'UI alors que l'Edge Function retournait un JSON complet avec `summary`, `offensive`, `defensive`, `tactical`, `improvements`.

**Cause racine** :  
Le champ `reports.content` n'etait pas normalise cote frontend : selon la source (DB/Fn), il peut arriver en objet JSON ou en string JSON. Le store faisait un cast TypeScript direct sans parsing robuste.

**Solution appliquée** :  
Ajout d'un parseur `parseReportContent` dans `report.store.ts` pour gerer string/objet, valider les champs et appliquer des fallbacks non vides.

**Règle à retenir** :  
> Ne jamais faire confiance a un cast TypeScript sur un JSON backend ; parser et normaliser les payloads avant rendu UI.
