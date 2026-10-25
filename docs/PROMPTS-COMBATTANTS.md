# Pack de prompts : combattants

Prompts prêts à coller dans l'IA de génération d'images, pour remplacer les combattants en pixel art 16 px par des combattants dessinés dans le style des mondes. Complète [DIRECTION-ARTISTIQUE.md](DIRECTION-ARTISTIQUE.md) (section 6.1).

On commence par **un seul combattant, le ninja bleu**, et on le teste dans le jeu avant de produire les 13 autres.

---

## 1. La méthode : un pantin découpé

On ne génère pas d'animation image par image. On génère le combattant **en pièces détachées** (tête, buste, bras, jambes), et le jeu les assemble et les anime : garde, marche, coups de poing et de pied, parade, esquive, chute. Une seule génération par personnage, et autant d'animations qu'on veut.

Il faut donc des pièces :

- **dessinées séparément**, bien espacées, sans se chevaucher ;
- **à la même échelle** sur toutes les planches d'un même personnage ;
- avec des **articulations arrondies qui débordent** (environ 15 % de matière en plus à chaque jointure), pour que la pièce puisse tourner sans laisser de trou ;
- sur un **fond gris clair uni**, que le script `scripts/planches/decouper.py` sait retirer.

### Les pièces

| Pièce | Nom de fichier | Remarque |
|---|---|---|
| Tête, expression neutre | `tete` | cheveux ou capuche compris |
| Tête, cri (pendant un coup) | `tete-cri` | même cadrage que `tete` |
| Tête, touché (yeux plissés) | `tete-touche` | même cadrage que `tete` |
| Buste | `buste` | haut du gi, col, épaules |
| Ceinture | `ceinture` | **gris clair neutre** : le jeu la colore selon le rang (blanche, jaune… noire) |
| Bassin | `bassin` | haut du pantalon |
| Bras (haut) gauche et droit | `bras-g`, `bras-d` | de l'épaule au coude |
| Avant-bras avec poing fermé, gauche et droit | `avant-bras-g`, `avant-bras-d` | du coude au poing |
| Main ouverte | `paume` | pour la parade et la paume du dragon |
| Cuisse gauche et droite | `cuisse-g`, `cuisse-d` | de la hanche au genou |
| Jambe avec pied, gauche et droite | `jambe-g`, `jambe-d` | du genou au pied |

Trois planches de pièces par personnage : **face**, **dos** et **profil** (tourné vers la droite ; le jeu fait le miroir pour la gauche).

### Les chiffres du jeu

- Vue isométrique 2:1, soit une caméra plongeante d'environ **30°**. Les combattants restent debout.
- À l'écran, un combattant fait **50 à 60 px de haut** sur téléphone (aujourd'hui 16 px agrandis 3 fois). Tout doit rester lisible à cette taille : silhouette nette, couleurs franches, peu de petits détails.
- On génère grand (combattant entier d'environ **1000 px de haut**) et le jeu réduit.
- Proportions **chibi** : la tête fait environ un tiers de la hauteur.

---

## 2. Bloc de style (à coller à la fin de chaque prompt)

> Kung-fu fighting game character art, chibi proportions (head about one third of total height), clean cartoon cel-shading with thick dark brown-black outlines (#1b1412), two flat shadow tones, subtle rim light, warm slightly desaturated colors, crisp readable silhouette, light coming from the top-left, same art style as the attached Japanese garden arena references. Plain flat light grey background (#EDEDED), no ground shadow, no scenery, no text, no labels, no watermark, no frame.

**À joindre comme références de style** à chaque génération :

- `art/reference/mondes/cerisiers-jeu.png` (le monde dans lequel le combattant doit tenir) ;
- `art/reference/mondes/cerisiers-planche.png` (le trait et les couleurs des éléments) ;
- `art/reference/perso-turnaround.png` (le personnage principal : gi bleu clair, chevilles bandées).

À partir de l'étape B, joindre aussi **la fiche de référence validée à l'étape A** : c'est elle qui garde le personnage identique d'une planche à l'autre.

---

## 3. Les prompts du ninja bleu

### A. Fiche de référence (turnaround)

Sert à figer le personnage. On la regénère jusqu'à en être content, puis on ne la change plus.

> Character turnaround sheet of a young martial artist called "Blue Ninja": light blue gi, belt in plain light grey, short black hair, wrapped ankles, barefoot, determined expression. Four views side by side at the exact same scale, feet on the same baseline: front, three-quarter front, side view facing right, back. Neutral fighting guard stance, fists up, arms slightly away from the body so they don't hide the torso. Full body, nothing cropped, even spacing between views. [BLOC DE STYLE]

Format conseillé : paysage 16:9.

### B. Pièces détachées, vue de face

> Cut-out puppet parts sheet for 2D skeletal animation, front view, of exactly the same character as the attached turnaround sheet. Each body part drawn separately and spaced well apart, never overlapping, all at the same scale as if the full body were about 1000 px tall: head with neutral expression, head shouting, head hurt with squinted eyes, torso with gi collar and shoulders, belt with its knot in plain light grey, hips with top of the trousers, left upper arm, right upper arm, left forearm with closed fist, right forearm with closed fist, one open palm hand, left thigh, right thigh, left lower leg with bare wrapped foot, right lower leg with bare wrapped foot. Every joint has a rounded overlapping end with extra material so parts can rotate without gaps. Neat grid layout with generous empty space between parts. [BLOC DE STYLE]

### C. Pièces détachées, vue de dos

Même prompt que B, en remplaçant `front view` par `back view, seen from behind`, et la liste des têtes par : `head seen from behind (one version only)`.

### D. Pièces détachées, profil

Même prompt que B, en remplaçant `front view` par `side view, character facing right`, et en ajoutant à la fin de la liste des pièces : `far-side limbs drawn slightly darker than near-side limbs`.

### E. Portrait

Utilisé à l'accueil, dans la liste des étages et au résultat.

> Bust portrait of exactly the same character as the attached turnaround sheet, three-quarter view facing slightly left, head and shoulders, centered, determined smile. Square format. Plain flat dark navy background (#111820). [BLOC DE STYLE, sans la phrase sur le fond gris]

### F. Arme : katana

Toutes les armes sont dessinées seules, **horizontales, pointe vers la droite, poignée à gauche**, centrées en hauteur. Le jeu les fait tourner autour du poing.

> Single katana for a cartoon kung-fu game, drawn horizontally, blade pointing to the right, hilt on the left, vertically centered. Black wrapped hilt, small round guard, slightly curved blade. Its length is about 60% of the character's full height (character from the attached turnaround). [BLOC DE STYLE]

Longueur des autres armes, par rapport à la hauteur du combattant (d'après le jeu) :

| Arme | Longueur |
|---|---|
| Saï | 50 % |
| Katana | 60 % |
| Trident | 75 % |
| Hache | 80 % |
| Massue | 90 % |
| Yari (lance) | 100 % |
| Nodachi (grand sabre) | 100 % |

### G. Fiche de style (contrôle, pas un asset)

Une image de contrôle pour juger l'ensemble avant de produire en série : le combattant à sa taille réelle, sur la plateforme, face à un adversaire.

> Gameplay mockup in isometric three-quarter high-angle view (about 30 degrees), on the wooden platform of the attached cherry-garden arena: the Blue Ninja from the attached turnaround in guard stance holding a katana, facing an orange-robed monk; a small white impact flash between them. The character's height is about one eighth of the platform width. No text, no interface.

Ce qu'on regarde : le combattant se détache-t-il du sol et du décor ? Est-il lisible si on réduit l'image à 25 % ?

### H. Impacts (bonus)

> Animation strip of a hit impact flash for a cartoon fighting game, 5 frames side by side in a single row, each frame in an equal square cell: a small white star burst growing, peaking with radial lines, then fading into sparkles. Pure white with a hint of pale gold, so the game can tint it. Plain flat light grey background (#EDEDED), no text.

---

## 4. Les 13 autres combattants

Une fois le ninja bleu validé dans le jeu, on refait les étapes A à E pour chacun. Dans les prompts, remplacer la description du personnage (entre `called` et `Four views`) par celle du tableau, et joindre **la fiche du ninja bleu** comme référence de style en plus des images du monde, pour garder la même famille de dessin.

| Id | Description à coller | Couleur forte |
|---|---|---|
| `ninja-pourpre` | "Purple Ninja": agile ninja in a magenta hooded outfit with a white headband, masked lower face | magenta |
| `bandit` | "Masked Bandit": wide-brimmed dark hat, scarf over the lower face, dark patched clothes | noir et rouge |
| `moine` | "Monk": shaved head, saffron-orange robe, calm face, prayer beads (he is also the training dummy) | safran |
| `samourai` | "Samurai": light lacquered armor, helmet with a golden crest, stern face | argent et or |
| `ronin` | "Ronin": wide straw kasa hat, worn grey kimono, relaxed smile | paille |
| `oni` | "Oni": red-skinned demon with two small horns, wild black hair, fierce grin | rouge |
| `squelette` | "Skeleton": comic skeleton warrior with a torn sash, glowing eye sockets | ivoire |
| `sumo` | "Sumo": huge round wrestler, hair topknot, mawashi belt, tiny legs | chair et bleu marine |
| `ombre` | "Shadow Ninja": dark grey hooded ninja with glowing orange eyes | gris foncé et orange |
| `loup` | "White Wolf": anthropomorphic white wolf in a dark fighting vest | blanc |
| `ermite` | "Old Hermit": old master with long white hair and a long mustache, red robe, wooden staff on his back | rouge |
| `ninja-vert` | "Jade Ninja": elite ninja in a jade-green hooded outfit, red eyes | jade |
| `shogun` | "Golden Shogun": final boss in golden armor, horned helmet, flowing red cape | or |

Pour le sumo et le loup, ajouter : `keep the same total height as the other fighters, the difference is in the silhouette`.

---

## 5. Vérifier avant de livrer

- [ ] Le personnage est **identique** sur la fiche, les trois planches de pièces et le portrait.
- [ ] La **ceinture est gris clair** (le jeu la colore).
- [ ] Les pièces ne se touchent pas, et les articulations sont arrondies et débordent.
- [ ] Même échelle sur toutes les planches du personnage.
- [ ] Fond uni, sans ombre au sol, sans texte.
- [ ] Réduite à **60 px de haut**, la silhouette reste lisible et la couleur forte se reconnaît.

## 6. Livraison

Déposer les images dans `art/source/combattants/<id>/` :

| Fichier | Contenu |
|---|---|
| `fiche.png` | fiche de référence (A) |
| `pieces-face.png`, `pieces-dos.png`, `pieces-profil.png` | planches de pièces (B, C, D) |
| `portrait.png` | portrait (E) |
| `controle.png` | fiche de style (G), pour mémoire |

Les armes dans `art/source/armes/<id>.png`, les impacts dans `art/source/effets/`.

Ensuite, je découpe les planches avec `scripts/planches/decouper.py`, je nomme les pièces comme dans le tableau de la section 1 et je monte le pantin dans le jeu.
