// État d'affichage partagé entre l'interface HTML et la scène Phaser (sans dépendance circulaire).
export const viewState = {
  shop: false, // la boutique est ouverte : la caméra décale le dojo pour laisser voir les aperçus
  dojo: null as string | null, // dojo prévisualisé derrière le salon d'invitation
  world: 'cerisiers', // monde de l'entraînement, choisi à l'accueil (et décor derrière l'accueil)
};
