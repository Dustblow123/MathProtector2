# MathProtector 2

Jeu web d'apprentissage des tables de multiplication : des astéroïdes portant une multiplication foncent vers la Terre, tape la bonne réponse pour les détruire avec le canon.

- **Algorithme d'apprentissage** : modèle par fait (Bayesian Knowledge Tracing + répétition espacée + fluidité), scheduler adaptatif (nouveaux faits / en apprentissage / révisions dues / entretien), réinjection immédiate des erreurs, pratique contrastive sur les confusions (6×7 ↔ 6×8), contrôleur de difficulté visant 80–85 % de réussite.
- **Divisions** (sélecteur × / ÷ / les deux au lancement d'une partie, sur la carte de campagne et l'écran des modes) : chaque division est une multiplication lue à l'envers (56 ÷ 7 = 8 vient de 7 × 8), donc **le résultat est toujours entier**, sans reste. La maîtrise des divisions est suivie séparément de celle des multiplications (deux grilles dans l'espace parent, révision du jour pour chaque sens, seuil de rapidité ×1,25). Les cartes de méthode, le mini-drill, les boss et la voix s'adaptent (Miroir : « ? ÷ 7 = 8 »).
- **Modes** : Campagne (10 secteurs au choix libre, 5 vagues + boss, les tables terminées reviennent en révision), Patrouille (révision automatique des tables terminées), Survie, Blitz 60 s, Entraînement, Boss Rush, Défi du jour.
- **Boss** : Titan, Essaim (drones qui piquent), Hydre, Jumeaux (commutativité), Miroir (facteur manquant), Fantôme (rappel de mémoire), Chrono, Vaisseau-mère.
- **Powerups** : Gel temporel, Bouclier, Nova, Laser de table, Score ×2, Oracle. Les destructions par powerup ne comptent pas dans la précision.
- **Équipement à effet** : six projectiles (trait, missile sinueux, givre, double tir, onde de choc, éclair à rebond) et huit canons avec un bonus chacun (+1 bouclier, projectiles plus rapides, indices plus tôt, plus de cristaux…).
- **Économie** : la poussière d'étoiles ✦ (monnaie du Hangar) se gagne lentement : environ 100 ✦ par secteur complet joué parfaitement (taux `STARDUST_RATE` dans `src/game/scoring.ts`), récompenses de succès de 10 à 250 ✦.
- **Progression** : XP et niveaux, étoiles, succès, poussière d'étoiles, Hangar de cosmétiques (traînées, explosions, planètes, nébuleuses, réticules).
- **Révision du jour** : le menu compte les faits dont la rétention estimée est passée sous 90 % et propose une session courte qui les sert en priorité. **Mini-drill** de 5 questions flash sur les faits ratés après chaque partie. **Calibrage automatique** du seuil de rapidité sur les temps de réponse réels (désactivable dans l'espace parent).
- **Cartes de méthode** à la demande (touche H ou bouton « ? ») : le jeu se fige 10 s et une carte montre une vraie stratégie de calcul (×9 = ×10 − a, ×6 = ×5 + a, double du double, fait voisin connu…) avec un visuel de décomposition. Coût : combo remis à zéro et pas de bonus de vitesse (gratuit en Entraînement). Lecture vocale optionnelle (Web Speech). **Accessibilité** : police Lexend, grand texte, palette daltonisme, contraste élevé.
- **Événements de vague** (pluie de météores, poussière ×2, ruée vers les cristaux, ère glaciaire, boss surprise) et **défi de la semaine** seedé avec boss tiré au sort.
- **Multi-profils** + espace parent (grille de maîtrise 10×10, stats, confusions, tables prioritaires, export/import JSON).
- Interface FR/EN, clavier ou pavé numérique tactile, audio procédural (aucun fichier son), PWA installable.

## Jouer sans rien installer

Ouvre **`dist/index.html`** dans Chrome, Firefox ou Safari (double-clic suffit) : le jeu est entièrement contenu dans ce fichier. Le fichier `index.html` à la racine est la source du projet et ne fonctionne qu'avec le serveur de développement.

## Démarrer (développement)

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # tests unitaires (moteur d'apprentissage, simulation de jeu, stockage)
pnpm typecheck
pnpm build      # dist/index.html autonome (JS, CSS et polices inlinés)
pnpm preview    # sert dist/ sur http://localhost:4173/
```

Tests de bout en bout (Chromium via Playwright, serveur `pnpm preview` lancé) :

```bash
node e2e/play.mjs /tmp/shots     # parcours complet desktop + captures
node e2e/boss.mjs /tmp/shots     # boss rush des cinq boss
node e2e/mobile.mjs /tmp/shots   # portrait tactile avec pavé numérique
node e2e/v2.mjs /tmp/shots       # campagne libre, projectiles, patrouille, hangar
node e2e/v3.mjs /tmp/shots       # révision du jour, mini-drill, défi hebdo, accessibilité
node e2e/mobile3.mjs /tmp/shots  # HUD portrait et paysage
node e2e/help.mjs /tmp/shots     # carte de méthode : gel, coût, fermeture automatique
node e2e/division.mjs /tmp/shots # divisions : sélecteur, parties ÷ et mixte, drill, deux grilles parent
```

## Commandes en jeu

| Touche | Action |
|---|---|
| 0–9 | Taper la réponse (tir automatique dès qu'elle correspond) |
| Entrée / Espace | Tirer |
| Retour arrière | Effacer |
| Tab ou clic/tap sur un astéroïde | Changer de cible |
| F1 / F2 / F3 | Utiliser un powerup |
| H ou ? | Carte de méthode (fige le jeu) |
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
