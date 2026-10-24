// État d'affichage partagé entre l'interface HTML et la scène Phaser (sans dépendance circulaire).
export const viewState = {
  shop: false, // la boutique est ouverte : la caméra décale le dojo pour laisser voir les aperçus
  preview: null as null | { kind: 'trainee' | 'ejection'; id: string },
};
