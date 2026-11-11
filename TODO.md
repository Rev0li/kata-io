# TODO - Kata.io

Liste de travail issue de l'audit du 2026-10-24. Une fois claire et stable, chaque tâche deviendra une issue GitHub.
Les règles de jeu sont dans [docs/DECISIONS.md](docs/DECISIONS.md).

> Le jeu est en production sur Vercel : chaque push sur `main` est déployé. On travaille toujours sur une branche.

## Phase 0 : filet de sécurité

- [x] Hasard de la simulation remplaçable (graine) : un match bot contre bot devient reproductible.
- [x] Vitest et tests de non-régression de la simulation (matchs à graine fixe, comparés à un instantané).

## Retours de jeu (à faire avant le retest de la phase 2)

- [x] **Supprimer le tremblement d'écran à chaque coup** : dynamique mais illisible. Garder au plus un tremblement sur l'éjection décisive (à confirmer en jouant).
- [x] **Indicateur de coup entrant** (remplace le cône pâle retiré) : sans lui, impossible de parer ou d'esquiver à temps. Proposition :
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

## Version minimale (D14, 2026-11-06)

- [x] Un seul défi : montée de la Tour depuis l'étage 1 jusqu'à la défaite, classement par pseudo (`api/classement.js`).
- [x] Tout débloqué dès le départ, tutoriel facultatif ; défi du jour, duel et boutique grisés « Bientôt ».
- [x] Brancher la base Upstash Redis sur Vercel (fait le 2026-11-06, classement ouvert).
- [ ] Contrôle anti-triche souple pour l'instant (8 s par étage au moins). Vraie validation prévue : la simulation est à graine (phase 0), donc le jeu peut envoyer la graine et les entrées de chaque combat, et le serveur rejoue la montée avec `src/sim` pour vérifier le résultat au lieu de croire le score envoyé.
- [x] Prototype énergie et lisibilité : frapper et parer coûtent du souffle (l'anti-spam n'agit plus), souffle et qi sous son combattant, pourcentages cachés pour les deux, remplacés par trois paliers visibles (sueur, rouge et vapeur, chancelle). À régler en jouant.
- [x] Prototype d'éjection en l'air (D15) : vol avec ombre, moins de freinage en l'air, plouf loin, « étoile » pour les plus gros coups, un seul rattrapage au bord par manche et jamais après une projection.
- [x] Styles de combat (D16) : arme fondue dans le personnage, 4 styles (jeu de coups et profil), gardiens au style de leur personnage.
- [x] Accueil simplifié : Jouer (avec ton record), ton combattant (choisir son personnage remplace le vestiaire), Tutoriel et Entraînement, top 10 en cascade, défi du jour et duel grisés en bas ; mode test caché en production (visible en développement, avec ?debug ou ?test).
- [x] Fluidité : Entrée lance Jouer depuis l'accueil ; Recommencer et l'étage suivant partent sans compte à rebours (« COMBAT ! » en une demi-seconde).
- [x] Trois vies par montée (2026-11-11) : une défaite coûte une vie, on retente l'étage (`src/ui/montee.ts`).
- [x] Tutoriel complet (2026-11-11) : dix étapes, toutes les techniques, « Étape suivante » (`TUTO_COMPLET`).
- [x] Zoom et textes du combat selon la taille de l'écran (D17), accueil affiché sans attendre Phaser (D18).
- [x] Trois vies fixes, décidé le 2026-11-11 : on n'en regagne pas en cours de montée.
- [ ] À valider en jouant : tutoriel complet (longueur, étape « élan »), zoom sur grand écran.
- [ ] Après les premiers retours : faut-il un temps limite, un classement de la semaine ?

## Phase 2b : assets remplaçables (après le retest)

Règle : chaque élément visible est décrit dans un fichier de données ; **si l'image existe, le jeu l'affiche, sinon il le dessine en code comme aujourd'hui**. Remplacer = déposer un fichier, supprimer = retirer une ligne. Aucun changement visuel tant qu'aucune image n'est déposée.

- [ ] Registre d'assets : chargeur générique qui lit les fichiers de données et applique « image si présente, sinon dessin en code ».
- [ ] Mondes en données (voir [docs/DIRECTION-ARTISTIQUE.md](docs/DIRECTION-ARTISTIQUE.md) section 5) : un dossier par monde (`public/assets/mondes/<id>/monde.json` + images) à la place de `THEMES` et `LIFE`, avec les couches de la direction artistique : scène plein écran, matière autour de la plateforme (eau, glace, lave), plateforme, combattants et effets, premier plan en parallaxe. Les six dojos actuels deviennent des mondes « dessinés en code » en attendant leurs images.
- [ ] Plateforme en pièces détachables (images qui tombent en mort subite), planches actuelles en secours.
- [ ] Couche de décor posé et premier plan : objets autour de la plateforme (torii, lanternes, arbres, ponts) rangés en profondeur avec les combattants, et éléments de premier plan qui bougent plus vite que la caméra. **Prototype fait le 2026-10-24 pour les quatre mondes** (`src/game/render/world.ts` et `worlds.ts`), à passer en données avec le registre d'assets.
- [ ] Combattants et armes en données : planche, taille d'image, point des pieds, échelle, poses par ligne. Décidé le 2026-10-25 : on garde le pixel art du pack, affiché à 4 px par pixel (`FIGHTER_PX` dans `src/game/assets.ts`, `?px=` pour comparer) ; le pantin découpé a été essayé puis abandonné.
- [ ] Icônes de l'interface en fichiers `public/assets/ui/*.svg` au lieu d'être écrites dans `index.html`.
- [ ] Ranger les visuels générés : sources et maquettes dans `art/source/`, images prêtes pour le jeu dans `public/assets/` (et pas dans `src/`).
- [ ] Plus tard (option) : mode éditeur `?editeur` pour placer le décor à la souris et exporter le `dojo.json`.

## Phase 3 : bugs, tests, typage

- [x] **Bug** : quitter juste après la fin d'un match affiche quand même le résultat 1,3 s plus tard et donne l'XP d'un duel (`leave()` n'annule pas `endTimer` dans `src/ui/ui.ts`).
- [x] **Bug** : après une déconnexion, les dernières entrées de l'invité restent appliquées côté hôte (`lost()` dans `src/net/session.ts`).
- [x] Masquer le **mode test** en production (visible avec `?debug`, `?test` ou en développement seulement).
- [x] Mesures de jeu : taille des propriétés et nombre d'événements limités dans le serveur de jeu (`server/classement.ts`) ; l'ancien `/api/e` disparaît à la bascule.
- [ ] Tests unitaires : progression et XP, `sanitizeLook`, chargement du profil, compactage des entrées et des instantanés réseau, règles de combat (épuisé, parade, anti-spam).
- [ ] Typage : interfaces `Fighter` et `Sim` (aujourd'hui `any`), puis `strict` activé fichier par fichier.
- [x] CI GitHub Actions : format, types, tests, `npm run sim` et build sur chaque PR (`.github/workflows/ci.yml`).
- [ ] Mettre à jour vite (8.3.4 → 8.3.5).

## Backend (D19, voir [docs/BACKEND.md](docs/BACKEND.md))

Étape 1 : classement vérifié par rejeu et mesures de jeu en base.

- [x] Simulation reproductible sur toutes les machines (`src/sim/dmath.ts`), enregistrement et rejeu d'un combat (`src/sim/rejeu.ts`).
- [x] Serveur de jeu (`server/`) : graine donnée par le serveur, rejeu de la montée, records et mesures dans PostgreSQL, Docker.
- [x] Jeu branché si `VITE_API_JEU` est définie (ticket d'avance, combats enregistrés, montée non classée sans ticket).
- [x] Déployer sur le VPS : `docker compose`, Caddy, relais dans `vercel.json` (fait le 2026-11-11).
- [x] Montée validée sur iPhone depuis un aperçu, production branchée (`.env.production`, 2026-11-11).
- [x] Ancien classement supprimé du dépôt (`api/classement.js`, `api/e.js`, leur test).
- [ ] Supprimer la base Upstash dans Vercel (onglet Storage).
- [ ] Déployer le serveur automatiquement à chaque fusion qui touche `src/sim` ou `server/` (sinon montées non classées entre les deux).
- [ ] Typage strict de `src/sim` (`Fighter`, `Sim`), dont le serveur dépend maintenant.

Étape 2 : comptes (phase 4b ci-dessous). Étape 3 : duels en salles autoritaires (remplace le serveur TURN et PeerJS de la phase 4).

## Phase 4 : connexion

- [ ] Serveur **TURN** (relais quand la connexion directe est bloquée : 4G, wifi d'entreprise) : coturn sur le VPS ou service loué.
- [ ] Serveur de mise en relation PeerJS à nous, à la place de `0.peerjs.com`.
- [ ] Reconnexion après une coupure courte au lieu de terminer le duel.
- [ ] **Partie publique** (bouton « Bientôt » de l'accueil) : affronter un joueur au hasard sans code. Sans serveur : le premier qui cherche ouvre une salle PeerJS à un nom connu de tous, le suivant la rejoint. À tester à deux sur deux machines.
- [ ] Plus tard : serveur autoritaire (réutilise `src/sim`) et prédiction chez le client. Hors Vercel (pas de WebSocket).

## Phase 4b : comptes joueurs (voir [docs/COMPTES.md](docs/COMPTES.md))

- [ ] Service comptes sur le VPS : BetterAuth + PostgreSQL (instance séparée de rev0auth), comptes invités, Google et Discord.
- [ ] API du profil : lire, écrire, fusionner (avec tests).
- [ ] Côté jeu : compte invité créé en silence, profil synchronisé, reprise du profil local existant.
- [ ] Interface : « Protège ta progression » (dès l'étage 3 gagné), « J'ai déjà un compte », « Se déconnecter », « Supprimer mon compte ».
- [ ] Duel public et classement du défi du jour réservés aux comptes protégés.
- [ ] Domaine `kata.rev0li.duckdns.org` servi par Caddy (jeu + API).
- [ ] Mode test désactivé pour les comptes protégés.

## Phase 5 : gameplay et refonte V1

- [ ] Équilibrage de la Tour (`npm run tour`, mesure du 2026-11-11 en manche unique, joueur simulé 0,45) : étages 1 à 4 autour de 90 %, l'étage 7 (35 %) est plus dur que les étages 8 à 10 (50 à 58 %), les étages 13 et 14 tombent à 10 % puis les suivants remontent à 30 %.
- [ ] Trancher les questions ouvertes de DECISIONS : bonus d'équilibre (D2), affichage de son propre état (D3), indicateur de spam (D9), option « effets réduits » (D4), stockage des mesures (D12).
- [ ] **Mondes** (remplacent les six dojos, voir [docs/DIRECTION-ARTISTIQUE.md](docs/DIRECTION-ARTISTIQUE.md) section 5) : décor plein écran en isométrique trois quarts, premier plan en parallaxe, plateforme en pièces détachables. **Jouables en entraînement et en duel depuis le 2026-10-24** (cerisiers, bambous, temple enneigé, forge), avec des éléments provisoires découpés dans les planches (`public/assets/mondes/`). Restent : images définitives, plateforme en pièces, plouf adapté à la glace et à la lave. Définir le format des images (WebP, dimensions) et mettre à jour D11 (qui fixe aujourd'hui le décor en SVG).
- [ ] **Tour par mondes** : cerisiers (étages 1 à 3), bambous (4 à 6), neige (7 à 9), forge (10 à 12), puis les quatre mondes en boucle dans la tour sans fin.
- [ ] **Plus tard : de nouveaux mondes** à partir des dojos `brume` (jardin zen sous la brume) et `neon` (ville de nuit), qui n'ont pas encore de monde.
- [ ] **Classes** de combattants : profils de multiplicateurs sur `RULES` (D8).
- [ ] **Vraies armes** (aujourd'hui cosmétiques) : statistiques via les mêmes multiplicateurs (D8).
- [ ] **Inventaire** : modèle d'objets possédés et équipés (remplace la liste `owned` du profil). À terme, comptes en ligne pour ne plus dépendre du navigateur.
