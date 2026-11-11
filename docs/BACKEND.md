# Backend - Kata.io

Décision D19 de [DECISIONS.md](DECISIONS.md) (2026-11-11). Un seul service sur le VPS, derrière Caddy, construit en trois étapes. Seule l'étape 1 est codée.

| Étape | Contenu | État |
|---|---|---|
| 1 | Classement vérifié par rejeu des combats, mesures de jeu en base | **codé, pas encore déployé** |
| 2 | Comptes : invité silencieux, Google, Discord ([COMPTES.md](COMPTES.md)) | conçu |
| 3 | Duels : salles autoritaires en WebSocket qui font tourner `src/sim` | à concevoir |

```
navigateur ── kata-io (Vercel) ──► /api/jeu/*  relais Vercel ──► Caddy (VPS) ──► serveur de jeu :8787 ──► PostgreSQL
              le jeu, fichiers statiques                                        server/ (Node)
```

Vercel continue de servir le jeu. Le relais (`rewrites` de `vercel.json`) fait que le navigateur ne voit qu'un seul domaine : pas de CORS, et les cookies des futurs comptes resteront acceptés par Safari.

## Étape 1 : le classement vérifié

### Le problème

Le combat tourne chez le joueur. Avec l'ancien classement (`api/classement.js`, Upstash), il suffisait d'envoyer « 50 étages » pour être premier : le serveur ne refusait que l'impossible.

### Le principe

Un combat de la Tour est entièrement déterminé par quatre choses : sa **graine** (le hasard du gardien), l'**étage**, le **personnage** du joueur et ses **entrées**, pas par pas (60 par seconde). Le serveur possède la même simulation que le jeu (`src/sim`). Il peut donc refaire le combat et regarder lui-même qui gagne.

1. À l'accueil, le jeu demande une montée au serveur, qui répond par un identifiant et une **graine**. C'est le serveur qui choisit le hasard : le joueur ne peut pas chercher une graine facile.
2. Pendant chaque combat, le jeu **enregistre les entrées** du joueur (`Enregistreur` dans `src/sim/rejeu.ts`).
3. À la fin de la montée, le jeu envoie le pseudo et tous les combats.
4. Le serveur **rejoue** chaque combat dans l'ordre, depuis l'étage 1, avec les trois vies. Les étages et le temps inscrits sont ceux qu'il a trouvés, jamais ceux du message.

Refusé : une montée inconnue ou d'un autre joueur, déjà inscrite, de plus de 24 h, des entrées illisibles, un étage sauté, un combat après la dernière vie, une montée sans étage gagné, et une montée envoyée **plus vite que la durée de ses combats** (rejeu accéléré ou calculé hors ligne).

### Ce qui rend le rejeu exact

Le serveur doit retomber sur le même combat au bit près, sinon tout diverge en quelques secondes. Trois règles, à ne pas casser :

- **Mêmes combattants des deux côtés** : `combatEtage` (`src/sim/rejeu.ts`) construit le combat chez le joueur et sur le serveur.
- **Mêmes entrées** : le déplacement est arrondi (entier de -127 à 127) avant d'entrer dans la simulation, et la visée n'est pas enregistrée mais recalculée à chaque pas (`viser`).
- **Mêmes calculs sur toutes les machines** : `Math.sin`, `cos`, `atan2`, `exp` et `hypot` peuvent différer du dernier bit entre Safari, Firefox et Node. La simulation utilise donc ses propres versions (`src/sim/dmath.ts`), écrites avec les seules opérations exactes partout. `tests/dmath.test.ts` échoue si un fichier de `src/sim` rappelle une de ces fonctions de `Math`.

**Même version de la simulation** : le jeu et le serveur calculent une empreinte de `src/sim` (`server/version.ts`). Si elles diffèrent, le serveur n'ouvre pas de montée et le jeu joue des montées non classées (« le classement était injoignable au départ »). **Après chaque fusion qui touche `src/sim`, il faut redéployer le serveur.**

### Les limites

- Le rejeu prouve que la montée est **possible avec ces entrées**, pas qu'un humain les a jouées. Un robot qui joue en temps réel passerait. C'est le niveau de preuve habituel d'un classement de ce type ; aller plus loin demande des comptes et de la modération.
- Pas de compte : l'identifiant est le jeton anonyme du navigateur. Vider le navigateur, c'est repartir de zéro. L'étape 2 règle ce point.
- **Pas encore vérifié sur Safari ni sur iPhone.** À faire sur le premier aperçu branché au serveur : une montée jouée sur iPhone doit être acceptée. Un refus se lit dans les journaux (`montée refusée`, raison `rejeu impossible`).
- Le rejeu coûte du calcul (de l'ordre d'un dixième de seconde par combat). Le serveur rend la main entre deux combats et limite à 6 envois par minute et par joueur.

## L'API

Tout est sous `/api/jeu`. Réponses en JSON ; une erreur porte un champ `erreur`, en français, affiché tel quel au joueur.

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /api/jeu/sante` | | `{ ok, version }` |
| `POST /api/jeu/montee` | `{ id, v }` (`v` : version de la simulation du jeu) | `{ montee, graine }`, ou 409 si les versions diffèrent |
| `GET /api/jeu/classement?id=…` | | `{ top, moi, version }` : le top 20 et la ligne du joueur |
| `POST /api/jeu/classement` | `{ id, pseudo, montee, combats }` | le classement, plus `record`, `etages`, `secondes` |
| `POST /api/jeu/e` | `{ m, e }` (mesures de jeu, D12) | 204 |

Limites : 600 ko par requête, 120 requêtes par minute et par adresse, 20 montées ouvertes et 6 envoyées par minute et par joueur.

## Le code

```
server/
  index.ts        serveur HTTP : routes, taille des requêtes, débit, ménage périodique
  classement.ts   les règles (ouvrir, envoyer, lire, mesures), sans réseau : c'est ce que les tests vérifient
  base.ts         stockage : PostgreSQL en production, mémoire pour les tests et le développement
  version.ts      empreinte de src/sim
  Dockerfile, compose.yml, .env.example
src/sim/rejeu.ts  enregistrement, rejeu d'un combat, vérification d'une montée (partagé par le jeu et le serveur)
src/sim/dmath.ts  fonctions mathématiques reproductibles
tests/serveur.test.ts, tests/rejeu.test.ts, tests/dmath.test.ts
```

Tables (créées au démarrage) : `montees` (ouvertes puis closes, avec leur résultat), `records` (la meilleure montée de chaque joueur), `evenements` (mesures de jeu, gardées 180 jours).

## En développement

```bash
npm run serveur                       # serveur de jeu sur le port 8787, tout en mémoire
VITE_API_JEU=/api/jeu npm run dev     # le jeu, branché dessus (Vite relaie /api/jeu vers le port 8787)
```

Sans `VITE_API_JEU`, le jeu utilise l'ancien classement et n'enregistre rien. Pour essayer avec une vraie base : `DATABASE_URL=postgres://… npm run serveur`.

## Déploiement sur le VPS

À faire une fois :

1. Cloner le dépôt sur le VPS, puis :
   ```bash
   cp server/.env.example server/.env        # y mettre POSTGRES_PASSWORD (openssl rand -hex 24)
   docker compose -f server/compose.yml up -d --build
   curl http://127.0.0.1:8787/api/jeu/sante  # { "ok": true, "version": "…" }
   ```
   Le serveur n'écoute que sur `127.0.0.1` : seul Caddy l'atteint.
2. Caddy, sur le domaine choisi (`kata.rev0li.duckdns.org` est prévu par D13) :
   ```
   kata.rev0li.duckdns.org {
     handle /api/jeu/* {
       reverse_proxy 127.0.0.1:8787
     }
   }
   ```
3. Relais dans `vercel.json` :
   ```json
   "rewrites": [{ "source": "/api/jeu/:chemin*", "destination": "https://kata.rev0li.duckdns.org/api/jeu/:chemin*" }]
   ```
4. Dans Vercel, variable `VITE_API_JEU=/api/jeu`, d'abord sur **Preview** pour essayer (dont une montée sur iPhone), puis sur **Production**. Attention : un aperçu branché écrit dans le vrai classement.
5. Une fois la production branchée et vérifiée : supprimer `api/classement.js`, `api/e.js`, leur test, et la base Upstash. Les anciens scores, non vérifiés et joués avec une seule vie, ne sont pas repris.

À chaque fusion qui touche `src/sim` ou `server/` :

```bash
git pull && docker compose -f server/compose.yml up -d --build
```

Entre la mise en ligne du jeu par Vercel et cette commande, les montées ne sont pas classées. À automatiser plus tard (action GitHub qui déploie le serveur en même temps).

## Exploitation

```bash
docker compose -f server/compose.yml logs -f jeu                                   # journaux (une ligne JSON par événement)
docker compose -f server/compose.yml exec base pg_dump -U kata kata > kata.sql     # sauvegarde
docker compose -f server/compose.yml exec base psql -U kata kata                   # console SQL
```

Retirer un tricheur : `delete from records where joueur = '…';`

Les questions de D12, en SQL :

```sql
-- où les joueurs quittent
select props->>'floor' as etage, count(*) from evenements where nom = 'match_abandoned' group by 1 order by 2 desc;
-- parties par jour
select le::date as jour, count(*) from evenements where nom = 'match_started' group by 1 order by 1;
-- joueurs distincts par jour
select le::date as jour, count(distinct aid) from evenements group by 1 order by 1;
```

## Ensuite

- **Étape 2, comptes** : BetterAuth dans ce même service et cette même base ; le compte invité reprend l'identifiant anonyme, donc les records existants.
- **Étape 3, duels** : salles autoritaires en WebSocket (Colyseus) qui font tourner `src/sim` ; PeerJS et le serveur relais ne sont plus nécessaires. `dmath` et `rejeu` servent déjà de base : même simulation, mêmes entrées arrondies.
- Typage strict de `src/sim` (`Fighter` et `Sim` sont encore `any`), maintenant que le serveur en dépend.
