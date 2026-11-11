#!/bin/sh
# Redéploiement automatique du serveur de jeu sur le VPS. Lancé chaque minute par cron (voir docs/BACKEND.md) :
# récupère main, et reconstruit le serveur seulement si la simulation ou le serveur ont changé depuis le dernier
# déploiement réussi. Le VPS vient chercher le code : aucune clé d'accès n'est confiée à GitHub.
set -eu
cd "$(dirname "$0")/.."
exec 9>/tmp/kata-deploiement.verrou
flock -n 9 || exit 0 # un déploiement est déjà en cours

git fetch -q origin main
git merge -q --ff-only origin/main
ici=$(git rev-parse HEAD)
temoin="$HOME/.kata-deploye" # dernier commit déployé avec succès : un échec est retenté à la minute suivante
fait=$(cat "$temoin" 2>/dev/null || true)
[ "$ici" = "$fait" ] && exit 0

if [ -n "$fait" ] && git diff --quiet "$fait" "$ici" -- src/sim server package.json package-lock.json 2>/dev/null; then
  echo "$ici" >"$temoin"
  exit 0 # rien qui touche le serveur
fi

echo "$(date -Is) déploiement de $ici"
docker compose -f server/compose.yml up -d --build >/dev/null 2>&1 || {
  echo "$(date -Is) ÉCHEC du déploiement de $ici : docker compose -f server/compose.yml up -d --build"
  exit 1
}
echo "$ici" >"$temoin"
echo "$(date -Is) en service : $(curl -s --retry 5 --retry-connrefused --retry-delay 2 http://127.0.0.1:8787/api/jeu/sante)"
