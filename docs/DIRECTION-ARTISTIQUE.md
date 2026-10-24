# Direction artistique - Kata.io

Inventaire de tout ce qui se voit dans le jeu au 2026-10-24 : style, palettes, environnements, assets, et ce qui est à produire. Sert de brief pour faire générer les visuels par une autre IA.

Légende de l'état : **Pack** = pack Ninja Adventure (pixel art 16 px, CC0), **SVG** = généré par `scripts/build-decor-svg.py`, **Code** = dessiné par Phaser dans `src/game/render.ts`, **Réf.** = visuel de référence dans `art/reference/`, **Mort** = présent mais plus utilisé.

---

## 1. Constat : trois styles cohabitent

| Couche | Style actuel | Où |
|---|---|---|
| Combattants, armes, effets de coup, objets de boutique | **Pixel art 16 px** (pack Ninja Adventure), agrandi ×3 sans lissage | `public/assets/persos.png`, `armes.png`, `fx/`, `items/` |
| Horizons, poissons, objets flottants | **Vectoriel plat cartoon** : aplats, dégradés doux, contour sombre fin | `public/assets/decor/*.svg` |
| Plateforme du dojo, lanternes, eau, particules d'ambiance, lignes de vitesse | **Formes dessinées en code** (losange, rectangles, ellipses) | `src/game/render.ts` |
| Interface HTML | **Sombre, encre et ocre**, typographie condensée, icônes au trait | `src/style.css`, `index.html` |
| Références | **Cartoon cel-shading** : contour noir épais, ombres en aplat, lumière chaude | `art/reference/*.png` |

Le pixel art est la couche qui jure : les décors et les références sont déjà dans une même famille (cartoon vectoriel à contour), les personnages non.

### Décision à prendre : le style cible

**Recommandation : cartoon cel-shading à contour sombre, celui des références.** Les décors SVG en sont déjà proches, et la maquette d'accueil (`ui-accueil.png`) montre qu'il tient aussi pour l'interface. Le pixel art serait remplacé progressivement, en commençant par les combattants.

Alternative : garder le pixel art et repixeliser les décors. Moins de travail sur les personnages (le pack fournit déjà les animations), mais on perd les décors vectoriels et la maquette d'accueil.

### Risque principal : l'animation des combattants

Une IA d'image génère mal une planche d'animation cohérente image par image. Deux façons de contourner :

1. **Pantin découpé (recommandé)** : générer chaque combattant en pièces détachées (tête, buste, bras, avant-bras, mains, cuisses, jambes, ceinture), puis les animer en code ou avec un outil d'os (Spine, DragonBones, Rive). Le jeu fait déjà ça pour les poissons (déformation en tranches). Une seule génération par personnage, animations illimitées.
2. **Planche image par image** : générer une fiche de référence (turnaround) par personnage, puis chaque pose séparément en redonnant la fiche. Plus fidèle au dessin, mais long et fragile (14 personnages × une dizaine de poses × 4 directions).

---

## 2. Bible de style (cible)

À recopier en tête de chaque demande de génération.

> Jeu de combat kung-fu cartoon, vue isométrique légère (plongée d'environ 30°). Style cel-shading : contour sombre épais (#0f1719 ou brun très foncé, jamais noir pur), ombres en un ou deux aplats, pas de texture photo, pas de dégradé complexe. Proportions chibi : tête grosse (environ 1/3 de la hauteur), mains et pieds lisibles. Couleurs chaudes et un peu désaturées, une couleur d'accent forte par personnage. Silhouette lisible en très petit (le combattant fait environ 50 px de haut à l'écran sur téléphone). Fond transparent. Lumière venant du haut à gauche.

Inspirations visibles dans les références : dessin animé japonais, estampes pour les horizons, néon pour le dojo de nuit.

**À éviter** : détails fins qui disparaissent en petit, contour fin ou absent, réalisme, perspective frontale à hauteur d'yeux pour les sprites de jeu (la fiche `perso-turnaround.png` est à hauteur d'yeux : bonne pour le dessin, pas pour l'angle de caméra).

### Palette de l'interface (`src/style.css`)

| Nom | Couleur | Usage |
|---|---|---|
| ink | `#0f1719` | fond, contour de texte |
| ink-2 | `#162124` | champs, boutons secondaires |
| panel | `#182427` | cartes |
| line | `#33433f` | bordures |
| stone | `#28332f` | boutons de sélecteur |
| bone | `#ecdfc6` | texte principal, souffle |
| mist | `#93a59f` | texte secondaire |
| ochre | `#e0a243` | accent principal, bouton Jouer, « .io » du logo |
| jade | `#62c2a2` | qi, repères de tutoriel |
| red | `#e5483a` | coup chargé, danger, balle de match |
| blood | `#d24b3e` | erreurs |
| gold | `#f2c14e` | qi plein, paume du dragon, récompenses |

Couleurs de jeu complémentaires : flash de parade jade-menthe `#8ff5d0`, rouge d'impact `#ff5a46`, éclaboussure `#d6f0f2`.

### Typographie

- **Titres et boutons** : Big Shoulders Display (900, 800), capitales, espacement 0,05 em.
- **Texte** : Barlow (400 à 700).
- Les deux viennent de Google Fonts. Le HUD en jeu utilise les mêmes, avec un contour `#0f1719` de 4 px.

### Ceintures (`src/sim/progression.ts`)

Blanche `#efe8da`, jaune `#e8c64a`, orange `#e48a3a`, verte `#5aa86a`, bleue `#4f86c6`, marron `#7a4a2a`, noire `#151515`. La ceinture est le seul repère de rang : elle doit être bien visible sur le sprite.

---

## 3. Contraintes techniques pour les assets

| Sujet | Contrainte |
|---|---|
| Vue | Isométrique 2:1 (losange). La simulation est à plat, le rendu projette ; les sprites restent **debout**, jamais couchés dans le plan du sol. |
| Directions | 4 : bas (face caméra), haut (dos), gauche, droite. |
| Taille des combattants | Aujourd'hui 16 × 16 px affichés ×3 (48 px). Pour du vectoriel ou du dessin : livrer en 256 px de haut au moins, fond transparent, pieds sur la même ligne de base. |
| Armes | Pointe vers la droite, poignée à gauche, centrées verticalement. Le jeu les fait tourner autour de la main. |
| Horizons | 2400 × 420 unités, rastérisés à 4096 px de large au plus (limite des GPU mobiles). **Tout l'important entre x = 500 et x = 1900** : c'est la zone visible sur téléphone en paysage. Ligne d'eau en bas, reflets compris. Format SVG de préférence (retouchable dans Inkscape ou Penpot). |
| Poissons | Vus de dessus, de profil, tête à droite, d'un seul tenant (le jeu les déforme en tranches). Cadre 276 × 96 px. |
| Objets flottants | Vus de trois quarts dessus, cadre 192 × 128 px, ombre portée légère incluse. |
| Effets animés | Bande horizontale d'images de même taille (32 × 32 px aujourd'hui), lisibles sur fond clair comme sombre. Prévoir des versions blanches que le jeu teinte. |
| Mobile | Le jeu se joue en paysage, souvent sur un écran de 360 px de haut. Tester chaque asset à cette taille. |

---

## 4. Environnements : les six dojos

Un dojo = un horizon (SVG), une plateforme (code), une eau, des poissons, des objets flottants, des particules et parfois des lanternes. La Tour change de dojo tous les deux étages dans l'ordre ci-dessous ; le défi du jour en tire un d'après la date ; en duel, l'hôte choisit.

| Dojo | Ambiance | Horizon actuel | Plateforme (bois / bord) | Eau | Poissons | Flottants | Particules | Lanternes |
|---|---|---|---|---|---|---|---|---|
| `coucher` Coucher de soleil | Cartoon chaud, fin d'après-midi | Arbres ronds orange et turquoise, rochers roses, pagode, soleil bas | bois `#c98450`, bord `#b36a38`, liseré `#2f6f7d` | `#355d62` | koï orange, koï blanc, koï or | nénuphar, fleur de lotus | pétales | non |
| `bambou` Bambous | Forêt verte, lumière douce | Bambouseraie, torii rouge, pagode | bois `#a8924e`, bord `#c4b060`, liseré `#3e8a5a` | `#2f5a4a` | carpe de jade, koï or, koï orange | nénuphar, fleur, feuille | lucioles jaunes | non |
| `brume` Brume | Jardin zen sous la brume, gris-vert | Sapins, torii, pagode, lanternes de pierre | bois `#76604d`, bord pierre `#8d9189` | `#656455` | koï blanc, argenté, carpe de jade | nénuphar, feuille | feuilles | oui, papier crème |
| `neige` Neige | Hiver clair, bleu froid | Monts enneigés, sapins, pagode, lanternes | bois `#b59f86`, bord neige `#e9f1f6`, liseré `#7fb8e8` | `#3b5a74` | argenté, koï blanc | blocs de glace | neige | oui, chaudes |
| `neon` Néon | Nuit urbaine, cyan et orange | Ville aux fenêtres colorées, pagode cyan, lune | bois `#3a2a3c`, liseré cyan `#2de6ea`, arête orange `#ff9a3c` | `#0a1020` | poissons-lanternes (lumineux) | lanternes flottantes | lucioles cyan et orange | oui, cyan |
| `volcan` Volcan | Rouge sombre, lave | Volcan aux coulées de lave, torii, rochers, braseros | bois `#4a3028`, liseré lave `#ff7a2a` | `#3a1208` | poissons de braise (lumineux) | roches de lave | braises | oui, braise |

Références illustrées : `arene-coucher.png`, `arene-brume.png`, `arene-neon.png` (les trois autres dojos n'en ont pas).

### Ce qui manque ou est à reprendre

- **Références pour `bambou`, `neige`, `volcan`** : une image d'arène par dojo, au même cadrage que les trois existantes (plateforme vue en iso au centre, eau, horizon).
- **Plateforme du dojo** : aujourd'hui un losange en aplats avec des lignes de planches. À générer : une texture de planches vue de dessus par dojo (bois clair, bois sombre, bois mouillé, bois cerclé de néon, pierre volcanique), plus le bord et la tranche. Contrainte : elle **rétrécit en mort subite** et ses planches tombent à l'eau, donc il faut des planches détachables, pas une image d'un bloc.
- **Lanternes sur pied** : dessinées en rectangles. À générer : une lanterne par ambiance (papier, pierre, néon, brasero).
- **Eau** : aplat de couleur + scintillements et ondes en code. Une texture d'eau légère par dojo (vue de dessus, raccordable) améliorerait beaucoup l'image.
- **Particules d'ambiance** : petits carrés en code. Peuvent devenir de vrais sprites : pétale de cerisier, feuille, flocon, luciole, braise (8 à 16 px, 2 à 4 images).

---

## 5. Inventaire des assets

### 5.1 Combattants (14) - priorité 1

Planche actuelle `persos.png` : 14 personnages × 4 directions × 7 lignes de 16 px. Portraits `portraits.png` : 38 × 38 px. Le joueur commence avec les deux ninjas, les autres se débloquent en battant le gardien de l'étage indiqué.

| Id | Nom | Étage | Apparence actuelle (pack) | Piste pour la génération |
|---|---|---|---|---|
| `ninja-bleu` | Ninja bleu | départ | capuche bleu clair, visière | Personnage principal. Fiche `perso-turnaround.png` : gi bleu pâle, ceinture (couleur du rang), bandes aux chevilles, cheveux courts. |
| `ninja-pourpre` | Ninja pourpre | départ | capuche magenta, bandeau blanc | Ninja agile, magenta et blanc. |
| `bandit` | Bandit masqué | 1 | chapeau noir, masque | Chapeau à large bord, foulard sur le visage. |
| `moine` | Moine | 2 | crâne rasé, peau orange | Moine shaolin, robe safran. **Sert aussi de mannequin d'entraînement** (sans arme). |
| `samourai` | Samouraï | 3 | casque argent à cimier doré | Armure légère, casque à cimier. |
| `ronin` | Rōnin | 4 | chapeau de paille conique, sourire | Kasa de paille, kimono usé. |
| `oni` | Oni | 5 | cheveux en pics, peau rouge | Démon à cornes, peau rouge, expression féroce. |
| `squelette` | Squelette | 6 | squelette blanc | Squelette guerrier, un peu comique. |
| `sumo` | Sumo | 7 | massif, crâne rasé | Lutteur imposant, chignon, mawashi. |
| `ombre` | Ninja de l'ombre | 8 | capuche gris foncé, yeux orange | Ninja sombre, yeux lumineux orange. |
| `loup` | Loup blanc | 9 | loup blanc anthropomorphe | Loup blanc en tenue de combat. |
| `ermite` | Vieil ermite | 10 | cheveux et moustache blancs, robe rouge | Vieux maître, longue moustache, bâton possible. |
| `ninja-vert` | Ninja de jade | 11 | capuche verte, yeux rouges | Ninja vert jade, élite. |
| `shogun` | Shōgun d'or | 12 | casque doré à cornes | Boss final : armure d'or, casque à cornes, cape. |

**Poses nécessaires** (ce que le jeu affiche aujourd'hui, `render.ts`) :

| État de jeu | Ligne actuelle | Pose à produire |
|---|---|---|
| repos, marche | 0 à 3 | garde de combat, cycle de marche (4 images) |
| démarrage d'un coup | 0 + écrasement | préparation (armer le bras ou la jambe) |
| coup actif | 4 | frappe de poing, de pied, de genou (aujourd'hui une seule pose pour les trois) |
| charge du coup rouge | 5 | concentration, corps ramassé (le jeu ajoute une lueur rouge ou dorée) |
| parade | 6 | bras croisés devant soi |
| esquive | 5 | pas de côté, corps penché |
| étourdi, recul, culbute | 6 | touché, déséquilibré (le jeu fait tourner le sprite pour la culbute) |
| chute à l'eau, accroché au bord, remontée | 5 | bras en l'air, mains agrippées au rebord |
| emote « salut » | 6 | salut du poing dans la paume |

Chaque pose × 4 directions. Le second joueur, s'il a le même personnage, est teinté en saumon par le jeu : prévoir des couleurs qui restent lisibles teintées.

**Portraits** : un buste par personnage, carré, fond sombre uni, même cadrage pour tous. Utilisés à l'accueil, dans la liste des étages (grisés si pas encore battus), au résultat.

### 5.2 Armes (7 + mains nues) - priorité 2

`armes.png` : 7 cases de 16 px. Purement cosmétiques, gagnées avec les ceintures.

| Id | Nom | Ceinture | Longueur en jeu |
|---|---|---|---|
| `katana` | Katana | blanche | 10 |
| `mains` | Mains nues | blanche | pas d'image |
| `sai` | Saï | jaune | 8 |
| `yari` | Yari (lance) | orange | 16 |
| `massue` | Massue | verte | 14 |
| `trident` | Trident | bleue | 12 |
| `hache` | Hache | marron | 13 |
| `nodachi` | Nodachi (grand sabre) | noire | 16 |

Les longueurs sont relatives (en pixels du pack) : le yari et le nodachi sont les plus longs, le saï le plus court. Livrer aussi une icône de chaque arme pour le sélecteur de l'accueil.

### 5.3 Effets de combat - priorité 2

Bandes de 32 × 32 px (pack), jouées à 22 images par seconde.

| Clé | Images | Usage |
|---|---|---|
| `hit` | 5 | impact de coup blanc |
| `cross` | 4 | impact de coup chargé (croix, teintée rouge) |
| `star` | 7 | étoile d'impact, feu d'artifice |
| `guard` | 5 | parade réussie |
| `sparkle` | 6 | esquive, charge pleine, poussière d'étoiles |
| `arc` | 5 | arc de coup |
| `spin` | 5 | coup circulaire (tornade) |
| `slash` | 5 | traînée de coup |
| `fireslash` | 5 | traînée enflammée |
| `fire` | 5 | flammes |
| `splash` | 6 | plouf dans l'eau |
| `dust` | 5 | poussière au sol (pas, réception) |
| `smoke` | 6 | fumée |

Effets **dessinés en code**, à garder en code mais à harmoniser avec le style choisi : anneaux d'onde, gouttes, éclats radiaux et lignes de vitesse (blanc, rouge `#ff5a46`, or), flashs plein écran, annonce au sol du coup chargé (rouge), repère de tutoriel (jade).

**Nouveau, demandé dans `TODO.md`** : l'**éclat d'avertissement** du coup entrant, une étoile blanche qui scintille sur l'arme ou la tête de l'attaquant (3 à 4 images, très lisible, 16 à 24 px à l'écran).

### 5.4 Boutique d'effets - priorité 3

Achetés avec les pièces. Chaque effet a une icône dans la boutique et une particule en jeu.

**Traînées de coup** (suivent le bout de l'arme) :

| Id | Nom | Couleur | Particule |
|---|---|---|---|
| `aucune` | Traînée simple | `#fffaec` | aucune |
| `braise` | Braises | `#ff8a3d` | petite flamme animée |
| `sakura` | Pétales de cerisier | `#f6b6cf` | pétale |
| `ombre` | Fumée d'ombre | `#2a1f33` | fumée |
| `etoiles` | Poussière d'étoiles | `#fff1a8` | scintillement |
| `vague` | Vague | `#7fd6ff` | éclaboussure |
| `shuriken` | Shurikens | `#cfd8dc` | shuriken qui tourne |
| `or` | Pluie d'or | `#f2c14e` | pièce qui tourne |

**Ploufs d'éjection** (joués quand l'adversaire tombe à l'eau) :

| Id | Nom | Éléments visuels |
|---|---|---|
| `plouf` | Plouf | gerbe d'eau, anneaux |
| `encre-e` | Éclaboussure d'encre | fumée et gouttes noires |
| `petales` | Tempête de pétales | pétales en tourbillon |
| `cochon` | Cochon volant | cochon qui s'envole (pack : 2 images) |
| `fantome` | Fantôme | fantôme qui monte (pack : 4 images) |
| `feu` | Feu d'artifice | étoiles multicolores |
| `tresor` | Trésor englouti | coffre qui remonte et crache des pièces |
| `phenix` | Phénix | oiseau de feu qui s'envole (pack : 4 images) |

Sprites du pack utilisés : `fx/leaf.png`, `wood.png`, `pig.png`, `coin.png`, `shuriken.png`, `chest.png`, `ghost.png`, `bird.png`, `flame.png`.

### 5.5 Décor vectoriel (existant, à garder ou retoucher)

| Fichiers | Nombre | État |
|---|---|---|
| `decor/bg-<dojo>.svg` | 6 horizons | SVG, cohérent avec la cible |
| `decor/fish-<espèce>.svg` : koi_orange, koi_blanc, koi_or, argente, carpe_jade, lanterne, braise | 7 poissons | SVG |
| `decor/float-<nom>.svg` : nenuphar, fleur, feuille, glace, lave, lanterne | 6 flottants | SVG |

Pour la retouche : contour un peu plus épais pour s'aligner sur les références, et plus de profondeur (premier plan, plan moyen, lointain) dans les horizons de `coucher` et `neon`, qui sont plus pauvres que leurs références.

### 5.6 Interface - priorité 2

| Élément | Aujourd'hui | À produire |
|---|---|---|
| Logo | texte « KATA.io » (Big Shoulders, « .io » ocre) sur un ensō rouge `#c8463b` en SVG | logo dessiné, même idée (ensō au pinceau + titre) |
| Icône d'application | `icon-192.png`, `icon-512.png` : « K » ocre dans un cercle rouge sur fond encre | version illustrée, lisible à 48 px |
| Icônes de la barre d'actions | SVG au trait dans `index.html` : emote (bulle), parer (bouclier), esquive (flèche et traits), frapper (poing) | jeu d'icônes cohérent, en deux états (normal, prêt ou actif) |
| Icônes de l'accueil | SVG au trait : étages (temple), entraînement (cible), créer un duel (sabres) | idem |
| Défi du jour | `items/scroll-thunder.png` (pack) | parchemin |
| Parchemins de technique | `items/scroll-*.png` (pack), un par technique débloquée, au résultat : plante (enchaînement), glace (parade), roche (coup chargé), vide (finisseur), foudre (élan), feu (paume du dragon) | 6 parchemins de technique, plus le parchemin du défi du jour |
| Pièce | `items/gold-coin.png` (pack) | pièce de monnaie du jeu (trou carré, style mon japonais) |
| Boutique | `fx/chest.png` (pack) | coffre |
| HUD | barres pleines : souffle en 3 segments (os), qi (jade, or quand plein), score, pourcentage | cadres de jauges, pastilles de score, icône de souffle |
| Étoiles de résultat | 1 à 3 étoiles | étoile pleine et vide |
| Confettis du résultat | code | à garder en code |
| Écran « Tourne ton téléphone » | texte | petite illustration de téléphone qui pivote |
| Panneaux, boutons | CSS plat sombre | la maquette `ui-accueil.png` propose bois, parchemins et liserés néon : à décider si on va jusque-là |

Écrans existants : accueil, boutique, liste des étages, salon de duel (code et choix du dojo), connexion en cours, résultat (étoiles, XP, déblocages), déconnexion, quitter, barre de tutoriel, notifications.

### 5.7 Assets morts (à supprimer, voir `TODO.md` phase 1)

`dojo.png`, `dojo-mousse.png` (ancien sol du dojo, encore chargés mais plus affichés), `items/gold-cup.png`, `silver-cup.png`, `gold-key.png`, `little-treasure-chest.png`.

### 5.8 Hors visuel

Sons et musique sont synthétisés en WebAudio (`src/game/audio.ts`), aucun fichier. Un brief sonore viendra plus tard.

---

## 6. Ordre de production proposé

1. **Trancher le style cible** (section 1) et la méthode d'animation des combattants (pantin découpé ou image par image).
2. **Fiche de style** : une planche qui montre le ninja bleu, une arme, un impact et un bout de dojo ensemble, pour valider la cohérence avant de produire en série.
3. **Combattants** : ninja bleu et ninja pourpre d'abord (les deux de départ), puis les gardiens dans l'ordre de la Tour.
4. **Effets de combat**, avec l'éclat d'avertissement du coup entrant.
5. **Armes** et **interface** (icônes, logo, HUD).
6. **Dojos** : références manquantes, textures de plateforme, lanternes, eau.
7. **Boutique** : particules et ploufs.

## 7. Comment livrer un asset

- Fond transparent (PNG) ou SVG propre, sans texte incrusté.
- Nommage : celui des identifiants ci-dessus (`ronin`, `fish-koi_or`, `bg-volcan`…), pour que l'intégration ne demande pas de table de correspondance.
- Une source par asset (fichier de travail ou prompt utilisé) dans `art/source/`, et le résultat final dans `public/assets/`.
- Vérifier la licence de l'outil de génération pour un usage commercial.
