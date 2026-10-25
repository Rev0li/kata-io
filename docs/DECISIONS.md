# DECISIONS - KATA.io
 
Format : une fiche par décision (Question, Décision, Statut, Conséquence technique, Test). Mis à jour le 2026-10-24.
 
Légende statut : DÉCIDÉ / HYPOTHÈSE (à tester) / OUVERT. **Intégré** = présent dans le code (bloc `RULES` de `src/sim/data.ts`), valeurs encore à régler en jouant.
 
---
 
## D1. Condition de victoire d'une manche
- **Question :** qu'est-ce qui fait gagner : sortie de l'arène, épuisement de l'état, ou les deux ?
- **Décision :** la **sortie de l'arène** (ring-out). **Statut : DÉCIDÉ.**
- **Précision :** un combattant **épuisé** (souffle insuffisant) peut être éliminé en **un seul coup** (one-shot).
- **Intégré :** épuisé = souffle < 1 segment. Le recul reçu est multiplié par `exhaustKbMult` (2,6) et « ÉPUISÉ ! » s'affiche.
- **Test :** vérifier que le one-shot sur épuisé est compréhensible et ne donne pas l'impression d'injustice (voir protocole de test).
 
## D2. Valeurs internes du combattant
**Statut : DÉCIDÉ pour souffle et stabilité, OUVERT pour équilibre.**
 
| Valeur | Rôle | Statut |
|---|---|---|
| `souffle` (3 segments) | Endurance. Limite le spam d'actions. Insuffisant : épuisé, vulnérable au one-shot. | DÉCIDÉ, intégré |
| `pct` (stabilité, en %) | Plus il est élevé, plus le recul et la projection reçus sont grands. | DÉCIDÉ, déjà dans le jeu |
| `dodgeCount` (équilibre) | Compteur d'esquives parfaites d'affilée, remis à zéro quand on est touché. Donne un bonus (nature à définir). | OUVERT, compteur intégré, bonus désactivé (`balanceEnabled: false`) |
 
- **Questions ouvertes pour l'équilibre :**
  1. Quel bonus (souffle récupéré, recul réduit, prochain coup renforcé, temps de parade) ?
  2. Seuil de déclenchement (`balanceDodgesRequired`, 3 par défaut) ou effet progressif ?
  3. Les esquives sans attaque adverse comptent-elles ? (non : seules les esquives parfaites comptent aujourd'hui)
 
## D3. Visibilité de l'état
- **Décision :** l'état de l'adversaire **n'est pas communiqué** au joueur. **Statut : DÉCIDÉ (adversaire), intégré.**
- **Intégré :** le pourcentage de l'adversaire n'est plus affiché (`showOpponentPct: false`). Il reste visible avec `?debug` dans l'adresse.
- **OUVERT :** le joueur voit-il sa propre stabilité ? Aujourd'hui son pourcentage et son souffle sont visibles.
- **Test :** 5 joueurs sans explication. Critère : au moins 4 sur 5 expliquent pourquoi ils sont en danger.
 
## D4. Sensation de combat (animé)
- **Décision :** sensation de **puissance type animé japonais**. **Statut : DÉCIDÉ, intégré, à régler.**
- **Déjà dans le jeu :** arrêt sur image à l'impact, tremblement d'écran, ralenti et caméra sur l'éjection décisive, anneaux et étincelles.
- **Ajouté :** lignes de vitesse (éclat radial et traînées dans le sens du recul, plus fortes pour le coup chargé et la paume du dragon), flashs de couleur plein écran (blanc, rouge, doré), petit coup de zoom à l'impact, zoom marqué (×1,75) avec trois éclats de lignes sur l'éjection décisive.
- **À tester :** intensité des flashs sur mobile (risque de gêne visuelle), lisibilité pendant les lignes de vitesse. Penser à une option « effets réduits » dans les réglages.
 
## D5. Risque : combat sans engagement
- **Constat :** si être épuisé est dangereux, chacun peut attendre l'autre : **risque réel**. **Statut : traité par D6 et D9.**
 
## D6. Anti-stalemate
**Statut : HYPOTHÈSES à tester, dans cet ordre.**
 
1. Le souffle se régénère **à pleine vitesse seulement quand on avance** vers l'adversaire ou qu'on agit. **Intégré** (`regenIdle` 0,55 au repos ou en reculant).
2. Le bonus d'équilibre ne se gagne qu'en esquivant une **attaque réelle**. **Intégré** (esquive parfaite uniquement).
3. Une **parade réussie** fait récupérer du souffle. **Intégré** (+0,5 segment, +1 pour une parade parfaite).
4. **Mort subite** après **25 s** : le dojo rétrécit. **Intégré** (était 40 s).
5. Coup **chargé** coûteux en souffle et très puissant. **Déjà dans le jeu.**
 
- **Critère de décision :** sur 10 manches, la durée moyenne reste raisonnable et aucune manche ne dépasse le chrono sans action offensive.
 
## D7. Intégration dans le jeu : configuration externe
- **Décision :** toutes les valeurs de règles sont modifiables sans toucher au moteur. **Statut : DÉCIDÉ, intégré.**
- **Où :** objet `RULES` dans `src/sim/data.ts` (`exhaustKbMult`, `regenAdvance`, `regenIdle`, `parrySouffle`, `parryPerfectSouffle`, `balanceEnabled`, `balanceDodgesRequired`, `showOpponentPct`, et les réglages anti-spam de D9). Les valeurs plus anciennes (recul, esquive) sont des constantes du même fichier, et la mort subite est `SUDDEN_T` dans `src/sim/sim.ts`.
 
## D8. Personnages et statistiques différentes
- **Décision :** les personnages avec des statistiques ou avantages différents viennent **après** que le jeu "vanilla" soit **fun et complet**. **Statut : DÉCIDÉ (ordre de production).**
- **Échéance :** avant la V1 publique.
- **Principe :** le jeu de base doit être équilibré sans personnages. Les personnages modifieront les valeurs de `RULES` par des **multiplicateurs**, pas par de nouvelles règles.
- **Conséquence technique :** chaque combattant devient un **profil de paramètres** avec un profil "vanilla" par défaut. Ajouter un personnage = ajouter un profil.
- **Garde-fou :** vérifier que les avantages d'un profil ne rendent pas un nouveau joueur impuissant.
 
## D9. Anti-spam d'attaque
- **Question :** comment empêcher un joueur de gagner en martelant uniquement l'attaque ?
- **Décision :** **Statut : DÉCIDÉ, intégré, valeurs à régler.**
  - **Jauge de spam** par combattant : monte à chaque coup blanc (`spamPerAttack` 0,2), retombe avec le temps (`spamDecay` 0,3 par seconde) et baisse quand on pare, esquive ou charge (`spamDefend` 0,35). Seuil : `spamThreshold` 0,6 (environ 3 secondes d'attaque continue).
  - **Contre un bot (Tour, entraînement) :** au-dessus du seuil, le bot monte de niveau (`botAdaptRate` 0,06 par seconde, plafond `botAdaptMax` 0,35). « IL T'A LU » s'affiche sur lui.
  - **Contre un humain (PvP) :** au-dessus du seuil, chaque coup blanc coûte `spamAttackCost` (0,6) de souffle. Sans souffle, le coup est bloqué (« À BOUT DE SOUFFLE »).
  - **Message au joueur :** « Spam interdit : alterne parade, esquive et coup chargé », puis, au premier blocage, une explication complète (3 premières fois).
- **Questions ouvertes :** le seuil est-il trop sévère pour les débutants ? Faut-il un indicateur visible de la jauge de spam ?
 
## D10. Explications en jeu et cause d'éjection
- **Décision :** le jeu explique ce qui arrive plutôt que d'ajouter un tutoriel. **Statut : DÉCIDÉ, intégré.**
- **Intégré :** à chaque éjection du joueur, la cause est affichée (épuisé, pourcentage élevé, ou bord du dojo). Indices ponctuels (souffle épuisé, spam bloqué) affichés les 3 à 4 premières fois, mémorisés dans le navigateur.
- **Test :** protocole « Protocole de test - 5 joueurs ». Critère : 4 sur 5 expliquent la cause d'éjection.
 
## D11. Dojos
- **Décision :** six dojos en **SVG vectoriel** (coucher, bambou, brume, neige, néon, volcan), et non en pixel art. Les combattants restent en pixel art. **Statut : DÉCIDÉ, intégré.**
- **Tour :** un dojo tous les deux étages dans cet ordre. **Défi du jour :** dojo tiré de la date. **Duel entre amis :** l'hôte choisit le dojo dans le salon (ou au hasard), transmis à l'invité.
- **Mobile :** les éléments importants de l'horizon sont groupés entre x=500 et x=1900 (sur 2400) pour être visibles en paysage.
- **Faune et décor par dojo :** poissons articulés (corps et queue en SVG, animés par le code) qui fuient après un plouf, nénuphars, glace, roches de lave, lanternes, particules d'ambiance.
- **OUVERT :** le mélange pixel art (combattants) et vectoriel (décor) tient-il visuellement ? Sinon, soit refaire les combattants en vectoriel, soit rapprocher le décor.
 
## D12. Mesures de jeu (analytics)
- **Décision :** mesures anonymes (identifiant aléatoire local, aucune donnée personnelle), respect de « ne pas suivre ». **Statut : DÉCIDÉ, intégré.**
- **Événements :** `page_view`, `play_clicked`, `tutorial_started`, `tutorial_completed`, `match_started`, `match_ended` (avec coups, parades, esquives, spam déclenché et bloqué, coups reçus en étant épuisé, éjections), `match_abandoned` (où le joueur quitte), `rematch_clicked`, `invite_opened`, `disconnect`, `error`.
- **Réception :** fonction Vercel `api/e.js` qui écrit chaque événement dans les journaux Vercel. **OUVERT :** où stocker pour analyser dans la durée (journaux Vercel limités dans le temps ; options : Log Drain, base Vercel KV, PostHog).
- **Questions auxquelles les mesures répondent :** où les joueurs quittent (`match_abandoned`), combien relancent une revanche (`rematch_clicked` / `match_ended`), si l'anti-spam se déclenche trop (`spam` et `spamBlock` par partie).
 
---
 
## D13. Comptes joueurs
- **Question :** comment le joueur retrouve-t-il sa progression d'un appareil à l'autre, le plus simplement possible ?
- **Décision :** **compte invité d'abord**, créé en silence au premier lancement ; on le protège en un clic avec **Google** ou **Discord**. Pas de mot de passe. **Statut : DÉCIDÉ, pas encore codé.**
- **Technique :** BetterAuth + PostgreSQL sur le VPS, **instance séparée de rev0auth**. Le jeu et l'API servis sur un seul domaine (`kata.rev0li.duckdns.org`, à créer) par Caddy.
- **Précisions :** invitation à protéger son compte dès l'étage 3 gagné ; duel public et classement du défi du jour réservés aux comptes protégés ; progression locale actuelle reprise automatiquement.
- **Détails :** [COMPTES.md](COMPTES.md).

## Ordre de production retenu
1. **Vanilla fun et complet** : combat, souffle, stabilité, ring-out, anti-stalemate, anti-spam, sensation "animé", boucle manche/victoire/revanche.
2. **Duel privé** et multijoueur.
3. **Vertical slice** et UI finalisée.
4. **Personnages** et profils de statistiques.
5. **V1 publique.**
 
## Questions encore ouvertes
- Nature et seuil du bonus d'équilibre (D2).
- Le joueur voit-il son propre état (D3) ?
- Réglages anti-spam et épuisement après test (D1, D9).
- Cohérence visuelle pixel art / vectoriel (D11).
- Stockage des mesures de jeu (D12).
