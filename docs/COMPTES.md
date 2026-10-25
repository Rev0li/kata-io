# Comptes joueurs - Kata.io

Conception du 2026-10-25 (décision D13 de [DECISIONS.md](DECISIONS.md)). Rien n'est codé : ce document sert de plan.

## Objectif

Que le joueur soit **sur son compte sans y penser** : aucun écran de connexion pour commencer à jouer, et un seul clic pour retrouver sa progression sur un autre appareil.

Aujourd'hui toute la progression (XP, étages, étoiles, pièces, effets achetés, apparence, défi du jour) vit dans le navigateur (`localStorage`, clé `kata-io-dev-profile`). Changer de téléphone ou vider le navigateur efface tout.

## Parcours

1. **Premier lancement : compte invité, en silence.** Le jeu crée un compte invité côté serveur (identifiant aléatoire) et garde la session dans un cookie de longue durée. La progression est sauvegardée sur le serveur dès la première partie. Aucun écran.
2. **Protéger sa progression.** Dès que l'**étage 3 de la Tour** est gagné, une invitation discrète apparaît, sur l'écran de résultat puis dans le Vestiaire : « Protège ta progression ». Deux boutons : **Google** et **Discord**. Le compte invité devient un vrai compte, sans rien perdre.
3. **Autre appareil.** Dans les paramètres : « J'ai déjà un compte », les mêmes deux boutons, et on retrouve tout. Si l'appareil avait déjà une progression d'invité, on garde la meilleure des deux (fusion, voir plus bas).
4. **Se déconnecter** : dans les paramètres. On repart sur un nouveau compte invité.

```
  Premier lancement ──► compte invité (silencieux) ──► on joue, tout est sauvegardé
                                   │
                 étage 3 gagné     ▼
                  « Protège ta progression »  [Google] [Discord]
                                   │
                                   ▼
                     vrai compte (même progression)
                                   │
          autre appareil ──► Paramètres ▸ « J'ai déjà un compte » ──► [Google] [Discord]
```

## Méthodes de connexion

| Méthode | Retenue | Pourquoi |
|---|---|---|
| Google | oui | Un clic, le plus répandu. |
| Discord | oui | Un clic, très utilisé par les joueurs. |
| Code par e-mail | plus tard, si besoin | Demande un service d'envoi d'e-mails. |
| Passkey | plus tard, si besoin | Récupération liée à l'appareil ou au trousseau. |
| Pseudo + mot de passe | non | Mot de passe oublié = compte perdu, sans e-mail pour le récupérer. |

Le **nom affiché en jeu** reste le pseudo choisi dans le Vestiaire, jamais le nom du compte Google ou Discord.

## Réservé aux comptes protégés

- **Duel public** (affronter un joueur au hasard), en plus des conditions actuelles (toutes les techniques et les 12 étages de la Tour).
- **Classement du défi du jour.** Le défi lui-même reste jouable par tous ; seul le classement demande un compte protégé.

Le duel privé (avec un code) reste ouvert à tous, invités compris.

## Ce qui est sauvegardé

Le profil actuel (`src/ui/profile.ts`), à l'identique : nom, apparence, XP, étages débloqués, étoiles, pièces, effets possédés, série, essais par étage, défi du jour, réglages (son, musique, visée automatique).

- **Format** : un document JSON par joueur, avec un numéro de version et une date de mise à jour. Pas de table par champ tant que le profil change souvent.
- **Synchronisation** : le jeu garde le profil en local (le jeu marche hors ligne) et l'envoie au serveur après chaque partie et à chaque achat. Au lancement, il récupère la version du serveur.
- **Fusion** (invité + compte existant, ou deux appareils) : on garde le maximum de l'XP, des étages, des étoiles ; l'union des effets possédés ; le maximum des pièces. Simple et jamais perdant pour le joueur.

## Architecture

```
navigateur ── kata.rev0li.duckdns.org ──► Caddy (VPS)
                                            ├── /            jeu (fichiers construits par Vite)
                                            └── /api/compte  service comptes : BetterAuth + PostgreSQL
                                                             (plus tard /api/jeu : serveur de salle, phase 4)
```

- **BetterAuth** (connu grâce à rev0auth), avec le plugin des **comptes invités** (anonymous) et les fournisseurs **Google** et **Discord**.
- **Instance séparée de rev0auth** : sa propre base PostgreSQL, ses propres secrets. Les joueurs publics n'ont rien à faire dans la plateforme privée (rôles, console d'administration, SongSurf).
- **Hébergé sur le VPS**, à côté de rev0auth et du futur serveur de jeu (phase 4), derrière Caddy.
- **Un seul domaine** : `kata.rev0li.duckdns.org` sert le jeu et l'API. Les cookies de session restent « first-party », donc acceptés par Safari et en navigation privée. DuckDNS ne fait que pointer vers l'IP du VPS : c'est Caddy qui sert le jeu, Vercel reste pour les prévisualisations des branches.
- **En attendant le domaine** : `vercel.json` redirige `/api/compte/*` vers le VPS, pour que le navigateur ne voie qu'un seul domaine.

## Sécurité et triche

- **Mode test** : désactivé pour les comptes protégés (pièces gratuites, ceinture, étages). Il reste en local et sur les prévisualisations.
- **Triche** : aujourd'hui c'est le navigateur qui calcule XP et pièces ; un joueur motivé peut modifier son profil. Acceptable tant qu'il n'y a ni classement ni échange. Avant un classement : le serveur recalcule les récompenses à partir des résultats de partie, ou les parties se jouent sur le serveur autoritaire (phase 4).
- **Limites** : débit limité sur `/api/compte`, taille maximale du profil, comptes invités inactifs depuis 6 mois supprimés.
- **Données personnelles** : on ne stocke que l'identifiant fourni par Google ou Discord et l'e-mail s'il est fourni ; une page « supprimer mon compte » dans les paramètres.

## Joueurs actuels

Leur progression locale est **reprise automatiquement** dans leur premier compte invité, au premier lancement après la mise en service des comptes. Rien à faire de leur côté.

## Étapes

1. Service comptes sur le VPS : BetterAuth + PostgreSQL, comptes invités, Google et Discord (applications OAuth à créer chez chacun).
2. API du profil : lire, écrire, fusionner (avec tests).
3. Côté jeu : création silencieuse du compte invité, synchronisation du profil, reprise d'un profil local existant au premier lancement.
4. Interface : invitation « Protège ta progression », « J'ai déjà un compte » et « Se déconnecter » dans les paramètres.
5. Domaine `kata.rev0li.duckdns.org` servi par Caddy (jeu + API), puis fin de la redirection Vercel.

## Décidé le 2026-10-25

- Invitation à protéger son compte : **dès que l'étage 3 de la Tour est gagné**.
- **Duel public et classement du défi du jour réservés aux comptes protégés.**
- **Progression locale des joueurs actuels reprise automatiquement** dans leur premier compte invité.
