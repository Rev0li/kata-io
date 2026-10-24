# TODO - Kata.io

Liste de travail issue de l'audit du 2026-10-24. Une fois claire et stable, chaque tâche deviendra une issue GitHub.
Les règles de jeu sont dans [docs/DECISIONS.md](docs/DECISIONS.md).

> Le jeu est en production sur Vercel : chaque push sur `main` est déployé. On travaille toujours sur une branche.

## Phase 0 : filet de sécurité

- [x] Hasard de la simulation remplaçable (graine) : un match bot contre bot devient reproductible.
- [x] Vitest et tests de non-régression de la simulation (matchs à graine fixe, comparés à un instantané).

## Retours de jeu (à faire avant le retest de la phase 2)

- [ ] **Supprimer le tremblement d'écran à chaque coup** : dynamique mais illisible. Garder au plus un tremblement sur l'éjection décisive (à confirmer en jouant).
- [ ] **Indicateur de coup entrant** (remplace le cône pâle retiré) : sans lui, impossible de parer ou d'esquiver à temps. Proposition :
  - un **éclat type animé** (étoile blanche qui scintille) sur l'arme ou la tête de l'attaquant **dès la première frame** du démarrage du coup, puisque le démarrage ne dure que 150 à 240 ms ;
  - affiché **seulement quand le coup peut me toucher** (je suis à portée et dans l'angle), pour ne pas encombrer l'écran ;
  - le coup chargé garde son annonce au sol en rouge (inchangé) ;
  - si l'éclat ne suffit pas en jouant : allonger légèrement le démarrage des coups blancs.

## Phase 1 : nettoyage et refacto

- [x] Archiver les assets morts dans `archive/` (`dojo.png`, `dojo-mousse.png`, `items/gold-cup`, `silver-cup`, `gold-key`, `little-treasure-chest`).
- [x] Supprimer les commentaires périmés (`fauna.png`, `floats.png` dans `render.ts`).
- [ ] Réécrire la section « Direction artistique » du README (parle de `public/assets/bg/` et de 3 thèmes, plus vrai). **Traité dans une autre session.**
- [x] Formatage automatique Prettier (120 colonnes, `npm run format`).
- [x] Découper le rendu : `src/game/render/` (iso, palette, themes, arena, lake, effects, fighters).
- [x] Découper l'interface : `src/ui/` (dom, nav, profile, home, launch, floors, shop, lobby, result, tutobar).
- [x] Découper la simulation : `src/sim/` (core, fighter, duel, actions, hits, update, bot, snapshot).
- [x] Supprimer la variable globale `S` de la simulation (l'état de la partie est passé en paramètre).

## Phase 2 : retest

- [ ] Tester le jeu et lister ce qu'il faut enlever ou simplifier.
- [ ] Retirer ce qui a été listé.

## Phase 2b : assets remplaçables (après le retest)

Règle : chaque élément visible est décrit dans un fichier de données ; **si l'image existe, le jeu l'affiche, sinon il le dessine en code comme aujourd'hui**. Remplacer = déposer un fichier, supprimer = retirer une ligne. Aucun changement visuel tant qu'aucune image n'est déposée.

- [ ] Registre d'assets : chargeur générique qui lit les fichiers de données et applique « image si présente, sinon dessin en code ».
- [ ] Dojos en données : un dossier par dojo (`public/assets/dojos/<id>/dojo.json` + images) à la place de `THEMES` et `LIFE`.
- [ ] Plateforme en dalles (images détachables qui tombent en mort subite), planches actuelles en secours.
- [ ] Couche de décor : objets posés autour du dojo (torii, lanternes, arbres, ponts), rangés en profondeur avec les combattants.
- [ ] Combattants et armes en données : planche, taille d'image, point des pieds, échelle, poses par ligne.
- [ ] Icônes de l'interface en fichiers `public/assets/ui/*.svg` au lieu d'être écrites dans `index.html`.
- [ ] Ranger les visuels générés : sources et maquettes dans `art/source/`, images prêtes pour le jeu dans `public/assets/` (et pas dans `src/`).
- [ ] Plus tard (option) : mode éditeur `?editeur` pour placer le décor à la souris et exporter le `dojo.json`.

## Phase 3 : bugs, tests, typage

- [ ] **Bug** : quitter juste après la fin d'un match affiche quand même le résultat 1,3 s plus tard et donne l'XP d'un duel (`leave()` n'annule pas `endTimer` dans `src/ui/ui.ts`).
- [ ] **Bug** : après une déconnexion, les dernières entrées de l'invité restent appliquées côté hôte (`lost()` dans `src/net/session.ts`).
- [ ] Masquer le **mode test** en production (visible avec `?debug` ou en développement seulement).
- [ ] `/api/e` : limiter la taille des propriétés et le nombre d'événements.
- [ ] Tests unitaires : progression et XP, `sanitizeLook`, chargement du profil, compactage des entrées et des instantanés réseau, règles de combat (épuisé, parade, anti-spam).
- [ ] Typage : interfaces `Fighter` et `Sim` (aujourd'hui `any`), puis `strict` activé fichier par fichier.
- [ ] CI GitHub Actions : typecheck et tests sur chaque PR.
- [ ] Mettre à jour vite (8.3.4 → 8.3.5).

## Phase 4 : connexion

- [ ] Serveur **TURN** (relais quand la connexion directe est bloquée : 4G, wifi d'entreprise) : coturn sur le VPS ou service loué.
- [ ] Serveur de mise en relation PeerJS à nous, à la place de `0.peerjs.com`.
- [ ] Reconnexion après une coupure courte au lieu de terminer le duel.
- [ ] Plus tard : serveur autoritaire (réutilise `src/sim`) et prédiction chez le client. Hors Vercel (pas de WebSocket).

## Phase 5 : gameplay et refonte V1

- [ ] Équilibrage de la Tour (`npx tsx scripts/towercheck.ts 0.45`) : l'étage 2 (47 %) est plus dur que les étages 3 à 6, les étages 9 à 12 sont à 10 % ou moins, l'étage 5 dure 131 s.
- [ ] Trancher les questions ouvertes de DECISIONS : bonus d'équilibre (D2), affichage de son propre état (D3), indicateur de spam (D9), option « effets réduits » (D4), stockage des mesures (D12).
- [ ] **Mondes** (remplacent les six dojos, voir [docs/DIRECTION-ARTISTIQUE.md](docs/DIRECTION-ARTISTIQUE.md) section 5) : décor plein écran en isométrique trois quarts, premier plan en parallaxe, plateforme en pièces détachables. Définir le format des images (WebP, dimensions) et mettre à jour D11 (qui fixe aujourd'hui le décor en SVG).
- [ ] **Tour par mondes** : cerisiers (étages 1 à 3), bambous (4 à 6), neige (7 à 9), forge (10 à 12), puis les quatre mondes en boucle dans la tour sans fin.
- [ ] **Plus tard : de nouveaux mondes** à partir des dojos `brume` (jardin zen sous la brume) et `neon` (ville de nuit), qui n'ont pas encore de monde.
- [ ] **Classes** de combattants : profils de multiplicateurs sur `RULES` (D8).
- [ ] **Vraies armes** (aujourd'hui cosmétiques) : statistiques via les mêmes multiplicateurs (D8).
- [ ] **Inventaire** : modèle d'objets possédés et équipés (remplace la liste `owned` du profil). À terme, comptes en ligne pour ne plus dépendre du navigateur.
