# Animations des combattants LPC : besoins

Essai en cours derrière `?lpc` (branche `feat/lpc-essai`). Les 14 combattants sont composés avec le générateur LPC (recettes dans `scripts/lpc-presets.json`), à mains nues. Ce document liste ce que le jeu doit montrer, ce que LPC fournit déjà, et ce qu'il faut dessiner.

## 1. Ce que LPC fournit déjà

Chaque planche a des cases de 64 px. Sauf mention contraire, chaque animation existe dans les 4 directions (haut, gauche, bas, droite).

| Animation LPC | Images | Directions | Utilisée aujourd'hui pour |
|---|---|---|---|
| idle (repos) | 2 | 4 | repos |
| walk (marche) | 9 | 4 | déplacement |
| run (course) | 8 | 4 | esquive |
| thrust (estoc) | 8 | 4 | coups droits (poing et pied) |
| slash (taille) | 6 | 4 | coups en balayage (poing et pied) |
| 1h_backslash (revers) | 13 | 4 | rien encore |
| 1h_halfslash (demi-taille) | 6 | 4 | rien encore |
| spellcast (sort) | 7 | 4 | charge du coup chargé |
| combat (garde) | 2 | 4 | parade |
| jump (saut) | 5 | 4 | rien encore |
| emote | 3 | 4 | salut |
| hurt (blessé, tombe au sol) | 6 | **face seulement** | sonné, culbute, chute |
| climb (escalade) | 6 | **dos seulement** | accroché au bord, remontée |

**Ce qui manque à LPC** : aucun coup de pied ni de genou, aucune réaction dans les 4 directions (le blessé n'existe que de face), aucune parade, aucune roulade.

## 2. Comment une nouvelle animation se fabrique

Un personnage LPC est un empilement de calques (corps, tête, cheveux, capuche, haut, pantalon, chaussures, ceinture, cape…). Nos 14 combattants utilisent **une trentaine de pièces** sur deux corps : `male` et `muscular`.

**Une animation dessinée seulement sur le corps fera apparaître le personnage nu.** Il faut aussi la dessiner pour chaque pièce qui bouge.

Pour limiter le travail :

- **Coups de pied** : seules les jambes changent. On dessine le corps (jambes), les 2 pantalons (`Pants`, `Wide pants`), les 2 chaussures (`Sandals`, `Basic Boots`) et le bas des capes et ceintures. La tête, les cheveux, les masques et le haut reprennent une image existante (garde ou estoc) avec un décalage.
- **Réactions** (touché, éjection) : tout le corps bouge. Le plus simple est de partir de `hurt` (face) et de dessiner les 3 autres directions, ou de dessiner une seule direction et de la retourner à gauche et à droite.
- **Une animation propre à un personnage** (combo particulier) ne concerne que ses propres pièces : c'est le moins cher.

Ordre de grandeur : un coup de pied, c'est environ 4 à 6 images × 4 directions × 5 calques de jambes ≈ 100 petites images de 64 px. On peut diviser par deux en dessinant gauche et droite par symétrie.

## 3. Besoins, état par état

Les durées viennent de la simulation (`src/sim`).

| Situation dans le jeu | Durée | Aujourd'hui (essai) | Besoin | Source |
|---|---|---|---|---|
| Repos | – | idle | ✔ | LPC |
| Déplacement | – | walk | ✔ | LPC |
| Arrivée en début de manche (tombe du ciel) | 500 ms | idle qui grossit | réception de saut | LPC `jump` (fin) |
| Compte à rebours (figé) | – | idle | garde | LPC `combat` |
| Coup chargé, en charge | jusqu'à la relâche | spellcast | **posture de concentration** (genoux fléchis, poings armés) | à dessiner, ou `combat` + aura |
| Parade | fenêtre de parade | combat | **garde haute, avant-bras croisés** | à dessiner (4 dir.) |
| Parade parfaite | – | idem + éclat doré | même pose, éclat suffit | – |
| Parade ratée (`recover`) | quelques centaines de ms | hurt | **garde ouverte, déséquilibre** | à dessiner, ou `combat` + recul |
| Esquive | courte | run | **pas chassé ou roulade** | `run` acceptable ; roulade à dessiner |
| Touché, sonné (`stun`) | 200 à 520 ms | hurt (face) | **recul « touché »** dans les 4 directions, sans rotation | à dessiner (2 à 3 images × 4 dir.) |
| Contré par une parade (`stun`) | 650 à 900 ms | hurt (face) | **déséquilibre long** (bras qui battent) | à dessiner, ou recul touché tenu |
| Éjection forte (`tumble`) | jusqu'à l'arrêt | hurt couché | **vol plané puis roulade au sol** | à dessiner (4 dir.) |
| Épuisé (pris d'un coup, recul ×2,6) | – | rien | **essoufflé** (épaules qui montent) | à dessiner ou effet (gouttes) |
| Tombe à l'eau (`falling`) | 560 ms | hurt + rétrécit (plus de vrille) | **chute en arrière, bras en l'air** | à dessiner (1 dir. suffit) |
| Accroché au bord (`ledge`) | jusqu'à 1,5 s | climb (de dos) | **mains sur le rebord**, vu de chaque côté | LPC `climb` (dos) ; 3 dir. à dessiner |
| Remonte sur la plateforme (`climb`) | courte | climb | rétablissement | LPC `climb` + `jump` |
| Mort / KO (fin de manche) | – | caché | **couché au sol** | LPC `hurt` (dernière image) |
| Victoire | – | rien | **pose de victoire** (salut ou poing levé) | à dessiner (face) |

## 4. Les 18 coups

`tf` décrit la garde qui suit le coup. Le jeu dessine la traînée lui-même ; l'animation n'a qu'à montrer le geste.

### Poings (coups blancs)

| Coup | Geste | Aujourd'hui | Besoin |
|---|---|---|---|
| Direct | poing droit | thrust | ✔ LPC `thrust` |
| Crochet | poing circulaire | slash | ✔ LPC `slash` ou `1h_halfslash` |
| Revers | revers du poing | slash | ✔ LPC `1h_backslash` |
| Coude | coude en avant, court | thrust | `1h_halfslash` (à essayer), sinon à dessiner |
| Paume du tigre | paume poussée | thrust | ✔ LPC `spellcast` (fin, mains en avant) |
| Double frappe (2 coups) | deux directs | thrust | ✔ `thrust` joué 2 fois |
| Rafale (3 coups) | trois coups alternés | thrust | ✔ `thrust` / `slash` alternés |

### Jambes (coups blancs) : rien chez LPC

| Coup | Geste | Besoin |
|---|---|---|
| Coup de pied bas | pied tendu bas | **à dessiner** (3 à 4 images) |
| Genou montant | genou remonté | **à dessiner** (3 images) |
| Fouetté | jambe en arc | **à dessiner** (5 images) |
| Balayage | jambe rasante, accroupi | **à dessiner** (5 images) |

### Coups chargés

| Coup | Membre | Besoin |
|---|---|---|
| Pique de la grue | pied, sur une jambe | **à dessiner** (posture de la grue + pique) |
| Pied retourné | pied, demi-tour | **à dessiner** (rotation du corps : réutilise les 4 directions de `walk` pour le tour) |
| Pied hache | pied qui retombe | **à dessiner** (jambe levée haut puis abattue) |
| Uppercut volant | poing, saut | LPC `jump` + bras levé : **retouche** du bras |
| Coup de bélier | épaule, en course | LPC `run` (2 images) + épaule en avant : **retouche** |
| Tornade | pied, tour complet | **à dessiner**, ou `jump` + rotation des 4 directions (effet tourbillon) |
| Fauchage | pied rasant, tour | **à dessiner** (balayage accroupi long) |

**Bilan coups** : 7 poings jouables avec LPC tel quel ; **9 coups de jambe et 2 retouches à produire**.

## 5. Gestes et emotes

| Emote | Besoin | Source |
|---|---|---|
| Salut | **inclinaison** (rei) | à dessiner (face), aujourd'hui `emote` |
| Rire, « Trop lent », « L'eau est bonne ? », moqueries du gardien | **narguer** (main qui appelle, épaules qui rient) | une seule animation partagée, à dessiner |
| « Viens ! » | main qui fait signe | à dessiner (2 images) ou réutiliser narguer |
| GG | pouce levé ou salut | réutiliser salut |

## 6. Combos propres à chaque personnage (à décider)

Idée : à mains nues, chaque combattant a une signature, un coup ou un combo à lui, qui n'a besoin que de ses propres pièces (voir section 2). Exemples de pistes, à trancher avec les classes (D8) :

| Combattant | Signature possible |
|---|---|
| Ninja bleu / pourpre / jade / ombre | rafale rapide, esquive en roulade |
| Moine | paume du tigre, garde des mains jointes |
| Sumo, Oni | coup de bélier, piétinement |
| Samouraï, Shōgun | posture haute (charge), direct puissant |
| Rōnin, Bandit | revers et coups bas |
| Ermite | pique de la grue |
| Loup | griffes (taille rapide) |
| Squelette | os qui se disloquent quand il est touché |

## 7. Ordre conseillé

1. **Réaction « touché »** dans les 4 directions (remplace la rotation, se voit à chaque coup).
2. **Garde de parade** (4 directions).
3. **Un coup de pied droit** (coup de pied bas) et **un balayage** : ils couvrent visuellement la plupart des 9 coups de jambe, en jouant sur la hauteur et la vitesse.
4. Éjection et chute dans l'eau.
5. Coups chargés de jambe, un par un.
6. Salut, narguer, victoire.
7. Signatures par personnage.
