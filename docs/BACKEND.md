# Backend - Kata.io

Décision D19 de [DECISIONS.md](DECISIONS.md) (2026-11-11). Un seul service sur le VPS, derrière Caddy, construit en trois étapes. Les étapes 1 et 3 sont codées.

| Étape | Contenu | État |
|---|---|---|
| 1 | Classement vérifié par rejeu des combats, mesures de jeu en base | **en production** |
| 2 | Comptes : invité silencieux, Google, Discord ([COMPTES.md](COMPTES.md)) | conçu |
| 3 | Duels entre amis : salles en WebSocket où le serveur fait tourner `src/sim` | **codé** (2026-11-12) ; duel public à faire |

```
navigateur ── kata-io (Vercel) ──► /api/jeu/*  relais Vercel ──► Caddy (VPS) ──► serveur de jeu :8787 ──► PostgreSQL
              le jeu, fichiers statiques                                        server/ (Node)
```

Seul le duel ne passe pas par le relais : Vercel ne transporte pas le temps réel (WebSocket), le jeu parle donc directement à `wss://kata.rev0li.duckdns.org/api/jeu/duel`.

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

## Étape 3 : le duel arbitré par le serveur

Avant, un duel entre amis était pair à pair (PeerJS) : le navigateur du créateur faisait tourner le combat et arbitrait. Il pouvait donc tricher, il jouait sans délai contre un adversaire qui en avait, et la mise en relation dépendait d'un service public.

Maintenant, **la salle vit sur le serveur** (`server/duel.ts`) :

1. Le créateur ouvre un WebSocket ; le serveur lui donne un **code** de six caractères. Il peut choisir le dojo.
2. L'ami ouvre le lien (`?salle=CODE`) ; son WebSocket rejoint la salle.
3. Dès que les deux ont envoyé leur combattant, le serveur crée la simulation, la fait avancer à 60 pas par seconde et envoie **30 instantanés par seconde** aux deux. Chaque joueur n'envoie que ses entrées.
4. À la fin, revanche si les deux la demandent. Si l'un part, la connexion de l'autre est fermée (« adversaire déconnecté »).

Côté jeu, presque rien n'a changé : l'ancien rôle d'« invité » (envoyer ses entrées, afficher des instantanés) existait déjà. Les **deux** joueurs sont désormais invités, et le message `welcome` leur dit leur place (`moi` : 0 ou 1). Messages : en tête de `server/duel.ts`.

Garde-fous : entrées bornées avant d'entrer dans la simulation, nom et apparence nettoyés, 2 ko par message, 200 messages par seconde et par joueur, 100 salles au plus, salle fermée après 15 min sans adversaire, 3 min de silence ou 1 h.

Limites :

- **Pas de compte** : qui a le code entre. Suffisant entre amis ; le duel public attend les comptes (étape 2).
- **Le délai se voit** : le joueur voit son propre combattant avec un aller-retour de retard (pas de prédiction locale). À juger en jouant à deux.
- **Un redéploiement du serveur coupe les duels en cours.**
- L'adresse des joueurs n'arrive pas jusqu'au serveur en connexion directe (le bloc Caddy la recopie d'un en-tête que seul Vercel remplit) : la limite de connexions au duel est donc globale (240 par minute), pas par joueur.
- `?net=peer` rejoue l'ancien pair à pair, `?net=local` relie deux onglets sans réseau.

**Voie de secours sans WebSocket** (`server/duel-http.ts`). Brave, et sans doute d'autres bloqueurs, coupent un WebSocket ouvert vers un autre domaine que celui de la page (constaté le 2026-11-12 : refus en quelques millisecondes depuis `kata-io.vercel.app`, alors qu'un Chromium nu passe). Les requêtes ordinaires, elles, passent. Le jeu essaie donc le WebSocket puis, s'il ne s'ouvre pas, joue le même duel en HTTP : le serveur parle par un flux d'événements (`EventSource`), le jeu répond par de petites requêtes, une à la fois. Mêmes salles : un joueur en WebSocket peut affronter un joueur en HTTP. `?net=http` force cette voie pour l'essayer. Un vrai domaine commun au jeu et au serveur rendrait ce détour inutile.

## L'API

Tout est sous `/api/jeu`. Réponses en JSON ; une erreur porte un champ `erreur`, en français, affiché tel quel au joueur.

| Méthode et chemin | Corps | Réponse |
|---|---|---|
| `GET /api/jeu/sante` | | `{ ok, version }` |
| `POST /api/jeu/montee` | `{ id, v }` (`v` : version de la simulation du jeu) | `{ montee, graine }`, ou 409 si les versions diffèrent |
| `GET /api/jeu/classement?id=…` | | `{ top, moi, version }` : le top 20 et la ligne du joueur |
| `POST /api/jeu/classement` | `{ id, pseudo, montee, combats }` | le classement, plus `record`, `etages`, `secondes` |
| `POST /api/jeu/e` | `{ m, e }` (mesures de jeu, D12) | 204 |
| `WS /api/jeu/duel` | `?salle=CODE` pour rejoindre, rien pour créer | messages du duel (`server/duel.ts`) |
| `POST /api/jeu/duel/ouvrir` | `{ salle? }` | `{ jeton, m }` : duel sans WebSocket |
| `GET /api/jeu/duel/flux?j=jeton` | | flux d'événements : les messages du duel |
| `POST /api/jeu/duel/dire?j=jeton` | tableau de messages | 204 |

Limites : 600 ko par requête, 120 requêtes par minute et par adresse, 20 montées ouvertes et 6 envoyées par minute et par joueur.

## Le code

```
server/
  index.ts        serveur HTTP : routes, taille des requêtes, débit, ménage périodique
  classement.ts   les règles (ouvrir, envoyer, lire, mesures), sans réseau : c'est ce que les tests vérifient
  base.ts         stockage : PostgreSQL en production, mémoire pour les tests et le développement
  version.ts      empreinte de src/sim
  duel.ts         salles de duel : la simulation tourne ici (le WebSocket est branché dans index.ts)
  duel-http.ts    le même duel sans WebSocket (flux d'événements et requêtes), pour les navigateurs qui le bloquent
  Dockerfile, compose.yml, .env.example
src/sim/rejeu.ts  enregistrement, rejeu d'un combat, vérification d'une montée (partagé par le jeu et le serveur)
src/sim/dmath.ts  fonctions mathématiques reproductibles
tests/serveur.test.ts, tests/duel.test.ts, tests/duel-http.test.ts, tests/rejeu.test.ts, tests/dmath.test.ts
```

Tables (créées au démarrage) : `montees` (ouvertes puis closes, avec leur résultat), `records` (la meilleure montée de chaque joueur), `evenements` (mesures de jeu, gardées 180 jours).

## En développement

```bash
npm run serveur                       # serveur de jeu sur le port 8787, tout en mémoire
VITE_API_JEU=/api/jeu npm run dev     # le jeu, branché dessus (Vite relaie /api/jeu vers le port 8787, duel compris)
```

Sans `VITE_API_JEU`, pas de classement, et le duel reste grisé. Pour essayer un duel seul : créer la salle dans un onglet, ouvrir le lien dans un autre. Pour essayer avec une vraie base : `DATABASE_URL=postgres://… npm run serveur`.

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
       encode zstd gzip

       # Seul le serveur de jeu est exposé ici ; tout le reste n'existe pas.
       handle /api/jeu/* {
           reverse_proxy 127.0.0.1:8787 {
               import sans_cookie_portail
               # Le jeu arrive par le relais de Vercel : sans cette ligne, Caddy remplace l'adresse du joueur
               # par celle de Vercel, et tous les joueurs partagent la même limite de débit.
               header_up X-Forwarded-For {http.request.header.X-Forwarded-For}
           }
       }
       handle {
           respond 404
       }
   }
   ```
   Puis `sudo caddy validate --config /etc/caddy/Caddyfile` et `sudo systemctl reload caddy`. Le nom existe déjà : chez DuckDNS, tout sous-domaine de `rev0li.duckdns.org` pointe vers le VPS. `sans_cookie_portail` est le snippet déjà présent dans le Caddyfile (le cookie du portail vaut pour tous les sous-domaines).
3. Relais dans `vercel.json` (**en place**) :
   ```json
   "rewrites": [{ "source": "/api/jeu/:chemin*", "destination": "https://kata.rev0li.duckdns.org/api/jeu/:chemin*" }]
   ```
4. `VITE_API_JEU=/api/jeu` est fixée par le fichier `.env.production` du dépôt : tout build Vercel (aperçu d'une PR comme production) parle au serveur de jeu. Pour essayer un changement risqué, jouer une montée sur l'aperçu de la PR avant de fusionner. Attention : un aperçu écrit dans le vrai classement.
5. **Fait le 2026-11-11** : production branchée après une montée acceptée sur iPhone ; `api/classement.js`, `api/e.js` et leur test supprimés. Les anciens scores, non vérifiés et joués avec une seule vie, n'ont pas été repris. Reste à supprimer la base Upstash dans Vercel (onglet *Storage*).

À chaque fusion qui touche `src/sim` ou `server/`, il faut redéployer le serveur : `server/deploiement.sh` récupère `main` et reconstruit le serveur si quelque chose le concerne. C'est le VPS qui vient chercher le code : aucune clé n'est confiée à GitHub. **Pour l'instant le script est lancé à la main** ; pour qu'il tourne tout seul chaque minute, installer un timer systemd de l'utilisateur (le VPS n'a pas cron) :

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/kata-deploiement.service <<'EOF'
[Unit]
Description=Kata.io : redéploie le serveur de jeu quand main change
[Service]
Type=oneshot
ExecStart=/bin/sh -c '%h/app/kata/server/deploiement.sh >> %h/app/kata-deploiement.log 2>&1'
EOF
cat > ~/.config/systemd/user/kata-deploiement.timer <<'EOF'
[Unit]
Description=Kata.io : vérifie main chaque minute
[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
[Install]
WantedBy=timers.target
EOF
systemctl --user daemon-reload && systemctl --user enable --now kata-deploiement.timer
sudo loginctl enable-linger revovps           # le timer tourne même sans session ouverte
tail ~/app/kata-deploiement.log               # une ligne par déploiement, « ÉCHEC » si la construction rate (retentée chaque minute)
```

Entre la mise en ligne du jeu par Vercel et la fin de la reconstruction (une à trois minutes), les montées commencées ne sont pas classées. À la main, si besoin : `git pull && docker compose -f server/compose.yml up -d --build`.

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
- **Duel, suite** : duel public (file d'attente, après les comptes), reconnexion après une coupure courte, prédiction locale de son propre combattant si le délai gêne, résultat des duels en base.
