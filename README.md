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

La **Tour du temple** est le mode solo : 12 gardiens, puis une tour sans fin. Chaque étage rapporte 1 à 3 étoiles (victoire, sans perdre de manche, sous le temps de référence). Le tutoriel d'une minute se lance avant le premier étage. Les gardiens n'utilisent que les techniques de leur ceinture. En duel entre amis, les deux joueurs ont toutes les techniques.

Le panneau **Mode test** de l'accueil permet de choisir sa ceinture, les étages débloqués et le niveau du bot d'entraînement, ou de tout réinitialiser.

`npx tsx scripts/towercheck.ts 0.45` simule un joueur moyen qui monte la Tour (pourcentage de victoires par étage).

## Jouer

1. **Créer un duel privé** : la page affiche un code de salle et un lien d'invitation.
2. Envoyer le lien à son adversaire. Le duel commence dès qu'il l'ouvre et clique sur « Rejoindre le duel ».
3. À la fin, chacun peut demander une revanche ; elle démarre quand les deux l'ont demandée.

**S'entraîner** lance un duel contre un bot (Disciple, Adepte ou Maître), sans réseau.

| Action | Clavier et souris | Tactile |
|---|---|---|
| Se déplacer | ZQSD, WASD ou flèches | Joystick à gauche |
| Viser | Souris | Automatique vers l'adversaire |
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
```

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
  game/render.ts     rendu Phaser du dojo et des combattants (Graphics, aucun sprite)
  game/audio.ts      sons et musique synthétisés en WebAudio (aucun fichier audio)
  game/tutorial.ts   étapes du tutoriel et exercices par technique
  ui/actionbar.ts    barre d'actions animée (boutons sur mobile, indicateurs sur ordinateur)
  scenes/GameScene   boucle de jeu, caméra, souris
  scenes/HudScene    interface en jeu (pourcentages, souffle, qi, score)
  ui/ui.ts           écrans HTML : accueil, salon, résultat
  ui/controls.ts     clavier et commandes tactiles
scripts/simcheck.ts  test de la simulation hors navigateur
scripts/towercheck.ts équilibrage de la Tour
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
3. Sprites dessinés et animations, en remplacement du rendu en code.
4. Arène à plusieurs, classement, comptes et boutique cosmétique, repris du prototype.
