# Découpage des planches d'assets

Les planches générées (`art/reference/mondes/*-planche.png`) sont posées sur un fond uni. Ces scripts en tirent un PNG transparent par élément, rangé dans `art/decoupe/<monde>/`. Il faut Pillow et ImageMagick (`magick`).

1. `python3 scripts/planches/decouper.py <planche> <dossier> [seuil] [cadres] [dilatation]` : un PNG par élément, légendes du bas retirées, aperçu numéroté `<dossier>.preview.png`. `seuil` = écart toléré avec la couleur du fond (14 par défaut, 5 pour un fond blanc avec de la neige). `cadres` = `1` pour effacer les traits des cadres de section. `dilatation` = `Disk:2` par défaut, `Disk:1` si des éléments proches se collent.
2. `python3 scripts/planches/separer-groupes.py <planche> <dossier> <seuil>` : redécoupe chaque élément sans dilatation pour séparer les groupes (bambous, koï).
3. `python3 scripts/planches/separer-tuiles.py <image> <dossier> <seuil> <érosion>` : sépare des tuiles isométriques qui se touchent (érosion du masque puis regonflement).
4. `python3 scripts/planches/ranger.py <dossier des découpes> art/decoupe` : renomme les morceaux retenus (table `M` à adapter aux numéros des aperçus), retire les éclats isolés et fait un aperçu par monde.

Les numéros dépendent de la planche : on regarde les aperçus, puis on remplit la table de `ranger.py`.
