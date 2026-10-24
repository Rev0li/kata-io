# Kata.io

Duel de kung-fu en 1 contre 1, sur invitation. On frappe, on pare, on esquive, et on envoie son adversaire dans le lac qui entoure le dojo. Premier à 3 éjections.

Version de développement : Phaser 4, TypeScript et Vite, avec une connexion pair à pair (WebRTC via PeerJS). Le site est entièrement statique et se déploie tel quel sur Vercel.

## Progression

On commence ceinture blanche avec seulement **Frapper** et **Esquiver**. Chaque ceinture, gagnée avec l'XP, débloque une technique, avec un exercice de 20 secondes contre le mannequin :

| Ceinture | XP | Technique |
|---|---|---|
| Blanche | 0 | Frapper et Esquiver |
| Jaune | 100 | Enchaînement de 2 coups |
| Orange | 250 | Parade |
| Verte | 450 | Coup chargé |
| Bleue | 700 | Finisseur (3e coup, +35 % de recul) |
| Marron | 1 000 | Élan (esquive au dernier moment) |
| Noire | 1 400 | Paume du dragon |

La **Tour du temple** est le mode solo : 12 gardiens, puis une tour sans fin. Chaque étage rapporte 1 à 3 étoiles (victoire, sans perdre de manche, sous le temps de référence). Le tutoriel d'une minute se lance avant le premier étage. Les gardiens utilisent les techniques de leur ceinture. En duel entre amis, les deux joueurs ont toutes les techniques.

Ce qui donne envie de rejouer :

- **Gardiens à collectionner** : battre un gardien pour la première fois débloque son apparence (14 combattants). Les gardiens pas encore battus apparaissent grisés dans la liste des étages.
- **Armes** : katana, saï, yari, massue, trident, hache, nodachi, gagnées avec les ceintures. Elles sont purement cosmétiques.
- **Avant-goût** : le gardien connaît la technique que tu vas débloquer à ta prochaine ceinture, et le jeu te le dit.
- **Essais** : le gardien nargue quand tu reviens après une défaite (« Encore toi ? »). La victoire affiche « Battu au 4e essai ».
- **Série** : chaque étage gagné d'affilée multiplie l'XP et les pièces (×1,5, ×2… jusqu'à ×3). Une défaite remet la série à zéro.
- **Défi du jour** : un adversaire tiré de la date, le même pour tout le monde. La première victoire du jour rapporte 50 pièces, puis on peut améliorer son temps.
- **Mort subite** : après 25 s de manche, le dojo rétrécit et ses planches tombent à l'eau.
- **Balle de match** : annonce, battement de cœur et vignette rouge ; l'éjection décisive passe au ralenti.
- **Bonus** : « Parfait » (manche gagnée sans être touché, +5 pièces) et « Sauvé ! » (rattrapé au bord puis remonté, +2 pièces).

## Boutique d'effets

Les **pièces** se gagnent en jouant : Tour (plus avec les étoiles, la première victoire et la série), défi du jour, entraînement et duels. Rien ne s'achète en euros.

| Traînées de coup | Ploufs d'éjection |
|---|---|
| Braises, pétales de cerisier, fumée d'ombre, poussière d'étoiles, vague, shurikens, pluie d'or | Encre, tempête de pétales, cochon volant, fantôme, feu d'artifice, trésor englouti, phénix |

La traînée suit le bout de l'arme pendant le coup, au premier plan et en transparence. Le plouf est celui du joueur qui éjecte, donc l'adversaire le voit aussi. Dans la boutique, chaque effet se joue en situation derrière le panneau : ton combattant frappe un mannequin pour une traînée, ou l'envoie à l'eau pour un plouf.

## Mode test

Le panneau **Mode test** de l'accueil permet de :

- choisir sa ceinture ;
- choisir les étages débloqués (ce qui débloque aussi les combattants) ;
- choisir le niveau du bot d'entraînement ;
- ajouter un nombre de pièces au choix ;
- tout réinitialiser.

`npx tsx scripts/towercheck.ts 0.45` simule un joueur moyen qui monte la Tour (pourcentage de victoires par étage).

## Jouer

1. **Créer un duel privé** : la page affiche un code de salle et un lien d'invitation.
2. Envoyer le lien à son adversaire. Le duel commence dès qu'il l'ouvre et clique sur « Rejoindre le duel ».
3. À la fin, chacun peut demander une revanche ; elle démarre quand les deux l'ont demandée.

**S'entraîner** lance un duel contre un bot (Disciple, Adepte ou Maître), sans réseau.

| Action | Clavier et souris | Tactile |
|---|---|---|
| Se déplacer | ZQSD, WASD ou flèches | Joystick à gauche |
| Viser | Automatique vers l'adversaire (comme sur mobile) ; souris si on désactive la visée automatique dans les réglages | Automatique vers l'adversaire |
| Frapper (coup blanc) | Clic gauche ou J, appui court | Frapper |
| Coup chargé rouge | Maintenir clic gauche ou J | Maintenir Frapper |
| Parer | Clic droit ou K | Parer |
| Esquiver | Espace ou Shift | Esquive |
| Emotes | 1 à 4 | Emote |
| Quitter | Échap | Bouton Quitter |

Le triangle : la parade bat le coup blanc, le coup rouge brise la parade, un coup blanc interrompt une charge. L'esquive évite tout mais coûte un souffle sur trois. Plus le pourcentage est haut, plus on vole loin.

## Développement

```bash
npm install
npm run dev        # serveur de dev Vite sur http://localhost:5173
npm run build      # vérification TypeScript puis build de production dans dist/
npm run preview    # sert le build de production
npm run sim        # duels bot contre bot dans le terminal, pour vérifier l'équilibrage
npm test           # tests Vitest (non-régression de la simulation)
```

**Tests de non-régression** : `tests/sim.golden.test.ts` joue des matchs à graine fixe (`createSim(specs, { seed })`) et compare leur résumé à `tests/__snapshots__/`. Si un réglage de `RULES` change volontairement le combat, accepter les nouveaux résumés avec `npm test -- -u`. Sinon, un échec signale une régression.

**Tester un duel seul sur sa machine** : ouvrir `http://localhost:5173/?net=local`, créer un duel, puis ouvrir le lien d'invitation dans un deuxième onglet du même navigateur. Les deux onglets communiquent par `BroadcastChannel`, sans passer par Internet.

**Débogage** : ajouter `?debug` à l'adresse expose `window.__kata` (`game`, `session`) dans la console, y compris sur le build de production.

## Architecture

```
src/
  sim/data.ts        réglages, gardes, coups, apparences (aucune dépendance)
  sim/progression.ts ceintures, techniques débloquées, étages de la Tour, étoiles, XP
  sim/sim.ts         simulation du duel, bot d'entraînement, instantanés réseau
  net/transport.ts   connexion PeerJS (production) ou BroadcastChannel (?net=local)
  net/session.ts     modes entraînement / hôte / invité, revanche, ping
  game/assets.ts     chargement des sprites (personnages, armes, effets, sol)
  game/render.ts     rendu Phaser en vue isométrique 2:1 : dojo (losange dessiné en code), thèmes d'ambiance, combattants en sprites, cônes, traînées, ploufs, particules
  game/audio.ts      sons et musique synthétisés en WebAudio (aucun fichier audio)
  game/tutorial.ts   étapes du tutoriel et exercices par technique
  ui/actionbar.ts    barre d'actions animée (boutons sur mobile, indicateurs sur ordinateur)
  scenes/GameScene   boucle de jeu, caméra, souris
  scenes/HudScene    interface en jeu (pourcentages, souffle, qi, score)
  ui/ui.ts           écrans HTML : accueil, Tour, boutique, salon, résultat
  ui/viewstate.ts    état partagé entre l'interface et la scène (boutique ouverte)
  ui/controls.ts     clavier et commandes tactiles
scripts/simcheck.ts  test de la simulation hors navigateur
scripts/towercheck.ts équilibrage de la Tour
scripts/build-assets.py assemble les sprites du pack Ninja Adventure dans public/assets
scripts/build-decor-svg.py génère le décor vectoriel (horizons, poissons, flottants) dans public/assets/decor
```

**Modèle réseau** : le joueur qui crée la salle est l'**hôte**. Son navigateur fait tourner la simulation à 60 pas par seconde et arbitre chaque coup. L'**invité** envoie ses entrées (déplacement, visée, boutons) et reçoit 30 instantanés par seconde avec les événements à afficher (impacts, sons, textes). La simulation (`src/sim`) ne dépend ni de Phaser ni du DOM : c'est le module qui passera tel quel sur un serveur dédié.

Messages échangés :

| De | Message | Contenu |
|---|---|---|
| Invité | `hello` | nom et apparence |
| Hôte | `welcome` | les deux combattants |
| Invité | `in` | entrées compactées, à chaque changement et au moins toutes les 100 ms |
| Hôte | `s` | instantané de l'état et événements depuis le dernier envoi |
| Les deux | `rematch` | demande de revanche ; l'hôte répond `restart` quand les deux l'ont demandée |
| Hôte | `away` | l'onglet de l'hôte est en arrière-plan, le combat est en pause |
| Les deux | `ping` / `pong` | mesure de la latence affichée en jeu |

## Dojos et décor

Six ambiances en **SVG vectoriel** : `coucher`, `bambou`, `brume`, `neige`, `neon`, `volcan`. La Tour change de dojo tous les deux étages dans cet ordre, puis recommence ; le défi du jour en tire un d'après la date. En duel entre amis, l'hôte choisit le dojo dans le salon (ou « au hasard ») et il est transmis à l'invité. `?theme=<nom>` force une ambiance.

Les éléments importants de chaque horizon sont groupés au centre (entre x=500 et x=1900 sur 2400) : c'est la zone visible sur téléphone en paysage comme sur ordinateur.

Chaque dojo a ses poissons (koï, carpes, poissons-lanternes, poissons de braise), ses objets flottants (nénuphars, glace, roches de lave, lanternes) et ses particules (pétales, feuilles, neige, lucioles, braises). Chaque poisson est un seul SVG déformé en tranches (Rope Phaser) : une onde de nage le parcourt de la tête à la queue, la queue se déporte dans les virages, et il avance par à-coups puis glisse. Ils sont petits, translucides et teintés par l'eau pour se fondre dans le décor, et ils effleurent la surface de temps en temps. Ils nagent sous le dojo, s'enfuient après un plouf ou un gros coup, et les nénuphars sont repoussés par les remous. L'eau scintille.

Tout est généré par `python3 scripts/build-decor-svg.py` (aucun asset externe) dans `public/assets/decor/` : `bg-<dojo>.svg`, `fish-<espèce>.svg`, `float-<nom>.svg`. Ce sont des SVG propres, retouchables dans Inkscape ou Penpot ; pour changer un décor, modifier le script ou le fichier.

## Sensation de combat

Le cône pâle des petits coups est supprimé (il brouillait le combat) : seul le coup chargé est annoncé au sol.

Arrêt sur image et tremblement d'écran à l'impact, lignes de vitesse (éclat radial et traînées dans le sens du recul, plus fortes pour le coup chargé et la paume du dragon), flashs de couleur plein écran (blanc, rouge, doré), petit coup de zoom à l'impact et zoom marqué avec trois éclats de lignes sur l'éjection décisive.

## Explications en jeu

Le jeu explique ce qui arrive, sans tutoriel supplémentaire : indice la première fois que le souffle tombe à zéro (« Souffle épuisé »), message de spam (« Tu martèles l'attaque… »), et, à chaque éjection, la cause (épuisé, pourcentage élevé, ou bord du dojo). Les indices ponctuels s'arrêtent après 3 à 4 affichages (mémorisés dans le navigateur).

## Mesures de jeu

`src/analytics.ts` envoie des événements anonymes (identifiant aléatoire local, pas de donnée personnelle) à `/api/e`, une fonction Vercel (`api/e.js`) qui les écrit en JSON dans les journaux Vercel (`k:"kata_e"`). Désactivé en local (sauf `?analytics`) et si le navigateur demande « ne pas suivre ». `VITE_ANALYTICS_URL` remplace l'adresse de réception.

| Événement | Contenu |
|---|---|
| `page_view` | appareil, taille d'écran, invitation ouverte ou non |
| `play_clicked` | tour, défi du jour, entraînement, création de duel |
| `tutorial_started`, `tutorial_completed` | exercice ou tutoriel complet |
| `match_started` | mode, étage, niveau, dojo, revanche ou non |
| `match_ended` | résultat, score, durée, coups donnés et reçus, parades, esquives parfaites, déclenchements et blocages d'anti-spam, coups reçus en étant épuisé, éjections |
| `match_abandoned` | où le joueur quitte : manche et score |
| `rematch_clicked`, `invite_opened`, `disconnect`, `error` | |

Avec `?debug`, `window.__kata.stats()` donne les compteurs de la session.

## Direction artistique

La vue est **isométrique** (losange 2:1). La simulation reste à plat en (x, y) ; `render.ts` projette tout à l'écran et les sprites restent debout. Les touches et le joystick suivent l'écran (haut = vers le fond du dojo), la souris est reconvertie dans le monde.

Les visuels de référence sont dans `art/reference/` : fiche du personnage (gi bleu, ceinture rouge), maquette de l'accueil (bois, parchemins, néon) et trois arènes. Les arènes servent de **thèmes** : `brume` (jardin sous la brume), `coucher` (cartoon, soleil couchant) et `neon` (nuit). La plateforme est dessinée en code pour pouvoir rétrécir en mort subite ; les horizons viennent des visuels (`public/assets/bg/`). Dans la Tour, les étages 1 à 4 sont au coucher de soleil, 5 à 8 dans la brume, 9 et plus au néon. Avec `?theme=brume|coucher|neon`, on force une ambiance.

## Mobile : paysage uniquement

Décision : sur téléphone, le jeu se joue **en paysage**. En portrait, un écran « Tourne ton téléphone » prend la place. En paysage court (hauteur de 540 px ou moins), l'interface se compacte : accueil en deux colonnes, boutique en panneau à droite, commandes réduites, HUD en haut. Le plein écran (réglage « Plein écran », touche F, ou premier toucher sur Android) masque la barre du navigateur ; sur iPhone il faut « Sur l'écran d'accueil » (le manifeste demande plein écran et paysage).

## Déploiement sur Vercel

À faire une seule fois :

1. Sur [vercel.com/new](https://vercel.com/new), importer le dépôt GitHub `Rev0li/kata-io`.
2. Vercel détecte Vite : commande `npm run build`, dossier `dist` (déjà fixés dans `vercel.json`). Cliquer sur **Deploy**.
3. Chaque push sur `main` redéploie la production ; chaque branche ou pull request obtient une adresse de prévisualisation.

Aucune variable d'environnement n'est nécessaire.

## Limites de cette version

- **Mise en relation** : PeerJS utilise son service public gratuit (`0.peerjs.com`). Il convient au développement, pas à une mise en production à grande échelle.
- **Pas de serveur relais (TURN)** : sur certains réseaux d'entreprise ou mobiles très restrictifs, la connexion directe échoue. Il faudra ajouter un serveur TURN.
- **L'hôte arbitre** : il a un léger avantage de latence et pourrait, en théorie, tricher. Un serveur autoritaire règle les deux problèmes.
- **Onglet de l'hôte en arrière-plan** : le navigateur suspend le jeu ; l'invité voit un message de pause.
- **Pas de prédiction chez l'invité** : il ressent sa latence (le ping affiché) entre l'appui et l'action.

## Prochaines étapes

1. Serveur de salle autoritaire (Node.js, par exemple Colyseus) qui réutilise `src/sim` tel quel, hébergé hors de Vercel (Fly.io, Railway ou un VPS), car Vercel ne garde pas de connexion WebSocket ouverte.
2. Prédiction des déplacements et du départ des coups chez le client, avec un rembobinage de 150 ms côté serveur pour juger parades et esquives.
3. Comptes et sauvegarde en ligne (aujourd'hui la progression est dans le navigateur), classement du défi du jour.
4. Arène à plusieurs, repris du prototype.

## Crédits graphiques

Les personnages, armes, effets, objets et le sol du dojo viennent du pack **Ninja Adventure** de [Pixel-boy](https://pixel-boy.itch.io/ninja-adventure-asset-pack) et AAA, publié sous licence **CC0 1.0** (domaine public, usage commercial autorisé, attribution appréciée mais non obligatoire). Sources utilisées :

- [pixel-boy/NinjaAdventure](https://github.com/pixel-boy/NinjaAdventure) : ninja bleu, armes (massue, hache, nodachi), sol du temple, particules ;
- [sparklinlabs/superpowers-asset-packs](https://github.com/sparklinlabs/superpowers-asset-packs/tree/master/ninja-adventure) (CC0) : autres personnages et portraits, effets, objets, monstres (fantôme, phénix, flamme).

`python3 scripts/build-assets.py <dossier NinjaAdventure> <dossier superpowers-asset-packs>` régénère `public/assets` ; les commandes de clonage sont en tête du script. La version complète du pack (50 personnages, 30 monstres, sons et musiques) se télécharge sur itch.io et peut enrichir la liste.
