# Direction artistique - Kata.io

Inventaire de tout ce qui se voit dans le jeu au 2026-10-24 : style, palettes, environnements, assets, et ce qui est à produire. Sert de brief pour faire générer les visuels par une autre IA.

Légende de l'état : **Pack** = pack Ninja Adventure (pixel art 16 px, CC0), **SVG** = généré par `scripts/build-decor-svg.py`, **Code** = dessiné par Phaser dans `src/game/render/`, **Réf.** = visuel de référence dans `art/reference/`, **Mort** = présent mais plus utilisé.

---

## 1. Constat : trois styles cohabitent

| Couche | Style actuel | Où |
|---|---|---|
| Combattants, armes, effets de coup, objets de boutique | **Pixel art 16 px** (pack Ninja Adventure), agrandi ×3 sans lissage | `public/assets/persos.png`, `armes.png`, `fx/`, `items/` |
| Horizons, poissons, objets flottants | **Vectoriel plat cartoon** : aplats, dégradés doux, contour sombre fin | `public/assets/decor/*.svg` |
| Plateforme du dojo, lanternes, eau, particules d'ambiance, lignes de vitesse | **Formes dessinées en code** (losange, rectangles, ellipses) | `src/game/render/` (`arena.ts`, `lake.ts`, `effects.ts`) |
| Interface HTML | **Sombre, encre et ocre**, typographie condensée, icônes au trait | `src/style.css`, `index.html` |
| Références | **Cartoon cel-shading** : contour noir épais, ombres en aplat, lumière chaude | `art/reference/*.png` |

Le pixel art est la couche qui jure : les décors et les références sont déjà dans une même famille (cartoon vectoriel à contour), les personnages non.

### Décision à prendre : le style cible

**Décidé le 2026-10-25 pour les combattants : on garde le pixel art**, agrandi d'un tiers (`FIGHTER_PX = 4` dans `src/game/assets.ts`). Un pantin découpé dessiné a été essayé puis abandonné (voir [PROMPTS-COMBATTANTS.md](PROMPTS-COMBATTANTS.md)).

**Recommandation : cartoon cel-shading à contour sombre, celui des références.** Les décors SVG en sont déjà proches, et la maquette `accueil-v2.png` montre qu'il tient aussi pour l'interface. Le pixel art serait remplacé progressivement, en commençant par les combattants. Les maquettes des mondes (section 5) vont dans ce sens.

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

C'est la palette actuelle. La maquette retenue (`accueil-v2.png`, section 5) la fait glisser vers le bleu nuit (`#111820`, `#2f3943`), avec des boutons dorés (`#c1a16d`) et un texte crème (`#cdc2a6`) ; l'ocre, le jade et le rouge restent les accents.

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
| Horizons (actuels) | 2400 × 420 unités, rastérisés à 4096 px de large au plus (limite des GPU mobiles). **Tout l'important entre x = 500 et x = 1900** : c'est la zone visible sur téléphone en paysage. Ligne d'eau en bas, reflets compris. Format SVG de préférence (retouchable dans Inkscape ou Penpot). Ils disparaissent avec les nouveaux mondes. |
| Poissons | Vus de dessus, de profil, tête à droite, d'un seul tenant (le jeu les déforme en tranches). Cadre 276 × 96 px. |
| Objets flottants | Vus de trois quarts dessus, cadre 192 × 128 px, ombre portée légère incluse. |
| Effets animés | Bande horizontale d'images de même taille (32 × 32 px aujourd'hui), lisibles sur fond clair comme sombre. Prévoir des versions blanches que le jeu teinte. |
| Décor des mondes | Scène plein écran en isométrique trois quarts (environ 1,9:1), plateforme livrée à part en pièces détachables, premier plan livré à part en PNG transparents (section 5). |
| Mobile | Le jeu se joue en paysage, souvent sur un écran de 360 px de haut. Tester chaque asset à cette taille. |

---

## 4. Environnements : les six dojos (provisoires)

État actuel du jeu. Ces dojos seront tous remplacés par les mondes de la section 5.

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

Les références de la section 5 couvrent maintenant `bambou`, `neige` et `volcan`, ainsi qu'un nouveau monde aux cerisiers.

---

## 5. Les mondes : nouvelles références (2026-10-24)

Neuf images générées, dans `art/reference/mondes/` :

| Fichier | Contenu |
|---|---|
| `accueil-v2.png` | Maquette de l'accueil, version 2 |
| `bambou-planche.png` | Planche « Japanese garden arena » (bambous, jardin) |
| `bambou-jeu.png` | Maquette en jeu : jardin aux bambous |
| `cerisiers-jeu.png` | Maquette en jeu : cerisiers |
| `cerisiers-planche.png` | Planche des cerisiers |
| `neige-jeu.png` | Maquette en jeu : le Temple enneigé |
| `neige-planche.png` | Planche du Temple enneigé (titrée « Monde 2 ») |
| `forge-jeu.png` | Maquette en jeu : la Forge des forteresses |
| `forge-planche.png` | Planche de la Forge (titrée « Monde 3 ») |

### Décidé (2026-10-24)

- **Toutes les plateformes et tous les décors actuels seront remplacés** par ceux des nouveaux mondes : les six dojos (`coucher`, `bambou`, `brume`, `neige`, `neon`, `volcan`) et leurs horizons SVG sont provisoires.
- **Vue : isométrique trois quarts**, comme les maquettes des cerisiers, de la neige et de la forge (vue de dessus, décor tout autour de la plateforme). Le jardin aux bambous passe aussi dans cette vue.
- **Profondeur : un premier plan en parallaxe** (voir « Premier plan et parallaxe » plus bas).
- **On découvre les mondes en montant la Tour**, trois étages par monde, dans l'ordre de la difficulté :

| Monde | Étages | Gardiens |
|---|---|---|
| 1. Le Jardin des cerisiers | 1 à 3 | Le gardien de la porte (bandit), Le moine distrait, La sentinelle (samouraï) |
| 2. Le Jardin aux bambous | 4 à 6 | Le batelier (rōnin), Maître Kenji (oni), Le squelette dansant |
| 3. Le Temple enneigé | 7 à 9 | Le forgeron (sumo), L'ombre, Le loup blanc |
| 4. La Forge des forteresses | 10 à 12 | Le vieil ermite, Le dragon de jade, Le maître du temple (shōgun d'or) |

  Pourquoi cet ordre : on va du plus doux (printemps, eau calme) au plus menaçant (lave, forteresse). Le loup blanc tombe dans la neige et le shōgun d'or dans sa forteresse, en boss final. Au-delà de l'étage 12 (tour sans fin), les quatre mondes reviennent en boucle, trois étages chacun. Le défi du jour tire un monde d'après la date ; en duel, l'hôte choisit parmi les quatre. Les planches de la neige et de la forge sont titrées « Monde 2 » et « Monde 3 » : cette numérotation est remplacée par celle du tableau.
- **`brume` et `neon`** n'ont pas de monde pour l'instant : de futurs mondes, notés dans `TODO.md`.
- **Interface : la maquette v2** (`accueil-v2.png`, bleu nuit et or) remplace `ui-accueil.png` (bois et néon), **sauf le logo** (voir plus bas).

### Ce que ces références changent

1. **La caméra.** Les trois mondes sont vus de haut, en isométrique, avec un décor **tout autour** de la plateforme : plus de ciel ni d'horizon en bande. Le décor devient une illustration plein écran par monde (ou un assemblage d'éléments isométriques), avec la plateforme assemblée à part au centre. La contrainte actuelle des horizons (2400 × 420, zone utile entre x = 500 et x = 1900) ne s'applique plus. La nouvelle : un format d'environ 1,9:1 comme les maquettes, l'important groupé autour de la plateforme, des coins que le téléphone peut rogner. La maquette aux bambous, en caméra basse avec horizon, est à refaire dans cette vue.
2. **Le style.** Illustration cartoon à contour sombre, grain légèrement « pixel HD », couleurs franches propres à chaque monde. Ça confirme la recommandation de la section 1 (cartoon à contour) et écarte le pixel art 16 px.
3. **Un plan de masse réutilisé.** Cerisiers et neige ont exactement la même disposition : grand torii au fond, deux torii sur les côtés, pont à droite, pagode en haut à droite, lanternes de pierre aux coins. C'est une bonne méthode : un plan par famille de mondes, redécoré à chaque saison. Moins de génération, et une arène qu'on reconnaît d'un monde à l'autre.
4. **Ce qui entoure la plateforme change de matière** : eau (cerisiers, bambous), glace fissurée sur de l'eau (neige), lave (forge). L'éjection doit s'adapter (voir les points de vigilance).

### Premier plan et parallaxe

Pour donner de la profondeur à une vue de dessus, on ajoute devant la scène quelques éléments **très grossis**, coupés par le bord de l'écran, comme les bambous au premier plan de `bambou-jeu.png`. Quand la caméra suit les combattants, zoome sur un impact ou tremble, ce premier plan bouge plus vite que le reste : c'est la parallaxe.

- **Les couches**, de l'arrière vers l'avant : la scène (décor plein écran) ; l'eau, la glace ou la lave animées par le code ; la plateforme ; les combattants et les effets ; le premier plan.
- **Le premier plan** : deux à quatre éléments par monde, sur les bords et dans les coins, jamais devant la plateforme. Plus sombres et moins détaillés que la scène, avec un léger flou, pour ne pas attirer l'œil. Chacun dans son propre PNG transparent.
- **Par monde** :
  - cerisiers : branches fleuries qui entrent par le haut, pétales en gros plan ;
  - bambous : tiges et feuilles de bambou sur les côtés ;
  - neige : branches de pin chargées de neige, flocons en gros plan ;
  - forge : bannières sashimono et pointes de roche, fumée et braises en gros plan.
- **Optionnel** : la scène elle-même en deux couches (lointain et plan moyen), pour une parallaxe plus douce derrière la plateforme.

### Monde 1 : le Jardin des cerisiers (étages 1 à 3)

Pas de titre sur la planche ; « Le Jardin des cerisiers » est proposé. Le dojo actuel le plus proche est `coucher`.

- **Ambiance** : printemps, rose et turquoise, lumière dorée au fond de la scène.
- **Palette relevée** : pétales `#d3b0ad`, eau `#59a8b2`, bois `#b49469`, écorce `#4d3837`, rouge des torii `#a6565e`.
- **Plateforme** : planches de bois clair, liseré vert jade, tranche en bois.
- **Autour** : étang turquoise avec ondes, rives herbeuses fleuries.
- **Assets de la planche** : plateforme entière, segments de bord (angles et côtés) et planches détachées ; tuile d'eau ; rive d'étang avec galets ; trois cerisiers (rose pâle, rose vif, blanc) ; nénuphars, lotus rose et blanc ; koï (rouge et blanc, noir et or, argenté) ; pétales ; herbes, roseaux, branches moussues ; lanterne de pierre (ishi-dōrō), torii grand et petit, pont arqué, stèle ; éclaboussure, pétales qui volent.

### Monde 2 : le Jardin aux bambous (étages 4 à 6)

Correspond au dojo `bambou`. La maquette (`bambou-jeu.png`) est la seule en caméra basse : bambous au premier plan, torii planté dans l'eau, pagode au fond, horizon visible. La planche (`bambou-planche.png`) est une boîte à outils commune à plusieurs mondes : torii (quatre tailles), pagodes (quatre), lanternes de pierre, ponts (trois), plateforme et tuiles, eau d'étang en tuiles, bambous, pins (dont enneigés), koï, nénuphars, lotus, rochers moussus.

**À refaire en vue isométrique trois quarts**, comme les autres mondes. Ses bambous au premier plan sont le modèle du premier plan en parallaxe.

### Monde 3 : le Temple enneigé (étages 7 à 9)

Correspond au dojo `neige`.

- **Ambiance** : hiver lumineux, blanc et bleu glacier.
- **Palette relevée** : neige `#d9ebf0`, glace `#a3d4dd` et `#75c6cc`, ombres `#4d5c65`, bleu-gris `#6e94a2`.
- **Plateforme** : planches grises givrées. Sur la maquette, la tranche porte une corde sacrée (shimenawa) avec ses papiers en zigzag (shide) et des stalactites. La planche fournit des plaques de planches détachables avec de la neige sur les bords.
- **Autour** : glace turquoise, lisse ou fissurée, sur une eau très froide.
- **Assets de la planche** : dalles de glace (lisse, givrée, fissurée en plusieurs états), lotus pris dans la glace, koï sous la glace, torii enneigés, lanternes enneigées, prunier en fleur, pin enneigé, bambous enneigés, buissons ; flocons, rafale de neige.
- **À ne pas reprendre** : le koï arc-en-ciel (hors palette) et le panneau « 6. Collision » (le jeu calcule lui-même les collisions, il n'y a rien à dessiner).

### Monde 4 : la Forge des forteresses (étages 10 à 12)

Correspond au dojo `volcan` : la forteresse remplace le volcan au loin.

- **Ambiance** : château de l'époque Edo au milieu de la lave, rouge et noir, fumée.
- **Palette relevée** : brun rouge `#582a24`, obsidienne `#301b1a`, lave `#e25726` et `#efa14a`, rouille `#9b3623`, bannières crème `#d1c2a8`.
- **Plateforme** : dalles d'obsidienne fissurées, cerclées de fer riveté. La planche en donne une vingtaine de variantes, de la dalle intacte à la dalle très fissurée et incandescente. **C'est idéal pour la mort subite** : les dalles se fissurent, rougeoient, puis tombent.
- **Autour** : lave avec bulles et îlots de roche.
- **Assets de la planche** : dalles et bords de plateforme, tuiles de lave (avec bulles, avec rocher), rochers volcaniques, arbres morts, murs et tours de forteresse, bannières sashimono (six couleurs, avec blason) ; fumerolles, étincelles, flammèches, bulle de lave qui éclate.

### Maquette de l'accueil, version 2 (retenue)

- **Ce qui change par rapport à l'accueil actuel** : barre d'onglets (Accueil, Combattants, Temple, Boutique, Communauté), bannière d'invitation en haut, carte de rang avec la prochaine technique illustrée, cartes « Recommandations » (Tour du temple illustrée par une pagode, Défi du jour), duel privé et « rejoindre par code » côte à côte, « Mon combattant » avec portrait et arme.
- **Style retenu** : panneaux bleu nuit (`#111820`, `#2f3943`), boutons dorés en relief (`#c1a16d`), texte crème (`#cdc2a6`), accent jade pour la barre d'XP (`#6db3a2`).
- **Logo : on garde le logo actuel**, pas le gros titre doré en pierre de la maquette. Le logo actuel est d'esprit japonais : « KATA.io » en capitales condensées, « .io » en ocre, sur un ensō rouge (cercle zen tracé au pinceau, `#c8463b`). Il pourra être redessiné, mais dans cet esprit : trait de pinceau, sobre, pas de doré ni de relief.
- **Nouveautés de contenu, à décider avant de dessiner** : l'onglet Communauté et une page Combattants. Les noms d'étage (« La sentinelle ») existent déjà dans le jeu (`src/sim/progression.ts`).

### Points de vigilance (pour les neuf images)

- **Texte inventé** : tout le texte des images est faux ou déformé (« PAAER », « MIAPTES », « Ihnaitriss to prachaine technique »). On ne reprend ni le texte ni le HUD des maquettes. Leur disposition du HUD (score en haut, pourcentage en bas à gauche, boutons ronds en bas à droite) est déjà celle du jeu.
- **Combattants trop petits et hors style** : dans les maquettes, ce sont les sprites 16 px actuels, environ 40 px de haut sur une image de 1416 px. À côté d'un décor aussi détaillé, ils disparaissent. Les nouveaux combattants doivent avoir le même niveau de détail et de contour que le décor, et se détacher du sol (ombre portée, liseré clair).
- **Lisibilité du sol** : le décor est très chargé (cerisiers, lave). Le combat se lit sur la plateforme : sol plus calme et moins contrasté que les combattants, bords de plateforme bien marqués (c'est là qu'on tombe).
- **Les planches ne sont pas des assets prêts** : fond beige, angles et éclairages qui varient (arbres de face dans la planche des cerisiers, isométrique ailleurs). Chaque élément est à régénérer seul, sur fond transparent, au même angle que la plateforme. Les planches servent de liste et de référence de style. En attendant, elles sont découpées en éléments provisoires dans `art/decoupe/<monde>/` (aperçu par monde : `art/decoupe/<monde>-apercu.png`, scripts dans `scripts/planches/`) pour monter un prototype jouable des quatre mondes.
- **L'éjection** : aujourd'hui, un plouf dans l'eau. Sur la glace : la glace casse, puis plouf. Sur la lave : éclaboussure de lave et fumée, avec un ton à décider pour un jeu tout public (par exemple, le combattant ressort en fumant, façon dessin animé). Les ploufs de la boutique devront fonctionner sur les trois matières.
- **Poissons** : silhouettes floues sous la glace ; aucun dans la lave, remplacés par des bulles.

---

## 6. Inventaire des assets

### 6.1 Combattants (14) - priorité 1

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

**Poses nécessaires** (ce que le jeu affiche aujourd'hui, `src/game/render/fighters.ts`) :

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

### 6.2 Armes (7 + mains nues) - priorité 2

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

### 6.3 Effets de combat - priorité 2

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

### 6.4 Boutique d'effets - priorité 3

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

### 6.5 Décor vectoriel (provisoire, remplacé par les mondes)

| Fichiers | Nombre | État |
|---|---|---|
| `decor/bg-<dojo>.svg` | 6 horizons | SVG, cohérent avec la cible |
| `decor/fish-<espèce>.svg` : koi_orange, koi_blanc, koi_or, argente, carpe_jade, lanterne, braise | 7 poissons | SVG |
| `decor/float-<nom>.svg` : nenuphar, fleur, feuille, glace, lave, lanterne | 6 flottants | SVG |

Pour la retouche : contour un peu plus épais pour s'aligner sur les références, et plus de profondeur (premier plan, plan moyen, lointain) dans les horizons de `coucher` et `neon`, qui sont plus pauvres que leurs références.

### 6.6 Interface - priorité 2

| Élément | Aujourd'hui | À produire |
|---|---|---|
| Logo | texte « KATA.io » (Big Shoulders, « .io » ocre) sur un ensō rouge `#c8463b` en SVG | **à garder** ; éventuellement redessiné dans le même esprit japonais (ensō au pinceau + titre), sans doré ni relief |
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
| Panneaux, boutons | CSS plat sombre | style de la maquette `accueil-v2.png` : panneaux bleu nuit, boutons dorés en relief |

Écrans existants : accueil, boutique, liste des étages, salon de duel (code et choix du dojo), connexion en cours, résultat (étoiles, XP, déblocages), déconnexion, quitter, barre de tutoriel, notifications.

### 6.7 Assets archivés

`dojo.png`, `dojo-mousse.png` (ancien sol du dojo), `items/gold-cup.png`, `silver-cup.png`, `gold-key.png`, `little-treasure-chest.png` : sortis de `public/` et rangés dans `archive/assets/`.

### 6.8 Hors visuel

Sons et musique sont synthétisés en WebAudio (`src/game/audio.ts`), aucun fichier. Un brief sonore viendra plus tard.

---

## 7. Ordre de production proposé

1. **Trancher le style cible** (section 1), les décisions sur les mondes (section 5) et la méthode d'animation des combattants (pantin découpé ou image par image).
2. **Fiche de style** : le ninja bleu, une arme et un impact, posés sur la plateforme du monde 1, à la taille réelle du jeu. Ça valide que les combattants tiennent face aux nouveaux décors avant de produire en série.
3. **Combattants** : ninja bleu et ninja pourpre d'abord (les deux de départ), puis les gardiens dans l'ordre de la Tour.
4. **Effets de combat**, avec l'éclat d'avertissement du coup entrant.
5. **Armes** et **interface** (icônes, logo, HUD).
6. **Mondes**, dans l'ordre de la Tour : cerisiers d'abord (scène plein écran, plateforme en pièces détachables, eau, premier plan), puis bambous, neige et forge.
7. **Boutique** : particules et ploufs.

## 8. Comment livrer un asset

- Fond transparent (PNG) ou SVG propre, sans texte incrusté.
- Nommage : celui des identifiants ci-dessus (`ronin`, `fish-koi_or`, `bg-volcan`…), pour que l'intégration ne demande pas de table de correspondance.
- Une source par asset (fichier de travail ou prompt utilisé) dans `art/source/`, et le résultat final dans `public/assets/`.
- Vérifier la licence de l'outil de génération pour un usage commercial.
