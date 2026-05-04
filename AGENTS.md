# AGENTS.md — Règles de Travail pour l'IA

> Ce fichier est lu à chaque début de session.  
> Il définit **comment** l'IA doit travailler sur ce projet.  
> En complément : `CLAUDE.md` (état du projet) · `tasks/lessons.md` (erreurs passées)

---

## 1. Plan Mode par Défaut

- Entrer en mode plan pour **toute tâche non-triviale** (3+ étapes ou décision architecturale)
- Si quelque chose déraille : **STOP et re-planifier immédiatement** — ne pas continuer à pousser
- Utiliser le mode plan pour les étapes de vérification, pas seulement pour la construction
- Écrire des specs détaillées en amont pour réduire l'ambiguïté

---

## 2. Stratégie de Sous-Agents

- Utiliser des sous-agents généreusement pour garder la fenêtre de contexte principale propre
- Déléguer la recherche, l'exploration et l'analyse parallèle à des sous-agents
- Pour les problèmes complexes : allouer plus de compute via des sous-agents
- **Une tâche par sous-agent** pour une exécution focalisée

---

## 3. Boucle d'Auto-Amélioration

- Après **toute correction** de l'utilisateur : mettre à jour `tasks/lessons.md` avec le pattern
- Écrire des règles qui empêchent la même erreur de se reproduire
- Itérer sans relâche sur ces leçons jusqu'à ce que le taux d'erreur baisse
- **Relire `tasks/lessons.md` en début de session** pour les patterns pertinents au projet

---

## 4. Vérification Avant de Terminer

- Ne jamais marquer une tâche comme complète sans **prouver que ça fonctionne**
- Comparer le comportement avant/après les changements quand c'est pertinent
- Se demander : _"Un ingénieur senior validerait-il ça ?"_
- Lancer les tests, vérifier les logs, démontrer la correction

---

## 5. Exiger l'Élégance (Équilibré)

- Pour les changements non-triviaux : pause et demander _"y a-t-il une approche plus élégante ?"_
- Si un fix paraît hacky : _"En sachant tout ce que je sais maintenant, implémenter la solution élégante"_
- Sauter cette étape pour les fixes simples et évidents — ne pas sur-ingénier
- Challenger son propre travail avant de le présenter

---

## 6. Correction de Bugs Autonome

- Quand on reçoit un bug report : **le corriger directement**. Pas de hand-holding.
- Pointer les logs, erreurs, tests qui échouent — puis les résoudre
- Zéro context-switching requis de l'utilisateur
- Aller corriger les tests CI qui échouent sans attendre qu'on dise comment

---

## Workflow de Gestion des Tâches

1. **Planifier d'abord** : écrire le plan dans `tasks/todo.md` avec des items cochables
2. **Valider le plan** : vérifier avant de commencer l'implémentation
3. **Suivre l'avancement** : cocher les items au fur et à mesure
4. **Expliquer les changements** : résumé haut-niveau à chaque étape
5. **Documenter les résultats** : ajouter une section review dans `tasks/todo.md`
6. **Capturer les leçons** : mettre à jour `tasks/lessons.md` après toute correction

---

## Principes Fondamentaux

- **Simplicité d'abord** : rendre chaque changement aussi simple que possible. Impacter un minimum de code.
- **Pas de paresse** : trouver les causes racines. Pas de fixes temporaires. Standards développeur senior.
