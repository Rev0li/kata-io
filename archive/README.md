# Archive

Fichiers retirés du jeu mais gardés pour un usage futur. Rien ici n'est chargé ni déployé (hors de `public/`).

| Fichier | Origine | Pourquoi archivé |
|---|---|---|
| `assets/dojo.png`, `assets/dojo-mousse.png` | Tuiles du temple (Ninja Adventure, CC0), générées par `scripts/build-assets.py` | La plateforme est dessinée en code dans `src/game/render.ts` |
| `assets/items/gold-cup.png`, `silver-cup.png`, `gold-key.png`, `little-treasure-chest.png` | Objets du pack superpowers (CC0), copiés par `scripts/build-assets.py` | Jamais utilisés par le jeu ; pistes pour l'inventaire ou les récompenses |

`python3 scripts/build-assets.py` régénère aussi ces fichiers, directement dans ce dossier.
