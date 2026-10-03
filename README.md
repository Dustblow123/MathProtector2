# MathProtector 2

Jeu web d'apprentissage des tables de multiplication : des astéroïdes portant une multiplication foncent vers la Terre, tape la bonne réponse pour les détruire avec le canon.

- **Algorithme d'apprentissage** : modèle par fait (Bayesian Knowledge Tracing + répétition espacée + fluidité), scheduler adaptatif (nouveaux faits / en apprentissage / révisions dues / entretien), réinjection immédiate des erreurs, pratique contrastive sur les confusions (6×7 ↔ 6×8), contrôleur de difficulté visant 80–85 % de réussite.
- **Modes** : Campagne (10 secteurs, 5 vagues + boss), Survie, Blitz 60 s, Entraînement, Boss Rush, Défi du jour.
- **Boss** : Titan, Hydre, Miroir (facteur manquant), Chrono, Vaisseau-mère.
- **Powerups** : Gel temporel, Bouclier, Nova, Laser de table, Score ×2, Oracle.
- **Progression** : XP et niveaux, étoiles, succès, poussière d'étoiles, Hangar de cosmétiques (canons, traînées, explosions, planètes, nébuleuses, réticules).
- **Multi-profils** + espace parent (grille de maîtrise 10×10, stats, confusions, tables prioritaires, export/import JSON).
- Interface FR/EN, clavier ou pavé numérique tactile, audio procédural (aucun fichier son), PWA installable.

## Démarrer

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # tests unitaires (moteur d'apprentissage, simulation de jeu, stockage)
pnpm typecheck
pnpm build      # dist/ (base /MathProtector2/ pour GitHub Pages)
pnpm preview    # sert dist/ sur http://localhost:4173/MathProtector2/
```

Tests de bout en bout (Chromium via Playwright, serveur `pnpm preview` lancé) :

```bash
node e2e/play.mjs /tmp/shots     # parcours complet desktop + captures
node e2e/boss.mjs /tmp/shots     # boss rush des cinq boss
node e2e/mobile.mjs /tmp/shots   # portrait tactile avec pavé numérique
```

## Commandes en jeu

| Touche | Action |
|---|---|
| 0–9 | Taper la réponse (tir automatique dès qu'elle correspond) |
| Entrée / Espace | Tirer |
| Retour arrière | Effacer |
| Tab ou clic/tap sur un astéroïde | Changer de cible |
| F1 / F2 / F3 | Utiliser un powerup |
| Échap | Pause |

## Structure

```
src/learning/     moteur pédagogique (pur, testé) : modèle, scheduler, curriculum, confusions, flow
src/game/         simulation (sans DOM) : Game, entités, boss, modes, powerups, scoring
src/render/       rendu Canvas : fond, sprites procéduraux, particules, effets, Renderer
src/app/          écrans DOM (profils, menu, campagne, modes, jeu/HUD, résultats, hangar, succès, parent, réglages)
src/progression/  cosmétiques, succès, déblocages, application d'une session au profil
src/data/         profils et persistance localStorage versionnée
src/audio/        synthèse Web Audio (effets + musique générative)
src/i18n/         dictionnaires fr/en
tests/            Vitest
e2e/              scripts Playwright
```

## Déploiement

Le workflow `.github/workflows/deploy.yml` construit et publie `dist/` sur GitHub Pages à chaque push sur la branche par défaut (activer Pages → Source « GitHub Actions » dans les réglages du dépôt).
